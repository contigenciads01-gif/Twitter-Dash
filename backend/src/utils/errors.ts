import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { logger } from "./logger";

export class AppError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, statusCode: number = 400, code: string = "BAD_REQUEST") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) {
  logger.error(`[API Error] ${req.method} ${req.originalUrl}:`, err);

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message
      }
    });
  }

  if (err instanceof ZodError) {
    const messages = err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ");
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: `Dados inválidos: ${messages}`,
        details: err.errors
      }
    });
  }

  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || "Ocorreu um erro interno no servidor.";
  const code = err.code || "INTERNAL_SERVER_ERROR";

  return res.status(statusCode).json({
    error: {
      code,
      message
    }
  });
}
