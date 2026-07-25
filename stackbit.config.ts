import { defineStackbitConfig } from "@stackbit/types";
import type { SiteMapEntry } from "@stackbit/types";
import { GitContentSource } from "@stackbit/cms-git";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { visualEditorModels } from "./stackbit.models";

function getHttpsRepositoryUrl() {
  const repositoryUrl = process.env.REPOSITORY_URL;

  if (!repositoryUrl) {
    return undefined;
  }

  const sshMatch = repositoryUrl.match(/^git@([^:]+):(.+)$/);
  if (sshMatch) {
    return `https://${sshMatch[1]}/${sshMatch[2]}`;
  }

  try {
    const url = new URL(repositoryUrl);
    url.protocol = "https:";
    url.username = "";
    url.password = "";
    return url.toString();
  } catch {
    return undefined;
  }
}

const repositoryUrl = getHttpsRepositoryUrl();
const repositoryBranch = process.env.BRANCH ?? "main";

const staticPages = [
  { urlPath: "/", label: "Home", stableId: "home", isHomePage: true },
  { urlPath: "/services", label: "Services", stableId: "services-index" },
  { urlPath: "/service-areas", label: "Service Areas", stableId: "service-areas-index" },
  { urlPath: "/rates", label: "Rates", stableId: "rates" },
  { urlPath: "/guarantee", label: "Guarantee", stableId: "guarantee" },
  { urlPath: "/reviews", label: "Reviews", stableId: "reviews" },
  { urlPath: "/careers", label: "Careers", stableId: "careers" },
  { urlPath: "/contact", label: "Contact", stableId: "contact" },
  { urlPath: "/book", label: "Book", stableId: "book" },
  { urlPath: "/privacy", label: "Privacy", stableId: "privacy" },
  { urlPath: "/terms", label: "Terms", stableId: "terms" }
];

function readJsonFile(fileName: string) {
  return JSON.parse(readFileSync(join(__dirname, "public", "data", fileName), "utf8"));
}

export default defineStackbitConfig({
  stackbitVersion: "~0.6.0",
  ssgName: "custom",
  nodeVersion: "18",
  devCommand: "node scripts/visual-editor-server.mjs --hostname {HOSTNAME} --port {PORT}",
  contentSources: [
    new GitContentSource({
      rootPath: __dirname,
      contentDirs: ["public/data"],
      models: visualEditorModels,
      ...(repositoryUrl
        ? {
            localDevSync: {
              repoUrl: repositoryUrl,
              repoWorkingBranch: process.env.HEAD ?? repositoryBranch,
              repoPublishBranch: repositoryBranch
            }
          }
        : {}),
      assetsConfig: {
        referenceType: "static",
        staticDir: "public",
        uploadDir: "images",
        publicPath: "/"
      }
    })
  ],
  sitemap: ({ documents }) => {
    const servicesDocument = documents.find((document) => document.modelName === "ServicesData");
    const serviceAreasDocument = documents.find((document) => document.modelName === "ServiceAreasData");
    const entries: SiteMapEntry[] = [...staticPages];

    if (servicesDocument) {
      const servicesData = readJsonFile("services.json");
      for (const service of servicesData.services ?? []) {
        entries.push({
          urlPath: `/services/${service.slug}`,
          label: service.name,
          stableId: `service-${service.slug}`,
          document: {
            srcType: servicesDocument.srcType,
            srcProjectId: servicesDocument.srcProjectId,
            modelName: servicesDocument.modelName,
            id: servicesDocument.id
          }
        });
      }
    }

    if (serviceAreasDocument) {
      const serviceAreasData = readJsonFile("service-areas.json");
      for (const city of serviceAreasData.cities ?? []) {
        entries.push({
          urlPath: `/handyman/${city.slug}`,
          label: `${city.name} Handyman Services`,
          stableId: `city-${city.slug}`,
          document: {
            srcType: serviceAreasDocument.srcType,
            srcProjectId: serviceAreasDocument.srcProjectId,
            modelName: serviceAreasDocument.modelName,
            id: serviceAreasDocument.id
          }
        });
      }
    }

    return entries;
  }
});
