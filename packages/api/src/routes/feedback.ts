import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import { parse } from "csv-parse/sync";
import multer from "multer";

const prisma = new PrismaClient();
const upload = multer({ storage: multer.memoryStorage() });
export const feedbackRouter = Router();

// Schema for feedback items
const feedbackSchema = z.object({
  content: z.string().min(1),
  author: z.string().optional(),
  authorEmail: z.string().email().optional(),
  channel: z.string().optional(),
  externalId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

// POST /api/feedback - Add single feedback item
feedbackRouter.post("/", async (req, res) => {
  try {
    const data = feedbackSchema.parse(req.body);

    // Create or get default source
    const source = await prisma.feedbackSource.upsert({
      where: { id: "api-default" },
      update: {},
      create: { id: "api-default", name: "API", type: "api" },
    });

    const item = await prisma.feedbackItem.create({
      data: {
        ...data,
        sourceId: source.id,
      },
    });

    res.status(201).json(item);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: err.errors });
    }
    throw err;
  }
});

// POST /api/feedback/bulk - Add multiple feedback items
feedbackRouter.post("/bulk", async (req, res) => {
  try {
    const items = z.array(feedbackSchema).parse(req.body);

    const source = await prisma.feedbackSource.upsert({
      where: { id: "api-bulk" },
      update: {},
      create: { id: "api-bulk", name: "Bulk API", type: "api" },
    });

    const created = await prisma.feedbackItem.createMany({
      data: items.map((item) => ({ ...item, sourceId: source.id })),
    });

    res.status(201).json({ count: created.count });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation failed", details: err.errors });
    }
    throw err;
  }
});

// POST /api/feedback/import/csv - Import from CSV file
feedbackRouter.post("/import/csv", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const csvContent = req.file.buffer.toString("utf-8");
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    if (records.length === 0) {
      return res.status(400).json({ error: "CSV file is empty" });
    }

    // Auto-detect the content column
    const firstRow = records[0];
    const contentColumn =
      Object.keys(firstRow).find((key) =>
        ["content", "feedback", "text", "message", "comment", "body", "description"].includes(
          key.toLowerCase()
        )
      ) || Object.keys(firstRow)[0];

    const source = await prisma.feedbackSource.create({
      data: {
        name: `CSV Import - ${req.file.originalname}`,
        type: "csv",
        config: { filename: req.file.originalname, columns: Object.keys(firstRow) },
      },
    });

    const items = records
      .filter((row: Record<string, string>) => row[contentColumn]?.trim())
      .map((row: Record<string, string>) => ({
        content: row[contentColumn].trim(),
        author: row["author"] || row["name"] || row["user"] || undefined,
        authorEmail: row["email"] || row["author_email"] || undefined,
        channel: row["channel"] || row["source"] || row["type"] || "csv",
        sourceId: source.id,
        metadata: row,
      }));

    const created = await prisma.feedbackItem.createMany({ data: items });

    res.status(201).json({
      count: created.count,
      source: source.id,
      contentColumn,
      message: `Imported ${created.count} feedback items from ${req.file.originalname}`,
    });
  } catch (err) {
    console.error("CSV import error:", err);
    res.status(500).json({ error: "Failed to import CSV" });
  }
});

// GET /api/feedback - List feedback items
feedbackRouter.get("/", async (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const processed = req.query.processed === "true" ? true : req.query.processed === "false" ? false : undefined;

  const [items, total] = await Promise.all([
    prisma.feedbackItem.findMany({
      where: processed !== undefined ? { processed } : undefined,
      include: {
        source: { select: { name: true, type: true } },
        themes: { include: { theme: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.feedbackItem.count({
      where: processed !== undefined ? { processed } : undefined,
    }),
  ]);

  res.json({
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// GET /api/feedback/stats - Get feedback statistics
feedbackRouter.get("/stats", async (_req, res) => {
  const [total, processed, unprocessed, sources, channels] = await Promise.all([
    prisma.feedbackItem.count(),
    prisma.feedbackItem.count({ where: { processed: true } }),
    prisma.feedbackItem.count({ where: { processed: false } }),
    prisma.feedbackSource.findMany({
      include: { _count: { select: { feedbackItems: true } } },
    }),
    prisma.feedbackItem.groupBy({
      by: ["channel"],
      _count: { id: true },
    }),
  ]);

  res.json({ total, processed, unprocessed, sources, channels });
});
