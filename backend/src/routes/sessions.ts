import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { verifySupabaseJwt } from "../middleware/auth.js";
import {
  getTutorResponse,
  streamTutorResponse,
  TutorResponseError,
  type TutorResponse,
} from "../services/llmService.js";
import { saveFeedbackAndVocab } from "../services/feedbackParser.js";
import { checkMessageAllowance } from "../services/usageService.js";
import { sessionDurationMs } from "../services/progressService.js";

const createSessionSchema = z.object({
  language: z.string().default("es"),
  difficulty: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]).default("A1"),
  mode: z.enum(["helper", "immersion"]).default("helper"),
});

const sendMessageSchema = z.object({
  content: z.string().min(1),
});

// Canned, level-calibrated opening greetings from Sofía (#16).
// No LLM call — instant and free. Each pairs a natural Spanish greeting with a
// level-appropriate opening question to invite the learner to respond.
const GREETINGS: Record<string, string> = {
  A1: "¡Hola! Soy Sofía. ¿Cómo estás hoy?",
  A2: "¡Hola! Me llamo Sofía. ¿Qué has hecho hoy?",
  B1: "¡Hola! Soy Sofía, tu tutora de español. Cuéntame, ¿qué te gusta hacer en tu tiempo libre?",
  B2: "¡Hola! Soy Sofía. Me encantaría conocerte mejor. ¿Cómo ha ido tu día hasta ahora?",
  C1: "¡Hola! Soy Sofía. Para ir entrando en calor, ¿hay algún tema que te apetezca comentar hoy?",
  C2: "¡Hola! Soy Sofía. Antes de nada, cuéntame: ¿qué te ha llamado la atención últimamente, ya sea una noticia, una lectura o una conversación?",
};

