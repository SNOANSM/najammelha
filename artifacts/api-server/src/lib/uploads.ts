import { getStore } from "@netlify/blobs";
import { eq } from "drizzle-orm";
import { db, uploadsTable } from "@workspace/db";

// Netlify Blobs only works inside a Netlify Functions runtime context, which
// Netlify sets NETLIFY=true for. On any other host (Railway, local dev) we
// fall back to storing the upload as base64 in Postgres, which is already
// provisioned everywhere this API runs.
const useNetlifyBlobs = process.env.NETLIFY === "true";

function getUploadsStore() {
  return getStore("uploads");
}

export async function saveUpload(key: string, buffer: Buffer, contentType: string) {
  if (useNetlifyBlobs) {
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
    await getUploadsStore().set(key, arrayBuffer, { metadata: { contentType } });
    return;
  }
  await db.insert(uploadsTable).values({ id: key, contentType, data: buffer.toString("base64") });
}

export async function loadUpload(key: string): Promise<{ data: Buffer; contentType: string } | null> {
  if (useNetlifyBlobs) {
    const result = await getUploadsStore().getWithMetadata(key, { type: "arrayBuffer" });
    if (!result) return null;
    return { data: Buffer.from(result.data as ArrayBuffer), contentType: (result.metadata.contentType as string) || "application/octet-stream" };
  }
  const [row] = await db.select().from(uploadsTable).where(eq(uploadsTable.id, key)).limit(1);
  if (!row) return null;
  return { data: Buffer.from(row.data, "base64"), contentType: row.contentType };
}

export const UPLOAD_PATH_PREFIX = "/api/storage/objects/";

export function uploadKeyFromPath(objectPath: string): string | null {
  return objectPath.startsWith(UPLOAD_PATH_PREFIX) ? objectPath.slice(UPLOAD_PATH_PREFIX.length) : null;
}
