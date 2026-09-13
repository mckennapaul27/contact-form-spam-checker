import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  apiKey: required("API_KEY"),
  mongodbUri: required("MONGODB_URI"),
  aiModel: process.env.AI_MODEL ?? "openai/gpt-4.1-mini",
  rateLimitPerWebsite: Number(process.env.RATE_LIMIT_PER_WEBSITE ?? 30),
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
};