export async function sessionRoutes(app: FastifyInstance): Promise<void> {
  // All routes require auth
  app.addHook("onRequest", verifySupabaseJwt);

  // POST /sessions
  app.post("/sessions", async (request, reply) => {
    const body = createSessionSchema.parse(request.body);
    const userId = request.user.sub;
    const email = request.user.email || "";

    // Ensure user exists
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId, email },
    });

    // Ensure a UserLanguageProfile exists, but do NOT overwrite the stored
    // level on session creation (#8) — level is written only via PATCH /profile.
    await prisma.userLanguageProfile.upsert({
      where: { userId_language: { userId, language: body.language } },
      update: {},
      create: {
        userId,
        language: body.language,
        currentLevel: body.difficulty,
      },
    });

    const session = await prisma.session.create({
      data: {
        userId,
        language: body.language,
        difficulty: body.difficulty,
        mode: body.mode,
      },
    });

    // Sofía greets first (#16) with a canned, level-appropriate opener so the
    // learner never faces an empty screen. No LLM call — instant and free.
    const greetingMessage = await prisma.message.create({
      data: {
        sessionId: session.id,
        role: "assistant",
        content: GREETINGS[body.difficulty] ?? GREETINGS.A1,
      },
    });

    reply.code(201).send({ ...session, messages: [greetingMessage] });
  });

  // GET /sessions
  app.get("/sessions", async (request) => {
    const userId = request.user.sub;

    const sessions = await prisma.session.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { messages: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
      },
    });

    return sessions.map((session) => {
      const { messages, ...rest } = session;
      const lastMessageAt = messages[0]?.createdAt ?? null;
      return {
        ...rest,
        durationMinutes: Math.round(
          sessionDurationMs(session.createdAt, session.endedAt, lastMessageAt) /
            60000,
        ),
      };
    });
  });

  // GET /sessions/:id
  app.get<{ Params: { id: string } }>("/sessions/:id", async (request, reply) => {
    const userId = request.user.sub;
    const { id } = request.params;

    const session = await prisma.session.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          include: { feedback: true },
        },
      },
    });

    if (!session || session.userId !== userId) {
      return reply.code(404).send({ error: "Session not found" });
    }

    return session;
  });

  // PATCH /sessions/:id — mark session as ended.
  // endedAt is essential for progress stats: it lets us compute session duration
  // (total_minutes, streak_days) and distinguish active vs. completed sessions.
  app.patch<{ Params: { id: string } }>("/sessions/:id", async (request, reply) => {
    const userId = request.user.sub;
    const { id } = request.params;
    const body = z.object({ endedAt: z.string().datetime() }).parse(request.body);

    const session = await prisma.session.findUnique({ where: { id } });
    if (!session || session.userId !== userId) {
      return reply.code(404).send({ error: "Session not found" });
    }

    const updated = await prisma.session.update({
      where: { id },
      data: { endedAt: body.endedAt },
    });
    return updated;
  });

  // POST /sessions/:id/messages
  app.post<{ Params: { id: string } }>("/sessions/:id/messages", async (request, reply) => {
    const userId = request.user.sub;
    const { id: sessionId } = request.params;
    const body = sendMessageSchema.parse(request.body);

    // Verify session belongs to user
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          select: { role: true, content: true },
        },
      },
    });

    if (!session || session.userId !== userId) {
      return reply.code(404).send({ error: "Session not found" });
    }

    // Enforce daily free message limit before spending on the LLM
    const allowance = await checkMessageAllowance(userId);
    if (!allowance.allowed) {
      return reply.code(429).send({
        error:
          "Daily free message limit reached (50/day). Upgrade to premium for unlimited practice.",
      });
    }

    // Save user message
    const userMessage = await prisma.message.create({
      data: {
        sessionId,
        role: "user",
        content: body.content,
      },
    });

    // Build conversation history for LLM
    const history = session.messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // Get tutor response. If the LLM fails or returns unparseable output, we
    // must NOT persist a fabricated reply (it would pollute conversation history
    // and summaries). Roll back the just-created user message so the client can
    // safely resend without duplicating it, then surface a clean error.
    let tutorResponse;
    try {
      tutorResponse = await getTutorResponse(
        session.language,
        session.difficulty,
        session.mode,
        history,
        body.content,
        userId,
      );
    } catch (err) {
      if (err instanceof TutorResponseError) {
        await prisma.message.delete({ where: { id: userMessage.id } });
        return reply.code(502).send({
          error:
            "Sofia couldn't respond just now. Please try sending your message again.",
        });
      }
      throw err;
    }

    // Save assistant message
    const assistantMessage = await prisma.message.create({
      data: {
        sessionId,
        role: "assistant",
        content: tutorResponse.reply,
      },
    });

    // Save feedback and vocab
    await saveFeedbackAndVocab(
      assistantMessage.id,
      userId,
      session.language,
      tutorResponse,
      sessionId,
    );

    // Fetch the saved feedback to return
    const feedback = await prisma.messageFeedback.findUnique({
      where: { messageId: assistantMessage.id },
    });

    return {
      userMessage,
      assistantMessage: { ...assistantMessage, feedback, replyLines: tutorResponse.reply_lines },
      feedback,
      difficulty_signal: tutorResponse.feedback.difficulty_signal,
    };
  });

  // POST /sessions/:id/messages/stream — SSE variant of the handler above.
  // Streams the tutor's plain-text reply token-by-token so the conversation
  // feels instant (#20), then emits a `complete` event with the SAME payload
  // shape the JSON route returns. The non-stream route above is kept intact for
  // compatibility.
  app.post<{ Params: { id: string } }>(
    "/sessions/:id/messages/stream",
    async (request, reply) => {
      const userId = request.user.sub;
      const { id: sessionId } = request.params;
      const body = sendMessageSchema.parse(request.body);

      // Verify session belongs to user
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          messages: {
            orderBy: { createdAt: "asc" },
            select: { role: true, content: true },
          },
        },
      });

      if (!session || session.userId !== userId) {
        return reply.code(404).send({ error: "Session not found" });
      }

      // Enforce daily free message limit before spending on the LLM
      const allowance = await checkMessageAllowance(userId);
      if (!allowance.allowed) {
        return reply.code(429).send({
          error:
            "Daily free message limit reached (50/day). Upgrade to premium for unlimited practice.",
        });
      }

      // Save user message. Rolled back below if the tutor fails, exactly like
      // the non-stream route.
      const userMessage = await prisma.message.create({
        data: {
          sessionId,
          role: "user",
          content: body.content,
        },
      });

      const history = session.messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      // Take over the socket for Server-Sent Events. hijack() stops Fastify from
      // trying to send its own reply once we start writing raw frames.
      reply.hijack();
      const raw = reply.raw;
      raw.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      });

      const emit = (event: string, data: unknown) => {
        raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      const rollbackUserMessage = async () => {
        await prisma.message
          .delete({ where: { id: userMessage.id } })
          .catch(() => {
            // Best-effort — nothing else we can safely do on the socket.
          });
      };

      try {
        let tutorResponse: TutorResponse | null = null;

        for await (const evt of streamTutorResponse(
          session.language,
          session.difficulty,
          session.mode,
          history,
          body.content,
          userId,
        )) {
          if (evt.type === "delta") {
            emit("delta", { text: evt.text });
          } else {
            tutorResponse = evt.tutorResponse;
          }
        }

        // The generator always yields a `final` unless it threw (caught below).
        if (!tutorResponse) {
          throw new TutorResponseError();
        }

        // Persist assistant message + feedback exactly like the JSON route.
        const assistantMessage = await prisma.message.create({
          data: {
            sessionId,
            role: "assistant",
            content: tutorResponse.reply,
          },
        });

        await saveFeedbackAndVocab(
          assistantMessage.id,
          userId,
          session.language,
          tutorResponse,
          sessionId,
        );

        const feedback = await prisma.messageFeedback.findUnique({
          where: { messageId: assistantMessage.id },
        });

        emit("complete", {
          userMessage,
          assistantMessage: {
            ...assistantMessage,
            feedback,
            replyLines: tutorResponse.reply_lines,
          },
          feedback,
          difficulty_signal: tutorResponse.feedback.difficulty_signal,
        });
        raw.end();
      } catch (err) {
        // On any tutor failure, roll back the user message so the client can
        // safely resend, then surface a clean error event. Wrapped so an
        // exception never leaves the socket hanging.
        if (!(err instanceof TutorResponseError)) {
          // Log unexpected errors server-side but still fail the turn cleanly.
          request.log.error(err);
        }
        try {
          await rollbackUserMessage();
          emit("error", {
            error:
              "Sofia couldn't respond just now. Please try sending your message again.",
          });
        } finally {
          raw.end();
        }
      }
    },
  );
}
