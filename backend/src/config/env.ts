import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carrega as variáveis do arquivo .env
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const envSchema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().default("file:./twitter_dash.db"),
  TZ: z.string().default("America/Sao_Paulo"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET deve possuir ao menos 16 caracteres").default("segredo-dashboard-twitter-jwt-default-key-32chars"),
  
  // Credenciais do Twitter
  TWITTER_USERNAME: z.string().optional().default(""),
  TWITTER_PASSWORD: z.string().optional().default(""),
  TWITTER_EMAIL: z.string().optional().default(""),
  
  TWITTER_API_KEY: z.string().optional().default(""),
  TWITTER_API_SECRET_KEY: z.string().optional().default(""),
  TWITTER_ACCESS_TOKEN: z.string().optional().default(""),
  TWITTER_ACCESS_TOKEN_SECRET: z.string().optional().default(""),
  
  MCP_SERVER_PATH: z.string().default("../twitter-mcp-server/build/index.js"),
  MIN_POST_INTERVAL_SECONDS: z.coerce.number().default(60),
  SCHEDULER_ENABLED: z.preprocess((val) => val === "true" || val === true, z.boolean()).default(true),
  ANALYTICS_CRON_ENABLED: z.preprocess((val) => val === "true" || val === true, z.boolean()).default(true)
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Configuração de variáveis de ambiente inválida:", parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;
