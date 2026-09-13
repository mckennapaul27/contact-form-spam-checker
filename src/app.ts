import express from "express";
import { requireApiKey } from "./middleware/auth.js";
import { blockedRouter } from "./routes/blocked.js";
import { checkRouter } from "./routes/check.js";

export const app = express();

app.use(express.json({ limit: "100kb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/v1/check", requireApiKey, checkRouter);
app.use("/v1/blocked", requireApiKey, blockedRouter);

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  },
);
