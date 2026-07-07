var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// stackbit.config.js
var stackbit_config_exports = {};
__export(stackbit_config_exports, {
  default: () => stackbit_config_default
});
module.exports = __toCommonJS(stackbit_config_exports);
var import_types = require("@stackbit/types");
var import_cms_git = require("@stackbit/cms-git");
var import_fs = __toESM(require("fs"), 1);
var import_sdk = __toESM(require("@stackbit/sdk"), 1);
var import_cms_core = __toESM(require("@stackbit/cms-core"), 1);
var import_utils = __toESM(require("@stackbit/cms-core/dist/utils/index.js"), 1);
if (import_sdk.default && import_sdk.default.SUPPORTED_FILE_EXTENSIONS && !import_sdk.default.SUPPORTED_FILE_EXTENSIONS.includes("html")) {
  import_sdk.default.SUPPORTED_FILE_EXTENSIONS.push("html");
}
if (import_cms_core.default && import_cms_core.default.utils) {
  const origParseFile = import_cms_core.default.utils.parseFile;
  import_cms_core.default.utils = {
    ...import_cms_core.default.utils,
    parseFile: (filePath) => {
      if (filePath.endsWith(".html")) {
        return import_fs.default.promises.readFile(filePath, "utf8").then((data) => {
          const parsed = import_utils.default.parseMarkdownWithFrontMatter(data);
          return {
            type: "Page",
            title: parsed?.frontmatter?.title || "",
            body: parsed?.markdown || ""
          };
        });
      }
      return origParseFile(filePath);
    }
  };
}
var stackbit_config_default = (0, import_types.defineStackbitConfig)({
  stackbitVersion: "~0.6.0",
  ssgName: "custom",
  nodeVersion: "18",
  devCommand: "npx serve public -p {PORT}",
  contentSources: [
    new import_cms_git.GitContentSource({
      rootPath: "/opt/build/repo",
      contentDirs: ["public"],
      models: [
        {
          name: "Page",
          type: "page",
          urlPath: "/{slug}",
          filePath: "{slug}.html",
          fields: [
            { name: "title", type: "string", required: true },
            { name: "body", type: "markdown" }
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
//# sourceMappingURL=stackbit.config.HOHM7AWW.cjs.map
