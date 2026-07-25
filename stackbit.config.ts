import { defineStackbitConfig } from "@stackbit/types";
import { GitContentSource } from "@stackbit/cms-git";

export default defineStackbitConfig({
  stackbitVersion: "~0.6.0",
  ssgName: "custom",
  nodeVersion: "18",
  devCommand: "node -e \"require('http').createServer((req, res) => { require('node:fs').readFile('./public' + req.url, (err, data) => { res.end(data); }); }).listen({PORT})\"",
  contentSources: [
    new GitContentSource({
      rootPath: __dirname,
      contentDirs: ["public"],
      models: [],
      assetsConfig: {
        referenceType: "static",
        staticDir: "public",
        uploadDir: "images",
        publicPath: "/"
      }
    })
  ]
});
