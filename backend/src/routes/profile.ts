import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db.js";
import { verifySupabaseJwt } from "../middleware/auth.js";

const patchProfileSchema = z.object({
  language: z.string().default("es"),
  currentLevel: z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]),
});

export async function profileRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("onRequest", verifySupabaseJwt);

  // GET /profile?language=es — read the stored level without creating a row.
  app.get<{ Querystring: { language?: string } }>(
    "/profile",
    async (request) => {
      const userId = request.user.sub;
      const language = request.query.language || "es";

      const profile = await prisma.userLanguageProfile.findUnique({
        where: { userId_language: { userId, language } },
      });

      if (!profile) {
        return { language, currentLevel: "A1" };
      }
      return profile;
    },
  );

  // PATCH /profile — the only place level is written from now on (#8).
  app.patch("/profile", async (request) => {
    const body = patchProfileSchema.parse(request.body);
    const userId = request.user.sub;
    const email = request.user.email || "";

    // Ensure user exists (FK target for the profile).
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId, email },
    });

    const profile = await prisma.userLanguageProfile.upsert({
      where: { userId_language: { userId, language: body.language } },
      update: { currentLevel: body.currentLevel },
      create: {
        userId,
        language: body.language,
        currentLevel: body.currentLevel,
      },
    });

    return profile;
  });
}
