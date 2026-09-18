import { randomUUID } from "node:crypto";
import { Router, type IRouter, type Request, type Response } from "express";
import multer from "multer";
import { eq } from "drizzle-orm";
import { db, reportsTable } from "@workspace/db";
import { UploadImageResponse } from "@workspace/api-zod";
import { UPLOAD_PATH_PREFIX, loadUpload, saveUpload } from "../lib/uploads";

const router: IRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8_000_000 } });

function uploadSingle(req: Request, res: Response): Promise<void> {
  return new Promise((resolve, reject) => {
    upload.single("file")(req, res, (err) => (err ? reject(err) : resolve()));
  });
}

router.post("/storage/upload", async (req: Request, res: Response) => {
  if (!req.authUser) {
    res.status(401).json({ error: "سجّل الدخول أولًا حتى تقدر ترفع الصورة." });
    return;
  }
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
    res.json(UploadImageResponse.parse({ objectPath: `${UPLOAD_PATH_PREFIX}${key}` }));
  } catch (error) {
    req.log.error({ err: error }, "Error storing uploaded image");
    res.status(500).json({ error: "تعذر رفع الصورة." });
  }
});

router.get("/storage/objects/:key", async (req: Request, res: Response) => {
  try {
    const key = String(req.params.key);
    // A photo attached to a report is private: only the reporter and admins may
    // open it, unless the report was resolved and is shown publicly. Anything
    // not attached to a report (e.g. store reward images) stays public.
    const attached = await db.select({ userId: reportsTable.userId, status: reportsTable.status }).from(reportsTable).where(eq(reportsTable.image, `${UPLOAD_PATH_PREFIX}${key}`));
    const isPrivate = attached.length > 0 && !attached.some((report) => report.status === "resolved");
    const allowed = !isPrivate || (req.authUser && (req.authUser.isAdmin || attached.some((report) => report.userId === req.authUser!.id)));
    if (!allowed) {
      res.status(404).json({ error: "الصورة غير موجودة." });
      return;
    }
    const result = await loadUpload(key);
    if (!result) {
      res.status(404).json({ error: "الصورة غير موجودة." });
      return;
    }
    res.setHeader("Content-Type", result.contentType);
    res.setHeader("Cache-Control", isPrivate ? "private, max-age=3600" : "public, max-age=31536000, immutable");
    res.send(result.data);
  } catch (error) {
    req.log.error({ err: error }, "Error serving uploaded image");
    res.status(500).json({ error: "تعذر عرض الصورة." });
  }
});

export default router;
