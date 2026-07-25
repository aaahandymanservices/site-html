import { createReadStream, existsSync, statSync, watch } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const PUBLIC_DIR = join(ROOT, "public");
const DATA_DIR = join(PUBLIC_DIR, "data");

const MIME_TYPES = {
  ".avif": "image/avif",
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".webp": "image/webp",
  ".woff2": "font/woff2"
};

function getOption(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const hostname = getOption("hostname", "127.0.0.1");
const port = Number(getOption("port", "8889"));

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("The Visual Editor server requires a valid --port value.");
}

function resolvePublicPath(pathname) {
  const decodedPath = decodeURIComponent(pathname);
  const normalizedPath = normalize(decodedPath).replace(/^([/\\])+/, "");
  const filePath = resolve(PUBLIC_DIR, normalizedPath);
  if (filePath !== PUBLIC_DIR && !filePath.startsWith(`${PUBLIC_DIR}${sep}`)) {
    return null;
  }
  return filePath;
}

function findStaticFile(pathname) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const basePath = resolvePublicPath(requestedPath);
  if (!basePath) return null;

  const candidates = [basePath];
  if (!extname(basePath)) {
    candidates.push(`${basePath}.html`, join(basePath, "index.html"));
  }

  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function sendFile(request, response, filePath) {
  const stat = statSync(filePath);
  response.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Length": stat.size,
    "Content-Type": MIME_TYPES[extname(filePath).toLowerCase()] ?? "application/octet-stream"
  });
  if (request.method === "HEAD") {
    response.end();
    return;
  }
  createReadStream(filePath).pipe(response);
}

const server = createServer((request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end("Method Not Allowed");
    return;
  }

  try {
    const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
    const pathname = requestUrl.pathname === "/.netlify/images"
      ? requestUrl.searchParams.get("url") ?? ""
      : requestUrl.pathname;
    const filePath = findStaticFile(pathname);

    if (!filePath) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not Found");
      return;
    }

    sendFile(request, response, filePath);
  } catch {
    response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Bad Request");
  }
});

const generationTasks = {
  "service-areas.json": [
    "scripts/build-service-pages.mjs",
    "scripts/build-city-pages.mjs",
    "scripts/build-chat-knowledge.mjs",
    "scripts/build-sitemap.mjs"
  ],
  "services.json": [
    "scripts/build-service-pages.mjs",
    "scripts/build-chat-knowledge.mjs",
    "scripts/build-sitemap.mjs"
  ]
};

let queuedTasks = new Set();
let generationRunning = false;
let debounceTimer;

function runScript(scriptPath) {
  return new Promise((resolveTask, rejectTask) => {
    const child = spawn(process.execPath, [join(ROOT, scriptPath)], {
      cwd: ROOT,
      stdio: "inherit"
    });
    child.once("error", rejectTask);
    child.once("exit", (code) => {
      if (code === 0) resolveTask();
      else rejectTask(new Error(`${scriptPath} exited with code ${code}`));
    });
  });
}

async function flushGenerationQueue() {
  if (generationRunning || queuedTasks.size === 0) return;
  generationRunning = true;
  const tasks = [...queuedTasks];
  queuedTasks = new Set();

  try {
    for (const task of tasks) await runScript(task);
  } catch (error) {
    console.error("Visual Editor content regeneration failed:", error.message);
  } finally {
    generationRunning = false;
    if (queuedTasks.size > 0) void flushGenerationQueue();
  }
}

const dataWatcher = watch(DATA_DIR, (_eventType, filename) => {
  const tasks = generationTasks[String(filename)] ?? [];
  for (const task of tasks) queuedTasks.add(task);
  if (tasks.length === 0) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => void flushGenerationQueue(), 150);
});

server.listen(port, hostname, () => {
  console.log(`Visual Editor preview ready at http://${hostname}:${port}`);
});

function closeServer() {
  dataWatcher.close();
  server.close();
}

process.once("SIGINT", closeServer);
process.once("SIGTERM", closeServer);
