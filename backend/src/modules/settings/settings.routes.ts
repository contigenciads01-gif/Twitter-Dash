import { Router, Request, Response } from "express";
import { getScoringWeights, updateScoringWeights } from "../../config/scoring";
import { McpClientManager } from "../../mcp/client";
import { McpTwitterProvider } from "../../providers/mcp.provider";
import { prisma } from "../../db/client";

const router = Router();

router.get("/scoring", async (_req: Request, res: Response) => {
  const weights = await getScoringWeights();
  return res.json({ weights });
});

router.put("/scoring", async (req: Request, res: Response) => {
  const updated = await updateScoringWeights(req.body);
  return res.json({ success: true, weights: updated });
});

router.get("/mcp-status", async (_req: Request, res: Response) => {
  const mcpManager = McpClientManager.getInstance();
  const provider = new McpTwitterProvider();
  const connectionTest = await provider.testConnection();

  const activeAccount = await prisma.account.findFirst({
    where: { isActive: true },
    select: { id: true, username: true, displayName: true, status: true, avatarUrl: true, lastError: true }
  });

  return res.json({
    connected: mcpManager.isConnected(),
    connectionTest,
    activeAccount,
    tools: mcpManager.getAllTools().map((t) => ({
      name: t.name,
      description: t.description
    }))
  });
});

router.post("/mcp-reconnect", async (_req: Request, res: Response) => {
  const mcpManager = McpClientManager.getInstance();
  await mcpManager.connect();
  return res.json({ success: true, message: "Reconexão com o servidor MCP executada." });
});

export default router;
