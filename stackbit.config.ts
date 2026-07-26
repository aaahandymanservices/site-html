import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { GitContentSource } from "@stackbit/cms-git";
import { defineStackbitConfig, type SiteMapEntry } from "@stackbit/types";
import { visualEditorModels } from "./stackbit.models.js";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const publicDir = join(projectRoot, "public");

function pageRoute(filePath: string) {
  const relativePath = relative(publicDir, filePath).split(sep).join("/");
  if (relativePath === "index.html") return "/";
  if (relativePath.endsWith("/index.html")) return `/${relativePath.slice(0, -11)}`;
  return `/${relativePath.slice(0, -5)}`;
}

function pageLabel(filePath: string) {
  const html = readFileSync(filePath, "utf8");
  const title = html.match(/<title>([^<]+)<\/title>/i)?.[1]?.trim();
  return title?.replace(/&amp;/g, "&") ?? pageRoute(filePath);
}

function discoverPages(directory = publicDir): SiteMapEntry[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const filePath = join(directory, entry.name);
      if (entry.isDirectory()) return discoverPages(filePath);
      if (!entry.isFile() || !entry.name.endsWith(".html") || entry.name === "offline.html") return [];

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

function editableModelForRoute(route: string) {
  if (route === "/services" || (route.startsWith("/services/") && route !== "/services/aging-in-place-guide")) {
    return "ServicesData";
  }
  if (route === "/service-areas" || route.startsWith("/handyman/")) return "ServiceAreasData";
  return null;
}

const staticPages = discoverPages();

export default defineStackbitConfig({
  stackbitVersion: "~0.6.0",
  contentSources: [
    new GitContentSource({
      rootPath: projectRoot,
      contentDirs: ["public/data"],
      models: visualEditorModels
    })
  ],
  sitemap: ({ getDocuments }) => {
    const documentsByModel = new Map(getDocuments().map((document) => [document.modelName, document]));

    return staticPages.map((page) => {
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
