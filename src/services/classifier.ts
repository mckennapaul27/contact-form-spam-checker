import { generateText, Output } from "ai";
import { z } from "zod";
import { config } from "../config.js";
import { FIELD_LIMITS } from "../limits.js";
import type { SpamCategory } from "../models/BlockedSubmission.js";
import { spamCategories } from "../models/BlockedSubmission.js";
import { buildClassificationPrompt, SPAM_INSTRUCTIONS } from "../prompts/spam.js";

const DEFAULT_BLOCK_REASON =
  "We couldn't accept this message because it looks like an unsolicited offer of marketing, SEO, or web design services. This contact form is for customers who want to use this business's own services. If that's you, please send a new message describing what you need help with.";

const classificationSchema = z.object({
  isSpam: z.boolean(),
  category: z.enum(spamCategories).nullable(),
  reason: z
    .string()
    .describe(
      "Polite 2–4 sentence message shown on the website when the submission is rejected. Explain the kind of pitch and that the form is for customers only.",
    ),
});

export type CheckInput = {
  website: string;
  message: string;
  name?: string;
  email?: string;
  phone?: string;
  fields?: Record<string, string>;
};

export type ClassificationResult = {
  blocked: boolean;
  category: SpamCategory | null;
  reason: string | null;
  unavailable?: boolean;
};

export async function classifySubmission(
  input: CheckInput,
): Promise<ClassificationResult> {
  try {
    const { output } = await generateText({
      model: config.aiModel,
      instructions: SPAM_INSTRUCTIONS,
      prompt: buildClassificationPrompt(input),
      output: Output.object({ schema: classificationSchema }),
    });

    if (!output) {
      console.error("Classifier returned no structured output");
      return failOpen();
    }

    if (!output.isSpam) {
      return { blocked: false, category: null, reason: null };
    }

    return {
      blocked: true,
      category: output.category ?? "marketing",
      reason: clipReason(output.reason || DEFAULT_BLOCK_REASON),
    };
  } catch (err) {
    console.error("Classifier unavailable:", err);
    return failOpen();
  }
}

function clipReason(reason: string): string {
  if (reason.length <= FIELD_LIMITS.reason) {
    return reason;
  }
  return reason.slice(0, FIELD_LIMITS.reason).trimEnd();
}

function failOpen(): ClassificationResult {
  return {
    blocked: false,
    category: null,
    reason: null,
    unavailable: true,
  };
}
