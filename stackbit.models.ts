import type { Model } from "@stackbit/types";

const serviceCategories = {
  type: "object" as const,
  name: "ServiceCategories",
  label: "Service Categories",
  fields: [
    { type: "string" as const, name: "interior", label: "Interior Repairs & Finishes" },
    { type: "string" as const, name: "doors-efficiency", label: "Doors, Windows & Efficiency" },
    { type: "string" as const, name: "plumbing", label: "Plumbing & Water Protection" },
    { type: "string" as const, name: "electrical", label: "Electrical & Smart Home" },
    { type: "string" as const, name: "installation", label: "Installation & Assembly" },
    { type: "string" as const, name: "exterior", label: "Exterior & Curb Appeal" },
    { type: "string" as const, name: "maintenance", label: "Maintenance & Seasonal Care" },
    { type: "string" as const, name: "safety", label: "Safety & Accessibility" },
    { type: "string" as const, name: "commercial", label: "Commercial" }
  ]
};

const serviceFaq = {
  type: "object" as const,
  name: "ServiceFaq",
  label: "Service FAQ",
  fields: [
    { type: "string" as const, name: "q", label: "Question", required: true },
    { type: "text" as const, name: "a", label: "Answer", required: true }
  ]
};

const serviceItem = {
  type: "object" as const,
  name: "ServiceItem",
  label: "Service",
  labelField: "name",
  fields: [
    { type: "string" as const, name: "name", required: true },
    { type: "slug" as const, name: "slug", required: true },
    { type: "string" as const, name: "icon", description: "Font Awesome icon class." },
    {
      type: "enum" as const,
      name: "category",
      required: true,
      options: ["interior", "doors-efficiency", "plumbing", "electrical", "installation", "exterior", "maintenance", "safety", "commercial"]
    },
    { type: "string" as const, name: "formService", label: "Booking Form Service" },
    { type: "text" as const, name: "tagline", required: true },
    { type: "list" as const, name: "intro", items: { type: "text" as const }, required: true },
    { type: "list" as const, name: "features", items: { type: "string" as const }, required: true },
    { type: "model" as const, name: "faq", models: ["ServiceFaq"], required: true }
  ]
};

const serviceZone = {
  type: "object" as const,
  name: "ServiceZone",
  label: "Service Zone",
  fields: [
    { type: "string" as const, name: "label", required: true },
    { type: "string" as const, name: "rate", required: true }
  ]
};

const serviceZones = {
  type: "object" as const,
  name: "ServiceZones",
  label: "Service Zones",
  fields: [
    { type: "model" as const, name: "A", label: "Zone A", models: ["ServiceZone"], required: true },
    { type: "model" as const, name: "B", label: "Zone B", models: ["ServiceZone"], required: true }
  ]
};

const serviceCity = {
  type: "object" as const,
  name: "ServiceCity",
  label: "Service Area",
  labelField: "name",
  fields: [
    { type: "string" as const, name: "name", required: true },
    { type: "slug" as const, name: "slug", required: true },
    { type: "list" as const, name: "aliases", items: { type: "string" as const } },
    { type: "list" as const, name: "zips", label: "ZIP Codes", items: { type: "string" as const }, required: true },
    { type: "enum" as const, name: "zone", options: ["A", "B"], required: true },
    { type: "string" as const, name: "region", required: true },
    { type: "text" as const, name: "blurb", required: true },
    { type: "list" as const, name: "nearby", label: "Nearby City Slugs", items: { type: "string" as const } }
  ]
};

const quoteZoneMinimum = {
  type: "object" as const,
  name: "QuoteZoneMinimum",
  label: "Zone Minimums",
  fields: [
    { type: "number" as const, name: "A", label: "Zone A", subtype: "int" as const, required: true },
    { type: "number" as const, name: "B", label: "Zone B", subtype: "int" as const, required: true }
  ]
};

const quoteTask = {
  type: "object" as const,
  name: "QuoteTask",
  label: "Quote Task",
  labelField: "name",
  fields: [
    { type: "string" as const, name: "id", required: true },
    { type: "string" as const, name: "name", required: true },
    { type: "text" as const, name: "desc", label: "Description", required: true },
    { type: "number" as const, name: "a", label: "Zone A Price", subtype: "int" as const, required: true },
    { type: "number" as const, name: "b", label: "Zone B Price", subtype: "int" as const, required: true }
  ]
};

const quoteCategory = {
  type: "object" as const,
  name: "QuoteCategory",
  label: "Quote Category",
  labelField: "label",
  fields: [
    { type: "string" as const, name: "label", required: true },
    { type: "string" as const, name: "icon", description: "Font Awesome icon class." },
    { type: "list" as const, name: "tasks", items: { type: "model" as const, models: ["QuoteTask"] }, required: true }
  ]
};

export const visualEditorModels: Model[] = [
  serviceCategories,
  serviceFaq,
  serviceItem,
  serviceZone,
  serviceZones,
  serviceCity,
  quoteZoneMinimum,
  quoteTask,
  quoteCategory,
  {
    type: "page",
    name: "ServicesData",
    label: "Services",
    urlPath: "/services",
    singleInstance: true,
    filePath: "public/data/services.json",
    canDelete: false,
    fields: [
      { type: "text", name: "note", label: "Internal Note", readOnly: true },
      { type: "model", name: "categories", models: ["ServiceCategories"], required: true },
      { type: "list", name: "services", items: { type: "model", models: ["ServiceItem"] }, required: true }
    ]
  },
  {
    type: "page",
    name: "ServiceAreasData",
    label: "Service Areas",
    urlPath: "/service-areas",
    singleInstance: true,
    filePath: "public/data/service-areas.json",
    canDelete: false,
    fields: [
      { type: "text", name: "note", label: "Internal Note", readOnly: true },
      { type: "model", name: "zones", models: ["ServiceZones"], required: true },
      { type: "list", name: "cities", items: { type: "model", models: ["ServiceCity"] }, required: true }
    ]
  },
  {
    type: "data",
    name: "QuoteTasksData",
    label: "Quote Calculator",
    singleInstance: true,
    filePath: "public/data/quote-tasks.json",
    canDelete: false,
    fields: [
      { type: "text", name: "note", label: "Internal Note", readOnly: true },
      { type: "string", name: "currency", readOnly: true },
      { type: "model", name: "zoneMinimum", label: "Zone Minimums", models: ["QuoteZoneMinimum"], required: true },
      { type: "list", name: "categories", items: { type: "model", models: ["QuoteCategory"] }, required: true }
    ]
  }
];
