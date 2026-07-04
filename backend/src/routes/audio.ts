import type { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import { z } from "zod";
import { verifySupabaseJwt } from "../middleware/auth.js";
import { transcribeAudio } from "../services/sttService.js";
import { synthesizeSpeech } from "../services/ttsService.js";
import {
  checkVoiceAllowance,
  addVoiceSeconds,
} from "../services/usageService.js";

const VOICE_LIMIT_MESSAGE =
  "Daily free voice limit reached (5 min/day). Upgrade to premium for unlimited speaking practice.";

const synthesizeSchema = z.object({
  text: z.string().min(1),
  language: z.string().default("es"),
});

export async function audioRoutes(app: FastifyInstance): Promise<void> {
  await app.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  });

  app.addHook("onRequest", verifySupabaseJwt);

  // POST /audio/transcribe
  app.post("/audio/transcribe", async (request, reply) => {
    const userId = request.user.sub;
    const data = await request.file();
    if (!data) {
      return reply.code(400).send({ error: "No audio file provided" });
    }

    const chunks: Buffer[] = [];
    for await (const chunk of data.file) {
      chunks.push(chunk);
    }
    const audioBuffer = Buffer.concat(chunks);

    // Get language from fields
    const language =
      (data.fields.language as { value?: string } | undefined)?.value || "es";

    // Enforce daily free voice limit before spending on Whisper
    const allowance = await checkVoiceAllowance(userId, language);
    if (!allowance.allowed) {
      return reply.code(429).send({ error: VOICE_LIMIT_MESSAGE });
    }

    const result = await transcribeAudio(
      audioBuffer,
      language,
      data.filename || "audio.webm",
    );

    // Meter the actual audio duration when available, otherwise estimate
    // from the byte size (~16 KB/s for typical speech audio).
    const seconds =
      result.duration != null
        ? Math.ceil(result.duration)
        : Math.ceil(audioBuffer.length / 16000);
    await addVoiceSeconds(userId, language, seconds);

    return reply.send(result);
  });

  // POST /audio/synthesize
  app.post("/audio/synthesize", async (request, reply) => {
    const userId = request.user.sub;
    const body = synthesizeSchema.parse(request.body);

    // Enforce daily free voice limit before spending on TTS
    const allowance = await checkVoiceAllowance(userId, body.language);
    if (!allowance.allowed) {
      return reply.code(429).send({ error: VOICE_LIMIT_MESSAGE });
    }

    // Estimate spoken duration (~15 characters per second) and meter it
    const seconds = Math.ceil(body.text.length / 15);
    await addVoiceSeconds(userId, body.language, seconds);

    const audioStream = await synthesizeSpeech(body.text, body.language);

    reply.header("Content-Type", "audio/mpeg");
    reply.header("Transfer-Encoding", "chunked");

    return reply.send(audioStream);
  });
}
