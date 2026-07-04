import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  PORT: z.coerce.number().default(3001),
  // Dev-only auth bypass. Must be explicitly set to "true" to activate; fails
  // closed (real JWT verification) otherwise.
  ALLOW_DEV_AUTH: z
    .string()
    .optional()
    .transform((v) => v === "true"),
});

export const env = envSchema.parse(process.env);
