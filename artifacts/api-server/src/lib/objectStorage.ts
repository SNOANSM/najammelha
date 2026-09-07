import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { File, Storage } from "@google-cloud/storage";

const SIDECAR = "http://127.0.0.1:1106";
export const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${SIDECAR}/token`,
    type: "external_account",
    credential_source: {
      url: `${SIDECAR}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
  }
}

function parseObjectPath(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const [, bucketName, ...rest] = normalized.split("/");
  if (!bucketName || rest.length === 0) throw new Error("Invalid object path");
  return { bucketName, objectName: rest.join("/") };
}

async function signObjectUrl(bucketName: string, objectName: string) {
  const response = await fetch(`${SIDECAR}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: bucketName,
      object_name: objectName,
      method: "PUT",
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Failed to sign upload URL: ${response.status}`);
  const data = (await response.json()) as { signed_url: string };
  return data.signed_url;
}

export class ObjectStorageService {
  private getPrivateDir() {
    const dir = process.env.PRIVATE_OBJECT_DIR;
    if (!dir) throw new Error("PRIVATE_OBJECT_DIR is not configured");
    return dir.replace(/\/$/, "");
  }

  async getUploadUrl() {
    const fullPath = `${this.getPrivateDir()}/uploads/${randomUUID()}`;
    const { bucketName, objectName } = parseObjectPath(fullPath);
    return {
      uploadURL: await signObjectUrl(bucketName, objectName),
      objectPath: `/objects/${objectName.replace(/^uploads\//, "uploads/")}`,
    };
  }

  async getObject(objectPath: string): Promise<File> {
    if (!objectPath.startsWith("/objects/")) throw new ObjectNotFoundError();
    const fullPath = `${this.getPrivateDir()}/${objectPath.slice("/objects/".length)}`;
    const { bucketName, objectName } = parseObjectPath(fullPath);
    const file = objectStorageClient.bucket(bucketName).file(objectName);
    const [exists] = await file.exists();
    if (!exists) throw new ObjectNotFoundError();
    return file;
  }

  async stream(file: File) {
    const [metadata] = await file.getMetadata();
    return {
      headers: {
        "Content-Type": metadata.contentType ?? "application/octet-stream",
        "Content-Length": String(metadata.size ?? ""),
        "Cache-Control": "private, max-age=3600",
      },
      stream: Readable.toWeb(file.createReadStream()) as ReadableStream,
    };
  }
}