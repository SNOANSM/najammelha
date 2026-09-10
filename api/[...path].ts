// Vercel Node function entry point. An Express app is itself a valid
// (req, res) handler, so re-exporting it here is enough — no adapter needed.
// This file lives outside artifacts/api-server so it isn't picked up by that
// package's own esbuild bundle (used by the Railway/Netlify deploy targets).
import app from "../artifacts/api-server/src/app";

export default app;
