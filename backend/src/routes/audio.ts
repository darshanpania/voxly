import type { FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import { z } from "zod";
import { verifySupabaseJwt } from "../middleware/auth.js";
import { transcribeAudio } from "../services/sttService.js";
import { synthesizeSpeech } from "../services/ttsService.js";

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

    const result = await transcribeAudio(
      audioBuffer,
      language,
      data.filename || "audio.webm",
    );

    return reply.send(result);
  });

  // POST /audio/synthesize
  app.post("/audio/synthesize", async (request, reply) => {
    const body = synthesizeSchema.parse(request.body);

    const audioStream = await synthesizeSpeech(body.text, body.language);

    reply.header("Content-Type", "audio/mpeg");
    reply.header("Transfer-Encoding", "chunked");

    return reply.send(audioStream);
  });
}
