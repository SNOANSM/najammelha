import { randomUUID } from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import { getStore } from "@netlify/blobs";
import { eq } from "drizzle-orm";
import { db, uploadsTable } from "@workspace/db";
import { UploadImageResponse } from "@workspace/api-zod";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8_000_000 } });

// Netlify Blobs only works inside a Netlify Functions runtime context, which
// Netlify sets NETLIFY=true for. On any other host (Railway, local dev) we
// fall back to storing the upload as base64 in Postgres, which is already
// provisioned everywhere this API runs.
const useNetlifyBlobs = process.env.NETLIFY === "true";

function getUploadsStore() {
  return getStore("uploads");
}

async function saveUpload(key: string, buffer: Buffer, contentType: string) {
  if (useNetlifyBlobs) {
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    await getUploadsStore().set(key, arrayBuffer, { metadata: { contentType } });
    return;
  }
  await db.insert(uploadsTable).values({ id: key, contentType, data: buffer.toString("base64") });
}

async function loadUpload(key: string): Promise<{ data: Buffer; contentType: string } | null> {
  if (useNetlifyBlobs) {
    const result = await getUploadsStore().getWithMetadata(key, { type: "arrayBuffer" });
    if (!result) return null;
    return { data: Buffer.from(result.data as ArrayBuffer), contentType: (result.metadata.contentType as string) || "application/octet-stream" };
  }
  const [row] = await db.select().from(uploadsTable).where(eq(uploadsTable.id, key)).limit(1);
  if (!row) return null;
  return { data: Buffer.from(row.data, "base64"), contentType: row.contentType };
}

function uploadSingle(req: Request, res: Response): Promise<void> {
  return new Promise((resolve, reject) => {
    upload.single("file")(req, res, (err) => (err ? reject(err) : resolve()));
  });
}

router.post("/storage/upload", async (req: Request, res: Response) => {
  try {
    await uploadSingle(req, res);
  } catch {
    res.status(400).json({ error: "الصورة يجب أن تكون بصيغة صالحة وحجمها أقل من 8 ميجابايت." });
    return;
  }
  const file = req.file;
  if (!file || !file.mimetype.startsWith("image/")) {
    res.status(400).json({ error: "الصورة يجب أن تكون بصيغة صالحة وحجمها أقل من 8 ميجابايت." });
    return;
  }
  try {
    const key = randomUUID();
    await saveUpload(key, file.buffer, file.mimetype);
    res.json(UploadImageResponse.parse({ objectPath: `/api/storage/objects/${key}` }));
  } catch (error) {
    req.log.error({ err: error }, "Error storing uploaded image");
    res.status(500).json({ error: "تعذر رفع الصورة." });
  }
});

router.get("/storage/objects/:key", async (req: Request, res: Response) => {
  try {
    const result = await loadUpload(String(req.params.key));
    if (!result) {
      res.status(404).json({ error: "الصورة غير موجودة." });
      return;
    }
    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.send(result.data);
  } catch (error) {
    req.log.error({ err: error }, "Error serving uploaded image");
    res.status(500).json({ error: "تعذر عرض الصورة." });
  }
});

export default router;
