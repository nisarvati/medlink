import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  HOST: z.string().default("127.0.0.1"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  LOW_STOCK_THRESHOLD: z.coerce.number().int().min(1).default(5),
});

export type Config = Omit<z.infer<typeof schema>, "CORS_ORIGINS"> & { corsOrigins: string[] };

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid configuration: ${msg}`);
  }
  const { CORS_ORIGINS, ...rest } = parsed.data;
  return { ...rest, corsOrigins: CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean) };
}
