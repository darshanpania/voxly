import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { verifySupabaseJwt } from "../middleware/auth.js";
import { getTutorResponse } from "../services/llmService.js";
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

    // Upsert UserLanguageProfile
    await prisma.userLanguageProfile.upsert({
      where: { userId_language: { userId, language: body.language } },
      update: { currentLevel: body.difficulty },
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

    reply.code(201).send(session);
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

    // Get tutor response
    const tutorResponse = await getTutorResponse(
      session.language,
      session.difficulty,
      session.mode,
      history,
      body.content,
      userId,
    );

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
}
