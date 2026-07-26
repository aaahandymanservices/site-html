import { createReadStream, existsSync, readFileSync, statSync, watch } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve, sep } from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const PUBLIC_DIR = join(ROOT, "public");
const DATA_DIR = join(PUBLIC_DIR, "data");
const STATUS_PATH = "/__visual-editor/status";

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

// Visual Editor substitutes the {HOSTNAME} and {PORT} tokens in devCommand. If
// the host token ever arrives unsubstituted, bind every interface rather than
// crash -- an unreachable preview surfaces as "refused to connect".
const requestedHostname = getOption("hostname", "0.0.0.0");
const hostname = /[{}]/.test(requestedHostname) ? "0.0.0.0" : requestedHostname;
const port = Number(getOption("port", "8889"));

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("The Visual Editor server requires a valid --port value.");
}

// Regenerating the static pages after a content edit takes a few seconds, so the
// preview tracks a revision that only advances once the generators have run. The
// injected bridge below waits for it before reloading, otherwise the editor
// would refresh into the pre-edit HTML.
let contentRevision = 0;
let generationRunning = false;
let lastGenerationError = null;

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

// Listens for the change event Visual Editor dispatches after a content update,
// suppresses its own immediate refresh, and reloads once this server reports the
// regenerated HTML is on disk.
function bridgeScript(revision) {
  return `<script data-visual-editor-bridge>
(() => {
  const STATUS_URL = ${JSON.stringify(STATUS_PATH)};
  const BASELINE = ${revision};
  const TIMEOUT_MS = 30000;
  const POLL_MS = 200;
  let pending = false;

  const readStatus = () => fetch(STATUS_URL, { cache: "no-store" })
    .then((response) => (response.ok ? response.json() : null))
    .catch(() => null);

  const wait = (ms) => new Promise((done) => setTimeout(done, ms));

  async function reloadWhenRegenerated() {
    if (pending) return;
    pending = true;
    const deadline = Date.now() + TIMEOUT_MS;

    while (Date.now() < deadline) {
      const status = await readStatus();
      if (status && !status.building && status.revision > BASELINE) {
        if (status.lastError) {
          console.warn("[visual-editor] page regeneration failed:", status.lastError);
        }
        break;
      }
      await wait(POLL_MS);
    }

    window.location.reload();
  }

  window.addEventListener("stackbitObjectsChanged", (event) => {
    event.preventDefault();
    void reloadWhenRegenerated();
  });
})();
</script>`;
}

// A caching service worker in a live-editing preview only serves stale content,
// so previews get a transparent stub instead. Production still ships public/sw.js.
const SERVICE_WORKER_STUB = `// Visual Editor preview stub -- intentionally no fetch handler.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});
`;

function sendText(request, response, body, contentType) {
  const buffer = Buffer.from(body, "utf8");
  response.writeHead(200, {
    "Cache-Control": "no-store",
    "Content-Length": buffer.byteLength,
    "Content-Type": contentType
  });
  response.end(request.method === "HEAD" ? undefined : buffer);
}

function sendFile(request, response, filePath) {
  if (extname(filePath).toLowerCase() === ".html") {
    const html = readFileSync(filePath, "utf8");
    const script = bridgeScript(contentRevision);
    const closingBody = html.lastIndexOf("</body>");
    const withBridge = closingBody === -1
      ? html + script
      : `${html.slice(0, closingBody)}${script}${html.slice(closingBody)}`;
    sendText(request, response, withBridge, MIME_TYPES[".html"]);
    return;
  }

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

    if (requestUrl.pathname === STATUS_PATH) {
      const status = { revision: contentRevision, building: generationRunning, lastError: lastGenerationError };
      sendText(request, response, JSON.stringify(status), MIME_TYPES[".json"]);
      return;
    }

    if (requestUrl.pathname === "/sw.js") {
      sendText(request, response, SERVICE_WORKER_STUB, MIME_TYPES[".js"]);
      return;
    }

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
  ],
  // Read straight from the browser by the quote calculator: nothing to rebuild,
  // but the preview still needs to reload.
  "quote-tasks.json": []
};

let queuedTasks = new Set();
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
  if (generationRunning) return;
  generationRunning = true;
  const tasks = [...queuedTasks];
  queuedTasks = new Set();

  try {
    for (const task of tasks) await runScript(task);
    lastGenerationError = null;
  } catch (error) {
    lastGenerationError = error.message;
    console.error("Visual Editor content regeneration failed:", error.message);
  } finally {
    generationRunning = false;
    // Advance the revision either way: the content did change, so the preview
    // should reload and surface whatever the generators produced.
    contentRevision += 1;
    if (queuedTasks.size > 0) void flushGenerationQueue();
  }
}

const dataWatcher = watch(DATA_DIR, (_eventType, filename) => {
  const tasks = generationTasks[String(filename)];
  if (!tasks) return;
  for (const task of tasks) queuedTasks.add(task);
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => void flushGenerationQueue(), 150);
});

server.listen(port, hostname, () => {
  console.log(`Visual Editor preview ready at http://${hostname}:${port}`);
});

function closeServer() {
  clearTimeout(debounceTimer);
  dataWatcher.close();
  server.close();
}

process.once("SIGINT", closeServer);
process.once("SIGTERM", closeServer);
