import { defineStackbitConfig } from '@stackbit/types';
import { GitContentSource } from '@stackbit/cms-git';

// Stackbit bundles this config to CommonJS before loading it, and esbuild
// replaces `import.meta` with `{}` in that output. That made the previous
// `fileURLToPath(import.meta.url)` throw ("path must be a string, received
// undefined") and the whole config failed to load. Stackbit always runs from
// the project root, so use the working directory instead — it is correct in
// both the native ESM and the bundled-CJS execution contexts.
const rootDir = process.cwd();

export default defineStackbitConfig({
  stackbitVersion: '~0.6.0',
  ssgName: 'custom',
  nodeVersion: '22',
  // Regenerate the JSON-driven pages from public/data/*.json before serving so
  // the preview reflects the current content, then serve the static site. This
  // mirrors the Netlify build command in netlify.toml; without the regenerate
  // step the preview showed stale committed HTML that ignored edits.
  devCommand:
    'node scripts/build-service-pages.mjs && node scripts/build-city-pages.mjs && node ./node_modules/.bin/serve public --listen tcp://{HOSTNAME}:{PORT}',
  // Map the editable content documents to the live pages that render them so
  // the visual editor can open each document against a real preview URL.
  sitemap: ({ documents }) => {
    const pages = {
      ServicesData: { label: 'Services', urlPath: '/services' },
      ServiceAreasData: { label: 'Service Areas', urlPath: '/service-areas' }
    };

    return documents
      .filter((document) => pages[document.modelName])
      .map((document) => ({
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
    new GitContentSource({
      rootPath: rootDir,
      contentDirs: ['public'],
      // The site's editable content lives in the JSON "single source of truth"
      // files under public/data. The Git content source can load and round-trip
      // JSON natively; the page HTML is generated from these files by the build
      // scripts (scripts/build-service-pages.mjs, scripts/build-city-pages.mjs)
      // and by the browser service-area checker (public/js/service-area-checker.js).
      // Fields left unmodeled here (e.g. the `note` and `categories` keys) are
      // preserved on save — updates only mutate the edited field path.
      models: [
        {
          name: 'ServicesData',
          type: 'data',
          filePath: 'data/services.json',
          singleInstance: true,
          label: 'Services',
          fields: [
            {
              name: 'services',
              type: 'list',
              label: 'Services',
              items: {
                type: 'object',
                labelField: 'name',
                fields: [
                  { name: 'name', type: 'string', required: true },
                  { name: 'slug', type: 'string', required: true },
                  { name: 'icon', type: 'string' },
                  { name: 'category', type: 'string' },
                  { name: 'formService', type: 'string', label: 'Form service name' },
                  { name: 'tagline', type: 'string' },
                  { name: 'intro', type: 'list', items: { type: 'text' } },
                  { name: 'features', type: 'list', items: { type: 'string' } },
                  {
                    name: 'faq',
                    type: 'object',
                    label: 'FAQ',
                    fields: [
                      { name: 'q', type: 'string', label: 'Question' },
                      { name: 'a', type: 'text', label: 'Answer' }
                    ]
                  }
                ]
              }
            }
          ]
        },
        {
          name: 'ServiceAreasData',
          type: 'data',
          filePath: 'data/service-areas.json',
          singleInstance: true,
          label: 'Service Areas',
          fields: [
            {
              name: 'zones',
              type: 'object',
              label: 'Zones',
              fields: [
                {
                  name: 'A',
                  type: 'object',
                  label: 'Zone A',
                  fields: [
                    { name: 'label', type: 'string' },
                    { name: 'rate', type: 'string' }
                  ]
                },
                {
                  name: 'B',
                  type: 'object',
                  label: 'Zone B',
                  fields: [
                    { name: 'label', type: 'string' },
                    { name: 'rate', type: 'string' }
                  ]
                }
              ]
            },
            {
              name: 'cities',
              type: 'list',
              label: 'Cities',
              items: {
                type: 'object',
                labelField: 'name',
                fields: [
                  { name: 'name', type: 'string', required: true },
                  { name: 'slug', type: 'string', required: true },
                  { name: 'aliases', type: 'list', items: { type: 'string' } },
                  { name: 'zips', type: 'list', items: { type: 'string' } },
                  { name: 'zone', type: 'string' },
                  { name: 'region', type: 'string' },
                  { name: 'blurb', type: 'text' },
                  { name: 'nearby', type: 'list', items: { type: 'string' } }
                ]
              }
            }
          ]
        }
      ],
      assetsConfig: {
        referenceType: 'static',
        staticDir: 'public',
        uploadDir: 'images',
        publicPath: '/'
      }
    })
  ]
});
