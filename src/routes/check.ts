import { Router } from "express";
import { z } from "zod";
import { FIELD_LIMITS } from "../limits.js";
import { BlockedSubmission } from "../models/BlockedSubmission.js";
import { classifySubmission } from "../services/classifier.js";
import { allowWebsite, retryAfterSeconds } from "../services/rateLimit.js";

const checkBodySchema = z.object({
  website: z.string().trim().min(1).max(FIELD_LIMITS.website),
  message: z.string().trim().min(1).max(FIELD_LIMITS.message),
  name: z.string().trim().max(FIELD_LIMITS.name).optional(),
  email: z.string().trim().max(FIELD_LIMITS.email).optional(),
  phone: z.string().trim().max(FIELD_LIMITS.phone).optional(),
  fields: z
    .record(
      z.string().trim().min(1).max(FIELD_LIMITS.fieldKey),
      z.string().max(FIELD_LIMITS.fieldValue),
    )
    .refine((value) => Object.keys(value).length <= FIELD_LIMITS.maxFields, {
      message: `fields cannot have more than ${FIELD_LIMITS.maxFields} keys`,
    })
    .optional(),
  extraCategories: z.array(z.string().max(50)).max(20).optional(),
});

export const checkRouter = Router();

checkRouter.post("/", async (req, res, next) => {
  try {
    const parsed = checkBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid request",
        details: parsed.error.flatten(),
      });
      return;
    }

    if (!allowWebsite(parsed.data.website)) {
      const retryAfter = retryAfterSeconds();
      res.set("Retry-After", String(retryAfter));
      res.status(429).json({
        error: "Too many checks for this website",
        retryAfter,
      });
      return;
    }

    const { extraCategories: _ignored, ...input } = parsed.data;
    const result = await classifySubmission(input);

    if (result.blocked && result.category && result.reason) {
      try {
        await BlockedSubmission.create({
          website: input.website,
          name: input.name,
          email: input.email,
          phone: input.phone,
          message: input.message,
          fields: input.fields,
          category: result.category,
          reason: result.reason,
        });
      } catch (err) {
        console.error("Failed to persist blocked submission:", err);
      }
    }

    res.json({
      blocked: result.blocked,
      category: result.category,
      reason: result.reason,
      ...(result.unavailable ? { unavailable: true } : {}),
    });
  } catch (err) {
    next(err);
  }
});
