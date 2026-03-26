import type { FastifyRequest, FastifyReply } from "fastify";
import jwt from "jsonwebtoken";
import { env } from "../env.js";

export interface JwtPayload {
  sub: string;
  email?: string;
  role?: string;
  iat?: number;
  exp?: number;
}

declare module "fastify" {
  interface FastifyRequest {
    user: JwtPayload;
  }
}

export async function verifySupabaseJwt(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // DEV BYPASS: skip auth in development
  if (process.env.NODE_ENV !== "production") {
    request.user = { sub: "dev-user-000", email: "dev@test.com", role: "authenticated" };
    return;
  }

  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    reply.code(401).send({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, env.SUPABASE_JWT_SECRET) as JwtPayload;
    request.user = decoded;
  } catch {
    reply.code(401).send({ error: "Invalid or expired token" });
  }
}
