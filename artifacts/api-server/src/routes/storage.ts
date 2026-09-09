import { randomUUID } from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import { getStore } from "@netlify/blobs";
import { UploadImageResponse } from "@workspace/api-zod";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8_000_000 } });

function getUploadsStore() {
  return getStore("uploads");
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
    const arrayBuffer = file.buffer.buffer.slice(file.buffer.byteOffset, file.buffer.byteOffset + file.buffer.byteLength) as ArrayBuffer;
    await getUploadsStore().set(key, arrayBuffer, { metadata: { contentType: file.mimetype } });
    res.json(UploadImageResponse.parse({ objectPath: `/api/storage/objects/${key}` }));
  } catch (error) {
    req.log.error({ err: error }, "Error storing uploaded image");
    res.status(500).json({ error: "تعذر رفع الصورة." });
  }
});

router.get("/storage/objects/:key", async (req: Request, res: Response) => {
  try {
    const result = await getUploadsStore().getWithMetadata(String(req.params.key), { type: "arrayBuffer" });
    if (!result) {
      res.status(404).json({ error: "الصورة غير موجودة." });
      return;
    }
    res.setHeader("Content-Type", (result.metadata.contentType as string) || "application/octet-stream");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.send(Buffer.from(result.data as ArrayBuffer));
  } catch (error) {
    req.log.error({ err: error }, "Error serving uploaded image");
    res.status(500).json({ error: "تعذر عرض الصورة." });
  }
});

export default router;
