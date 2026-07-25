import { defineStackbitConfig } from "@stackbit/types";
import { GitContentSource } from "@stackbit/cms-git";

export default defineStackbitConfig({
  stackbitVersion: "~0.6.0",
  ssgName: "custom",
  nodeVersion: "18",
  // Specify how Netlify Visual Editor should serve your site's preview
  devCommand: "npx serve public -p {PORT}",
  contentSources: [
    new GitContentSource({
      rootPath: __dirname,
      contentDirs: ["public"],
      models: [], // Define editable content models here
      assetsConfig: {
        referenceType: "static",
        staticDir: "public",
        uploadDir: "icons",
        publicPath: "/"
      }
    })
  ]
});
