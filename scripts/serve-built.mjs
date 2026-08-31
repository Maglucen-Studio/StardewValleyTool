import { createServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { projectRoot } from "./config.mjs";

const port = Number(process.env.PORT || process.argv[2] || 3000);
const host = "127.0.0.1";
const accessToken = process.env.STARDEW_TOOL_TOKEN || "";
const publicRoot = resolve(projectRoot, "dist");
const moduleUrl = pathToFileURL(resolve(publicRoot, "server", "index.js"));
moduleUrl.searchParams.set("desktop", `${Date.now()}`);
const builtApplication = await import(moduleUrl.href);
const handler = builtApplication.default;

const contentTypes = {
  ".css": "text/css; charset=utf-8", ".html": "text/html; charset=utf-8", ".ico": "image/x-icon",
  ".jpeg": "image/jpeg", ".jpg": "image/jpeg", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".svg": "image/svg+xml; charset=utf-8", ".webp": "image/webp", ".woff": "font/woff", ".woff2": "font/woff2",
};

function tokenMatches(candidate) {
  if (!accessToken || !candidate) return false;
  const expected = Buffer.from(accessToken);
  const received = Buffer.from(candidate);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function requestAccess(request) {
  const url = new URL(request.url || "/", `http://${host}:${port}`);
  const header = String(request.headers["x-stardew-tool-token"] || "");
  const cookie = String(request.headers.cookie || "").match(/(?:^|;\s*)stardew_tool_session=([^;]+)/)?.[1] || "";
  const query = url.searchParams.get("desktopToken") || "";
  return { authorized: tokenMatches(header) || tokenMatches(cookie) || tokenMatches(query), establishSession: tokenMatches(query) };
}

function safeFile(url) {
  let pathname;
  try { pathname = decodeURIComponent(new URL(url).pathname).replace(/^\/+/, ""); } catch { return null; }
  const file = resolve(publicRoot, pathname.startsWith("_next/") ? `client/${pathname}` : pathname);
  return file === publicRoot || file.startsWith(`${publicRoot}${sep}`) ? file : null;
}

async function staticResponse(input) {
  const url = typeof input === "string" ? input : input.url;
  const file = safeFile(url);
  if (!file) return new Response("Forbidden", { status: 403 });
  try {
    const info = await stat(file);
    if (!info.isFile()) return new Response("Not found", { status: 404 });
    const body = await readFile(file);
    const hashed = file.includes(`${sep}_next${sep}static${sep}`);
    return new Response(body, { headers: { "content-type": contentTypes[extname(file).toLowerCase()] || "application/octet-stream", "cache-control": hashed ? "public, max-age=31536000, immutable" : "no-cache" } });
  } catch { return new Response("Not found", { status: 404 }); }
}

async function nodeRequest(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const method = request.method || "GET";
  return new Request(`http://${host}:${port}${request.url || "/"}`, {
    method,
    headers: request.headers,
    body: method === "GET" || method === "HEAD" ? undefined : Buffer.concat(chunks),
  });
}

const server = createServer(async (request, response) => {
  try {
    const access = requestAccess(request);
    if (!access.authorized) {
      response.writeHead(403, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
      response.end("This private service can only be opened by Maglucen Stardew Valley Companion.");
      return;
    }
    const direct = await staticResponse(`http://${host}:${port}${request.url || "/"}`);
    const result = direct.status !== 404
      ? direct
      : typeof handler === "function"
        ? await handler(await nodeRequest(request), { ASSETS: { fetch: staticResponse } })
        : await handler.fetch(await nodeRequest(request), { ASSETS: { fetch: staticResponse } }, { waitUntil() {}, passThroughOnException() {} });
    const headers = Object.fromEntries(result.headers.entries());
    if (access.establishSession) headers["set-cookie"] = `stardew_tool_session=${accessToken}; HttpOnly; SameSite=Strict; Path=/`;
    headers["x-stardew-tool-service"] = "authenticated";
    headers["x-content-type-options"] = "nosniff";
    headers["referrer-policy"] = "no-referrer";
    response.writeHead(result.status, headers);
    if (request.method === "HEAD") response.end();
    else response.end(Buffer.from(await result.arrayBuffer()));
  } catch (error) {
    console.error(error);
    response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    response.end("Internal server error");
  }
});

server.listen(port, host, () => console.log(`Maglucen Stardew Valley Companion is ready at http://${host}:${port}/`));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.close(() => process.exit(0)));
