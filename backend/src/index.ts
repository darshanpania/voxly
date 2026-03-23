import Fastify from "fastify";
import cors from "@fastify/cors";
import { env } from "./env.js";
import { healthRoutes } from "./routes/health.js";
import { sessionRoutes } from "./routes/sessions.js";
import { audioRoutes } from "./routes/audio.js";

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await app.register(healthRoutes);
  await app.register(sessionRoutes);
  await app.register(audioRoutes);

  try {
    await app.listen({ port: env.PORT, host: "0.0.0.0" });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
