import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { AppError } from "../../utils/errors";

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    username: string;
    role: string;
  };
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // Rotas públicas que não requerem token
  const publicPaths = ["/api/auth/login", "/api/health"];
  if (publicPaths.includes(req.path)) {
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return next(new AppError("Cabeçalho de autorização não fornecido.", 401, "UNAUTHORIZED"));
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return next(new AppError("Formato de token inválido. Use 'Bearer <token>'.", 401, "INVALID_TOKEN_FORMAT"));
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as any;
    req.user = {
      userId: decoded.userId || "admin-user",
      username: decoded.username || "admin",
      role: decoded.role || "admin"
    };
    return next();
  } catch (err: any) {
    return next(new AppError("Token de acesso inválido ou expirado.", 401, "INVALID_TOKEN"));
  }
}
