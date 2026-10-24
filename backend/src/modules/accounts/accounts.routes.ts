import { Router } from "express";
import { AccountsController } from "./accounts.controller";

const router = Router();

router.post("/", AccountsController.create);
router.get("/", AccountsController.list);
router.patch("/:id/activate", AccountsController.activate);
router.delete("/:id", AccountsController.delete);

export default router;
