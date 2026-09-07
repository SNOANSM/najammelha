import { Readable } from "node:stream";
import { Router, type IRouter, type Request, type Response } from "express";
import { RequestUploadUrlBody, RequestUploadUrlResponse } from "@workspace/api-zod";
import { ObjectNotFoundError, ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const storage = new ObjectStorageService();

router.post("/storage/uploads/request-url", async (req: Request, res: Response) => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success || !parsed.data.contentType.startsWith("image/") || parsed.data.size > 8_000_000) {
    res.status(400).json({ error: "الصورة يجب أن تكون بصيغة صالحة وحجمها أقل من 8 ميجابايت." });
    return;
  }
  try {
    const signed = await storage.getUploadUrl();
    res.json(RequestUploadUrlResponse.parse({ ...signed, metadata: parsed.data }));
  } catch (error) {
    req.log.error({ err: error }, "Error generating object upload URL");
    res.status(500).json({ error: "تعذر تجهيز رفع الصورة." });
  }
});

router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const path = `/objects/${Array.isArray(raw) ? raw.join("/") : raw}`;
    const result = await storage.stream(await storage.getObject(path));
    Object.entries(result.headers).forEach(([key, value]) => {
      if (value) res.setHeader(key, value);
    });
    Readable.fromWeb(result.stream as ReadableStream<Uint8Array>).pipe(res);
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "تعذر عرض الصورة." });
  }
});

export default router;