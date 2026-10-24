/**
 * Logger estruturado seguro
 * Garante que senhas, tokens e credenciais nunca vazem no terminal ou em arquivos de log.
 */

const SENSITIVE_KEYS = [
  "password",
  "secret",
  "token",
  "authorization",
  "cookie",
  "apikey",
  "jwt"
];

function sanitize(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitize);
  }

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const isSensitive = SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s));
    if (isSensitive && typeof value === "string") {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object") {
      sanitized[key] = sanitize(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export const logger = {
  info: (message: string, context?: Record<string, any>) => {
    const payload = context ? ` ${JSON.stringify(sanitize(context))}` : "";
    console.log(`[INFO] [${new Date().toISOString()}] ${message}${payload}`);
  },
  warn: (message: string, context?: Record<string, any>) => {
    const payload = context ? ` ${JSON.stringify(sanitize(context))}` : "";
    console.warn(`[WARN] [${new Date().toISOString()}] ${message}${payload}`);
  },
  error: (message: string, error?: any, context?: Record<string, any>) => {
    const errMsg = error instanceof Error ? error.stack || error.message : JSON.stringify(error);
    const payload = context ? ` | Contexto: ${JSON.stringify(sanitize(context))}` : "";
    console.error(`[ERROR] [${new Date().toISOString()}] ${message} -> ${errMsg}${payload}`);
  },
  debug: (message: string, context?: Record<string, any>) => {
    if (process.env.NODE_ENV !== "production") {
      const payload = context ? ` ${JSON.stringify(sanitize(context))}` : "";
      console.debug(`[DEBUG] [${new Date().toISOString()}] ${message}${payload}`);
    }
  }
};
