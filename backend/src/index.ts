import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { env } from "./env.js";
import { healthRoutes } from "./routes/health.js";
import { sessionRoutes } from "./routes/sessions.js";
import { audioRoutes } from "./routes/audio.js";
import { progressRoutes } from "./routes/progress.js";
import { profileRoutes } from "./routes/profile.js";

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });

  // Global rate limit: key by authenticated user when available, else by IP.
  await app.register(rateLimit, {
    max: 60,
    timeWindow: "1 minute",
    allowList: [],
    keyGenerator: (request) => request.user?.sub ?? request.ip,
  });

  await app.register(healthRoutes);
  await app.register(sessionRoutes);
  await app.register(audioRoutes);
  await app.register(progressRoutes);
  await app.register(profileRoutes);

  try {
    await app.listen({ port: env.PORT, host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
