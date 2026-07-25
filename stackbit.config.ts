import { defineStackbitConfig } from "@stackbit/types";
import type { SiteMapEntry } from "@stackbit/types";
import { readFileSync } from "node:fs";
import { join } from "node:path";

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
  devCommand: "npm run dev -- --hostname {HOSTNAME} --port {PORT}",
  contentSources: [],
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
