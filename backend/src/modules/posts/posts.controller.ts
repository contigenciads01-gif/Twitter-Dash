import { Request, Response } from "express";
import { PostsService } from "./posts.service";
import { createPostSchema, updatePostSchema } from "./posts.validator";

const postsService = new PostsService();

export class PostsController {
  public static async create(req: Request, res: Response) {
    const validated = createPostSchema.parse(req.body);
    const post = await postsService.createPost(validated);
    return res.status(201).json(post);
  }

  public static async list(req: Request, res: Response) {
    const { status, from, to, limit, offset } = req.query;
    const posts = await postsService.getPosts({
      status: status ? String(status) : undefined,
      from: from ? String(from) : undefined,
      to: to ? String(to) : undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined
    });
    return res.json(posts);
  }

  public static async getById(req: Request, res: Response) {
    const id = String(req.params.id);
    const post = await postsService.getPostById(id);
    return res.json(post);
  }

  public static async update(req: Request, res: Response) {
    const id = String(req.params.id);
    const validated = updatePostSchema.parse(req.body);
    const updated = await postsService.updatePost(id, validated);
    return res.json(updated);
  }

  public static async cancel(req: Request, res: Response) {
    const id = String(req.params.id);
    const cancelled = await postsService.cancelPost(id);
    return res.json({ success: true, post: cancelled });
  }

  public static async retry(req: Request, res: Response) {
    const id = String(req.params.id);
    const retried = await postsService.retryPost(id);
    return res.json({ success: true, post: retried });
  }

  public static async publishNow(req: Request, res: Response) {
    const id = String(req.params.id);
    const post = await postsService.getPostById(id);
    await postsService.executePublish(post);
    const updated = await postsService.getPostById(id);
    return res.json({ success: true, post: updated });
  }

  public static async uploadMedia(req: Request, res: Response) {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: { code: "NO_FILES", message: "Nenhum arquivo enviado." } });
    }

    const paths = files.map((file) => `uploads/${file.filename}`);
    return res.json({
      success: true,
      mediaPaths: paths
    });
  }
}
