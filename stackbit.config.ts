import { defineStackbitConfig } from "@stackbit/types";
import type { SiteMapEntry } from "@stackbit/types";
import { GitContentSource } from "@stackbit/cms-git";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { visualEditorModels } from "./stackbit.models";

const staticPages = [
  { urlPath: "/", label: "Home", stableId: "home", isHomePage: true },
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

function documentReference(document: {
  srcType: string;
  srcProjectId: string;
  modelName: string;
  id: string;
}) {
  return {
    srcType: document.srcType,
    srcProjectId: document.srcProjectId,
    modelName: document.modelName,
    id: document.id
  };
}

export default defineStackbitConfig({
  stackbitVersion: "~0.6.0",
  ssgName: "custom",
  nodeVersion: "18",
  devCommand: "npm run dev -- --hostname {HOSTNAME} --port {PORT}",
  contentSources: [
    new GitContentSource({
      rootPath: __dirname,
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
    const documents = getDocuments();
    const servicesDocument = documents.find((document) => document.modelName === "ServicesData");
    const serviceAreasDocument = documents.find((document) => document.modelName === "ServiceAreasData");
    const entries: SiteMapEntry[] = [...staticPages];

    if (servicesDocument) {
      const document = documentReference(servicesDocument);
      const servicesData = readJsonFile("services.json");
      entries.push({
        urlPath: "/services",
        label: "Services",
        stableId: "services-index",
        document
      });
      for (const service of servicesData.services ?? []) {
        entries.push({
          urlPath: `/services/${service.slug}`,
          label: service.name,
          stableId: `service-${service.slug}`,
          document
        });
      }
    } else {
      entries.push({ urlPath: "/services", label: "Services", stableId: "services-index" });
    }

    if (serviceAreasDocument) {
      const document = documentReference(serviceAreasDocument);
      const serviceAreasData = readJsonFile("service-areas.json");
      entries.push({
        urlPath: "/service-areas",
        label: "Service Areas",
        stableId: "service-areas-index",
        document
      });
      for (const city of serviceAreasData.cities ?? []) {
        entries.push({
          urlPath: `/handyman/${city.slug}`,
          label: `${city.name} Handyman Services`,
          stableId: `city-${city.slug}`,
          document
        });
      }
    } else {
      entries.push({ urlPath: "/service-areas", label: "Service Areas", stableId: "service-areas-index" });
    }

    return entries;
  }
});
