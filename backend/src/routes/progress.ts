import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { verifySupabaseJwt } from "../middleware/auth.js";
import {
  getSessionSummary,
  getVocabDueForReview,
  getVocabStats,
  getProgressStats,
  updateVocabAfterReview,
} from "../services/progressService.js";

const reviewSchema = z.object({
  wasCorrect: z.boolean(),
});

export async function progressRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", verifySupabaseJwt);

  const userId = "dev-user";

  // GET /sessions/:id/summary
  app.get<{ Params: { id: string } }>(
    "/sessions/:id/summary",
    async (request) => {
      const { id } = request.params;
      return getSessionSummary(id);
    },
  );

  // GET /vocabulary?language=es
  app.get<{ Querystring: { language?: string } }>(
    "/vocabulary",
    async (request) => {
      const language = request.query.language || "es";
      return getVocabDueForReview(userId, language);
    },
  );

  // GET /vocabulary/stats?language=es
  app.get<{ Querystring: { language?: string } }>(
    "/vocabulary/stats",
    async (request) => {
      const language = request.query.language || "es";
      return getVocabStats(userId, language);
    },
  );

  // PUT /vocabulary/:id/review
  app.put<{ Params: { id: string } }>(
    "/vocabulary/:id/review",
    async (request) => {
      const { id } = request.params;
      const body = reviewSchema.parse(request.body);
      return updateVocabAfterReview(id, body.wasCorrect);
    },
  );

  // GET /progress?language=es
  app.get<{ Querystring: { language?: string } }>(
    "/progress",
    async (request) => {
      const language = request.query.language || "es";
      return getProgressStats(userId, language);
    },
  );
}
