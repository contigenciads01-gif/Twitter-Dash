import express from "express";
import cors from "cors";
import path from "path";
import rateLimit from "express-rate-limit";
import authRoutes from "./modules/auth/auth.routes";
import accountsRoutes from "./modules/accounts/accounts.routes";
import postsRoutes from "./modules/posts/posts.routes";
import analyticsRoutes from "./modules/analytics/analytics.routes";
import settingsRoutes from "./modules/settings/settings.routes";
import { authMiddleware } from "./modules/auth/auth.middleware";
import { errorHandler } from "./utils/errors";

const app = express();

// Middlewares essenciais
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Rate limit global para segurança contra abuso
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 300, // 300 requisições por janela
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMIT_EXCEEDED", message: "Muitas requisições. Tente novamente mais tarde." } }
});
app.use(limiter);

// Servir arquivos de mídia enviados
app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

// Rota de Health Check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "twitter-dash-backend"
  });
});

// Rotas de Autenticação (pública para /login)
app.use("/api/auth", authRoutes);

// Aplica autenticação JWT em TODAS as rotas subsequentes da API
app.use("/api", authMiddleware);

// Módulos protegidos
app.use("/api/accounts", accountsRoutes);
app.use("/api/posts", postsRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/settings", settingsRoutes);

// Handler global padronizado de erros
app.use(errorHandler);

export default app;
