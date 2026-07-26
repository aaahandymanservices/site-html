import { closeSync, existsSync, openSync, readSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { GitContentSource } from "@stackbit/cms-git";
import { defineStackbitConfig, type SiteMapEntry } from "@stackbit/types";
import { visualEditorModels } from "./stackbit.models.js";

// Visual Editor bundles this file into .stackbit/cache and imports it from
// there, so `import.meta.url` resolves to the cache directory rather than the
// repository. Its loader substitutes `__dirname` with the real project
// directory, and the presence of this config file is what confirms we found it.
function resolveProjectRoot() {
  const candidates = [typeof __dirname === "string" ? __dirname : null, process.cwd()];
  for (const candidate of candidates) {
    if (candidate && existsSync(join(candidate, "stackbit.config.ts"))) return candidate;
  }
  throw new Error("Unable to locate the project root: no stackbit.config.ts found next to the config or in the working directory.");
}

const projectRoot = resolveProjectRoot();
const publicDir = join(projectRoot, "public");

// Pages that exist in public/ but are not editor destinations.
const excludedPages = new Set(["offline.html"]);

function pageRoute(filePath: string) {
  const relativePath = relative(publicDir, filePath).split(sep).join("/");
  if (relativePath === "index.html") return "/";
  if (relativePath.endsWith("/index.html")) return `/${relativePath.slice(0, -11)}`;
  return `/${relativePath.slice(0, -5)}`;
}

// The <title> is always in the first few KB of the document, and some of these
// pages are >150KB, so read a small prefix instead of the whole file.
function pageLabel(filePath: string) {
  const buffer = Buffer.alloc(4096);
  const handle = openSync(filePath, "r");
  let head: string;
  try {
    head = buffer.subarray(0, readSync(handle, buffer, 0, buffer.length, 0)).toString("utf8");
  } finally {
    closeSync(handle);
  }

  const title = head.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim();
  return title?.replace(/&amp;/g, "&") ?? pageRoute(filePath);
}

function discoverPages(directory = publicDir): SiteMapEntry[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const filePath = join(directory, entry.name);
      if (entry.isDirectory()) return discoverPages(filePath);
      if (!entry.isFile() || !entry.name.endsWith(".html") || excludedPages.has(entry.name)) return [];

      const route = pageRoute(filePath);
      return [{
        urlPath: route,
        label: pageLabel(filePath),
        stableId: `static-page:${route}`,
        ...(route === "/" ? { isHomePage: true } : {})
      }];
    })
    .sort((left, right) => left.urlPath.localeCompare(right.urlPath));
}

// Maps a route to the document that drives its content, so that selecting the
// page in the editor opens the fields that actually render it.
function editableModelForRoute(route: string) {
  if (route === "/services" || (route.startsWith("/services/") && route !== "/services/aging-in-place-guide")) {
    return "ServicesData";
  }
  if (route === "/service-areas" || route.startsWith("/handyman/")) return "ServiceAreasData";
  if (route === "/rates") return "QuoteTasksData";
  return null;
}

export default defineStackbitConfig({
  stackbitVersion: "~0.6.0",
  // package.json declares "type": "module", so compile this config as ESM too.
  useESM: true,
  ssgName: "custom",
  nodeVersion: "20",
  devCommand: "node ./scripts/visual-editor-server.mjs --port {PORT} --hostname {HOSTNAME}",
  experimental: {
    ssg: {
      name: "custom",
      logPatterns: { up: ["Visual Editor preview ready"] }
    }
  },
  contentSources: [
    new GitContentSource({
      rootPath: projectRoot,
      contentDirs: ["public/data"],
      models: visualEditorModels,
      assetsConfig: {
        referenceType: "static",
        staticDir: "public",
        uploadDir: "images",
        publicPath: "/"
      }
    })
  ],
  sitemap: ({ getDocuments }) => {
    const documentsByModel = new Map(getDocuments().map((document) => [document.modelName, document]));

    // Discovered on every call so pages regenerated from a content edit show up
    // without restarting the editor.
    return discoverPages().map((page) => {
      const modelName = editableModelForRoute(page.urlPath);
      const document = modelName ? documentsByModel.get(modelName) : undefined;
      if (!document) return page;

      return {
        ...page,
        document: {
          id: document.id,
          modelName: document.modelName,
          srcType: document.srcType,
          srcProjectId: document.srcProjectId
        }
      };
    });
  }
});
