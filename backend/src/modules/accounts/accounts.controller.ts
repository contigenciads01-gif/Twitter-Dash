import { Request, Response } from "express";
import { AccountsService } from "./accounts.service";

const accountsService = new AccountsService();

export class AccountsController {
  public static async create(req: Request, res: Response) {
    const result = await accountsService.addAccount(req.body);
    return res.status(201).json(result);
  }

  public static async list(req: Request, res: Response) {
    const accounts = await accountsService.listAccounts();
    return res.json(accounts);
  }

  public static async activate(req: Request, res: Response) {
    const id = String(req.params.id);
    const account = await accountsService.setActiveAccount(id);
    return res.json({ success: true, account });
  }

  public static async delete(req: Request, res: Response) {
    const id = String(req.params.id);
    await accountsService.deleteAccount(id);
    return res.json({ success: true, message: "Conta removida com sucesso." });
  }
}
