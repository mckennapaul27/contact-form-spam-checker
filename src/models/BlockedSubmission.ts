import mongoose, { Schema } from "mongoose";

export const spamCategories = ["marketing", "seo", "web_design"] as const;
export type SpamCategory = (typeof spamCategories)[number];

const blockedSubmissionSchema = new Schema(
  {
    website: { type: String, required: true },
    name: { type: String },
    email: { type: String },
    phone: { type: String },
    message: { type: String, required: true },
    fields: { type: Schema.Types.Mixed },
    category: { type: String, enum: spamCategories, required: true },
    reason: { type: String, required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

blockedSubmissionSchema.index({ website: 1, createdAt: -1 });

export const BlockedSubmission = mongoose.model(
  "BlockedSubmission",
  blockedSubmissionSchema,
);
