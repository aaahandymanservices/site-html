var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// stackbit.config.js
var stackbit_config_exports = {};
__export(stackbit_config_exports, {
  default: () => stackbit_config_default
});
module.exports = __toCommonJS(stackbit_config_exports);
var import_types = require("@stackbit/types");
var import_cms_git = require("@stackbit/cms-git");
var rootDir = process.cwd();
var stackbit_config_default = (0, import_types.defineStackbitConfig)({
  stackbitVersion: "~0.6.0",
  ssgName: "custom",
  nodeVersion: "22",
  devCommand: "node ./node_modules/.bin/serve public --listen tcp://{HOSTNAME}:{PORT}",
  // Map the editable content documents to the live pages that render them so
  // the visual editor can open each document against a real preview URL.
  sitemap: ({ documents }) => {
    const pages = {
      ServicesData: { label: "Services", urlPath: "/services" },
      ServiceAreasData: { label: "Service Areas", urlPath: "/service-areas" }
    };
    return documents.filter((document) => pages[document.modelName]).map((document) => ({
      stableId: document.modelName,
      label: pages[document.modelName].label,
      urlPath: pages[document.modelName].urlPath,
      document: {
        id: document.id,
        modelName: document.modelName,
        srcType: document.srcType,
        srcProjectId: document.srcProjectId
      }
    }));
  },
  contentSources: [
    new import_cms_git.GitContentSource({
      rootPath: rootDir,
      contentDirs: ["public"],
      // The site's editable content lives in the JSON "single source of truth"
      // files under public/data. The Git content source can load and round-trip
      // JSON natively; the page HTML is generated from these files by the build
      // scripts (scripts/build-service-pages.mjs, scripts/build-city-pages.mjs)
      // and by the browser service-area checker (public/js/service-area-checker.js).
      // Fields left unmodeled here (e.g. the `note` and `categories` keys) are
      // preserved on save — updates only mutate the edited field path.
      models: [
        {
          name: "ServicesData",
          type: "data",
          filePath: "data/services.json",
          singleInstance: true,
          label: "Services",
          fields: [
            {
              name: "services",
              type: "list",
              label: "Services",
              items: {
                type: "object",
                labelField: "name",
                fields: [
                  { name: "name", type: "string", required: true },
                  { name: "slug", type: "string", required: true },
                  { name: "icon", type: "string" },
                  { name: "category", type: "string" },
                  { name: "formService", type: "string", label: "Form service name" },
                  { name: "tagline", type: "string" },
                  { name: "intro", type: "list", items: { type: "text" } },
                  { name: "features", type: "list", items: { type: "string" } },
                  {
                    name: "faq",
                    type: "object",
                    label: "FAQ",
                    fields: [
                      { name: "q", type: "string", label: "Question" },
                      { name: "a", type: "text", label: "Answer" }
                    ]
                  }
                ]
              }
            }
          ]
        },
        {
          name: "ServiceAreasData",
          type: "data",
          filePath: "data/service-areas.json",
          singleInstance: true,
          label: "Service Areas",
          fields: [
            {
              name: "zones",
              type: "object",
              label: "Zones",
              fields: [
                {
                  name: "A",
                  type: "object",
                  label: "Zone A",
                  fields: [
                    { name: "label", type: "string" },
                    { name: "rate", type: "string" }
                  ]
                },
                {
                  name: "B",
                  type: "object",
                  label: "Zone B",
                  fields: [
                    { name: "label", type: "string" },
                    { name: "rate", type: "string" }
                  ]
                }
              ]
            },
            {
              name: "cities",
              type: "list",
              label: "Cities",
              items: {
                type: "object",
                labelField: "name",
                fields: [
                  { name: "name", type: "string", required: true },
                  { name: "slug", type: "string", required: true },
                  { name: "aliases", type: "list", items: { type: "string" } },
                  { name: "zips", type: "list", items: { type: "string" } },
                  { name: "zone", type: "string" },
                  { name: "region", type: "string" },
                  { name: "blurb", type: "text" },
                  { name: "nearby", type: "list", items: { type: "string" } }
                ]
              }
            }
          ]
        }
      ],
      assetsConfig: {
        referenceType: "static",
        staticDir: "public",
        uploadDir: "images",
        publicPath: "/"
      }
    })
  ]
});
//# sourceMappingURL=stackbit.config.MVITHDOQ.cjs.map
