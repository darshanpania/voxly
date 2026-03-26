import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { verifySupabaseJwt } from "../middleware/auth.js";
import {
  getSessionSummary,
  getVocabDueForReview,
  getAllVocabulary,
  getVocabStats,
  getProgressStats,
  reviewVocabFSRS,
  updateVocabAfterReview,
} from "../services/progressService.js";
import { Rating } from "../services/fsrs.js";

const reviewSchema = z.object({
  rating: z.number().min(1).max(4).optional(),
  wasCorrect: z.boolean().optional(),
});

export async function progressRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", verifySupabaseJwt);

  // GET /sessions/:id/summary
  app.get<{ Params: { id: string } }>(
    "/sessions/:id/summary",
    async (request) => {
      const { id } = request.params;
      return getSessionSummary(id);
    },
  );

  // GET /vocabulary?language=es (due items only)
  app.get<{ Querystring: { language?: string } }>(
    "/vocabulary",
    async (request) => {
      const userId = request.user.sub;
      const language = request.query.language || "es";
      return getVocabDueForReview(userId, language);
    },
  );

  // GET /vocabulary/all?language=es&category=food&state=2&sort=word
  app.get<{
    Querystring: {
      language?: string;
      category?: string;
      state?: string;
      sort?: string;
    };
  }>("/vocabulary/all", async (request) => {
    const userId = request.user.sub;
    const language = request.query.language || "es";
    return getAllVocabulary(userId, language, {
      category: request.query.category,
      state:
        request.query.state !== undefined
          ? parseInt(request.query.state, 10)
          : undefined,
      sort: request.query.sort,
    });
  });

  // GET /vocabulary/stats?language=es
  app.get<{ Querystring: { language?: string } }>(
    "/vocabulary/stats",
    async (request) => {
      const userId = request.user.sub;
      const language = request.query.language || "es";
      return getVocabStats(userId, language);
    },
  );

  // PUT /vocabulary/:id/review — accepts FSRS rating (1-4) or legacy wasCorrect
  app.put<{ Params: { id: string } }>(
    "/vocabulary/:id/review",
    async (request) => {
      const { id } = request.params;
      const body = reviewSchema.parse(request.body);

      if (body.rating !== undefined) {
        return reviewVocabFSRS(id, body.rating as Rating);
      }
      if (body.wasCorrect !== undefined) {
        return updateVocabAfterReview(id, body.wasCorrect);
      }
      throw new Error("Either rating or wasCorrect must be provided");
    },
  );

  // GET /progress?language=es
  app.get<{ Querystring: { language?: string } }>(
    "/progress",
    async (request) => {
      const userId = request.user.sub;
      const language = request.query.language || "es";
      return getProgressStats(userId, language);
    },
  );
}
