import { Router } from "express";
import { z } from "zod";
import { BlockedSubmission } from "../models/BlockedSubmission.js";

const listQuerySchema = z.object({
  website: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const blockedRouter = Router();

blockedRouter.get("/", async (req, res, next) => {
  try {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid query",
        details: parsed.error.flatten(),
      });
      return;
    }

    const { website, page, limit } = parsed.data;
    const filter = website ? { website } : {};
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      BlockedSubmission.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      BlockedSubmission.countDocuments(filter),
    ]);

    res.json({ items, page, limit, total });
  } catch (err) {
    next(err);
  }
});
