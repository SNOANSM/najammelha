import serverless from "serverless-http";
import app from "../../artifacts/api-server/src/app";

// Classic (Lambda-style) handler, not the newer Request/Response function
// format: this wraps the existing Express app (routes, cookie-based auth,
// middleware) as-is via serverless-http, which needs the AWS-style
// (event, context) signature. Routed to /api/* via netlify.toml redirects.
export const handler = serverless(app);
