import { closeSync, existsSync, openSync, readFileSync, readSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
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

// The public path of the sitemap `scripts/build-sitemap.mjs` generates. Visual
// Editor's config schema has no `sitemapUrl` property -- its sitemap surface is
// the `siteMap` function at the bottom of this file -- so the path is declared
// here once and both the file lookup below and that function work from it.
const SITEMAP_URL = "/sitemap.xml";

// Pages that exist in public/ but are not editor destinations. Matched against
// the path relative to public/ (slash-separated), not the bare filename, so an
// `offline.html` added inside a subdirectory still shows up in the sitemap.
const excludedPages = new Set(["offline.html"]);

const HTML_EXTENSION = ".html";
const INDEX_FILE_NAME = "index.html";

// `relative()` emits the platform separator, but a path that came from mixed
// input can still contain `/` on Windows, so split on both. Dropping empty
// segments also collapses `a//b` and any leading separator, which is what keeps
// routes from coming out as `//about`. Discovery only ever passes descendants of
// publicDir, so no `..` segments reach here.
function pageSegments(filePath: string) {
  return relative(publicDir, filePath)
    .split(/[\\/]+/)
    .filter((segment) => segment.length > 0 && segment !== ".");
}

function relativePagePath(filePath: string) {
  return pageSegments(filePath).join("/");
}

function pageRoute(filePath: string) {
  const segments = pageSegments(filePath);
  const fileName = segments.pop();
  if (fileName === undefined) return "/";

  // `index.html` drops out entirely (`about/index.html` -> `/about`); every
  // other page loses just its extension.
  if (fileName.toLowerCase() !== INDEX_FILE_NAME) {
    segments.push(
      fileName.toLowerCase().endsWith(HTML_EXTENSION) ? fileName.slice(0, -HTML_EXTENSION.length) : fileName
    );
  }

  return `/${segments.join("/")}`;
}

// The <title> is always in the first few KB of the document, and some of these
// pages are >150KB, so read a small prefix instead of the whole file. A prefix
// can end mid UTF-8 sequence, but only at the tail — the regex below needs a
// closing tag, so a mangled trailing byte can never land inside a match.
const TITLE_PREFIX_BYTES = 8192;

function readPagePrefix(filePath: string) {
  const buffer = Buffer.alloc(TITLE_PREFIX_BYTES);
  let handle: number | undefined;
  try {
    handle = openSync(filePath, "r");
    return buffer.subarray(0, readSync(handle, buffer, 0, buffer.length, 0)).toString("utf8");
  } catch {
    // A page we cannot read still belongs in the sitemap; fall back to a label
    // derived from its route rather than failing the whole discovery pass.
    return "";
  } finally {
    if (handle !== undefined) closeSync(handle);
  }
}

// `&amp;` is decoded last so an escaped entity such as `&amp;lt;` survives as
// literal text instead of turning into `<`.
function decodeTitleEntities(title: string) {
  return title
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&(?:apos|#0*39);/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&");
}

function pageLabel(filePath: string) {
  const title = readPagePrefix(filePath)
    .match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]
    ?.trim();

  return title ? decodeTitleEntities(title) : pageRoute(filePath);
}

// Routes advertised by the generated sitemap at SITEMAP_URL. Its <loc> values
// are absolute production URLs, so only the pathname is kept, and a trailing
// slash is dropped so `/services/` and `/services` never register as two pages.
function sitemapRoutes(): string[] {
  const sitemapFile = join(publicDir, SITEMAP_URL.replace(/^\/+/, ""));
  if (!existsSync(sitemapFile)) return [];

  let xml: string;
  try {
    xml = readFileSync(sitemapFile, "utf8");
  } catch {
    // An unreadable sitemap should not take the whole editor down; page
    // discovery still has the HTML on disk to work from.
    return [];
  }

  const routes: string[] = [];
  for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/gi)) {
    const location = decodeTitleEntities(match[1].trim());
    let pathname: string;
    try {
      pathname = new URL(location).pathname;
    } catch {
      // A relative or malformed <loc> gives us no route to navigate to.
      continue;
    }
    routes.push(pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname);
  }
  return routes;
}

function collectPages(directory: string): SiteMapEntry[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const filePath = join(directory, entry.name);
    if (entry.isDirectory()) return collectPages(filePath);
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(HTML_EXTENSION)) return [];
    if (excludedPages.has(relativePagePath(filePath))) return [];

    const route = pageRoute(filePath);
    return [{
      urlPath: route,
      label: pageLabel(filePath),
      stableId: `static-page:${route}`,
      ...(route === "/" ? { isHomePage: true } : {})
    }];
  });
}

function discoverPages(): SiteMapEntry[] {
  const routes = new Set<string>();
  const pages: SiteMapEntry[] = [];

  // `about.html` and `about/index.html` resolve to the same route, so keep the
  // first of each and never hand the editor two entries sharing a stableId.
  for (const page of collectPages(publicDir)) {
    if (routes.has(page.urlPath)) continue;
    routes.add(page.urlPath);
    pages.push(page);
  }

  // The generated sitemap is the site's own list of public routes, so anything
  // it advertises that has no HTML on disk yet -- a service or city page whose
  // generator has not run in this checkout -- still belongs in the editor.
  for (const route of sitemapRoutes()) {
    if (routes.has(route)) continue;
    routes.add(route);
    pages.push({
      urlPath: route,
      label: route,
      stableId: `static-page:${route}`,
      ...(route === "/" ? { isHomePage: true } : {})
    });
  }

  return pages.sort((left, right) => left.urlPath.localeCompare(right.urlPath));
}

// Pages that sit under a document-backed prefix but render their own content.
const standalonePageRoutes = new Set(["/services/aging-in-place-guide"]);

// A single path segment only: `/services/painting-staining` is driven by the
// services document, but a future `/services/painting-staining/gallery` is a
// different kind of page and must not be silently mapped onto it.
const SERVICE_DETAIL_ROUTE = /^\/services\/[^/]+$/;
const SERVICE_AREA_ROUTE = /^\/handyman\/[^/]+$/;

// Maps a route to the document that drives its content, so that selecting the
// page in the editor opens the fields that actually render it.
function editableModelForRoute(route: string) {
  if (standalonePageRoutes.has(route)) return null;
  if (route === "/services" || SERVICE_DETAIL_ROUTE.test(route)) return "ServicesData";
  if (route === "/service-areas" || SERVICE_AREA_ROUTE.test(route)) return "ServiceAreasData";
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
      contentDirs: ["public/data", "content"],
      models: [
        ...visualEditorModels,
        {
          name: "Page",
          type: "page",
          urlPath: "/{slug}",
          filePath: "content/pages/{slug}.json",
          fields: [{ name: "title", type: "string", required: true }]
        }
      ],
      assetsConfig: {
        referenceType: "static",
        staticDir: "public",
        uploadDir: "images",
        publicPath: "/"
      }
    })
  ],
  siteMap: ({ documents, getDocuments }) => {
    const availableDocuments = typeof getDocuments === "function" ? getDocuments() : documents;
    const documentsByModel = new Map(availableDocuments.map((document) => [document.modelName, document]));

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
