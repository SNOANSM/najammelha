import serverless from "serverless-http";
import type { Config, Context } from "@netlify/functions";

// Modern (Request/Response) function, not the classic Lambda-style handler:
// Netlify only exposes the database connection (NETLIFY_DB_URL) through the
// modern runtime's Netlify.env, which @netlify/database reads. The existing
// Express app (routes, cookie auth, middleware) is reused unchanged by feeding
// serverless-http a Lambda-shaped event built from the Request.
export const config: Config = { path: "/api/*" };

type LambdaHandler = (event: unknown, context: unknown) => Promise<{
  statusCode: number;
  headers?: Record<string, string>;
  multiValueHeaders?: Record<string, string[]>;
  body?: string;
  isBase64Encoded?: boolean;
}>;

let handlerPromise: Promise<LambdaHandler> | undefined;

function getHandler() {
  // Loaded lazily so the database module is evaluated inside a request, where
  // Netlify.env is available.
  handlerPromise ??= import("../../artifacts/api-server/src/app").then(
    ({ default: app }) =>
      serverless(app, {
        binary: (headers: Record<string, unknown>) => {
          const type = String(headers["content-type"] ?? "");
          return type !== "" && !/^(text\/|application\/(json|javascript|xml))/.test(type);
        },
      }) as unknown as LambdaHandler,
  );
  return handlerPromise;
}

export default async function handler(req: Request, context: Context) {
  const url = new URL(req.url);
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const body = hasBody ? Buffer.from(await req.arrayBuffer()) : undefined;
  const query = Object.fromEntries(url.searchParams);
  const multiQuery: Record<string, string[]> = {};
  for (const [key, value] of url.searchParams) (multiQuery[key] ??= []).push(value);

  const result = await (await getHandler())(
    {
      httpMethod: req.method,
      path: url.pathname,
      headers: Object.fromEntries(req.headers),
      multiValueHeaders: {},
      queryStringParameters: query,
      multiValueQueryStringParameters: multiQuery,
      body: body && body.length ? body.toString("base64") : null,
      isBase64Encoded: true,
      requestContext: {},
    },
    context,
  );

  const headers = new Headers();
  for (const [key, values] of Object.entries(result.multiValueHeaders ?? {})) for (const value of values) headers.append(key, value);
  for (const [key, value] of Object.entries(result.headers ?? {})) if (!headers.has(key)) headers.set(key, value);
  const payload = result.body ? (result.isBase64Encoded ? Buffer.from(result.body, "base64") : result.body) : null;
  const status = result.statusCode;
  return new Response(status === 204 || status === 304 ? null : payload, { status, headers });
}
