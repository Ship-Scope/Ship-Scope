import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";

import { feedbackRouter } from "./routes/feedback";
import { synthesisRouter } from "./routes/synthesis";
import { proposalRouter } from "./routes/proposals";
import { specRouter } from "./routes/specs";
import { healthRouter } from "./routes/health";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.APP_URL || "http://localhost:3000" }));
app.use(express.json({ limit: "50mb" }));

// Routes
app.use("/api/health", healthRouter);
app.use("/api/feedback", feedbackRouter);
app.use("/api/synthesis", synthesisRouter);
app.use("/api/proposals", proposalRouter);
app.use("/api/specs", specRouter);

// Error handler
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(err.stack);
    res.status(500).json({ error: "Internal server error" });
  }
);

app.listen(PORT, () => {
  console.log(`
  ┌─────────────────────────────────────┐
  │                                     │
  │   ShipScope API v0.1.0              │
  │   Running on http://localhost:${PORT}  │
  │                                     │
  └─────────────────────────────────────┘
  `);
});

export default app;
