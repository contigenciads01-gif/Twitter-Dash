import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { PostsController } from "./posts.controller";
import { AppError } from "../../utils/errors";

const router = Router();

// Garante que o diretório de uploads existe
const uploadDir = path.resolve(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuração do multer com validação de extensão e tipo MIME
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `media-${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 4
  },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ["image/jpeg", "image/png", "image/gif", "video/mp4"];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError("Formato de arquivo não suportado. Use JPEG, PNG, GIF ou MP4.", 400, "INVALID_FILE_TYPE"));
    }
  }
});

router.post("/", PostsController.create);
router.get("/", PostsController.list);
router.get("/:id", PostsController.getById);
router.patch("/:id", PostsController.update);
router.delete("/:id", PostsController.cancel);
router.post("/:id/publish-now", PostsController.publishNow);
router.post("/:id/retry", PostsController.retry);
router.post("/upload", upload.array("media", 4), PostsController.uploadMedia);

export default router;
