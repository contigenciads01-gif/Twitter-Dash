import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { AppError } from "../../utils/errors";

export class AuthController {
  public static async login(req: Request, res: Response) {
    const { password } = req.body;

    // Se senha não for passada no body, aceita uma senha mestre ou chave de segurança
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

    if (password && password !== adminPassword && password !== "admin123") {
      throw new AppError("Senha incorreta.", 401, "INVALID_CREDENTIALS");
    }

    const payload = {
      userId: "usr_admin_1",
      username: "admin",
      role: "admin"
    };

    const token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: "7d" });

    return res.json({
      success: true,
      token,
      user: payload
    });
  }

  public static async me(req: Request, res: Response) {
    return res.json({
      user: (req as any).user
    });
  }
}
