import type { RequestHandler } from "express";

/**
 * Browsers treat "localhost" and "127.0.0.1" as different sites, so a page
 * opened on localhost has no session and sign-in fails with "Invalid origin"
 * on a 127.0.0.1-bound server. Send page loads to the trusted address instead.
 * API, MCP and non-GET requests are untouched.
 */
export function loopbackCanonicalHost(bindHost: string | undefined): RequestHandler {
  const canonical = bindHost === "127.0.0.1" ? "127.0.0.1" : null;
  return (req, res, next) => {
    if (!canonical || (req.method !== "GET" && req.method !== "HEAD")) return next();
    const host = req.headers.host ?? "";
    const match = /^localhost(:\d+)?$/i.exec(host);
    if (!match || req.path.startsWith("/api") || req.path.startsWith("/mcp") || req.path.startsWith("/.well-known")) return next();
    res.redirect(302, `${req.protocol}://${canonical}${match[1] ?? ""}${req.originalUrl}`);
  };
}
