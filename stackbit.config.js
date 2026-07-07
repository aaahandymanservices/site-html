import { defineStackbitConfig } from '@stackbit/types';
import { GitContentSource } from '@stackbit/cms-git';

export default defineStackbitConfig({
  stackbitVersion: '~0.6.0',
  ssgName: 'custom',
  nodeVersion: '18',
  devCommand: 'npx serve public -p {PORT}',
  contentSources: [
    new GitContentSource({
      rootPath: __dirname,
      contentDirs: ['public'],
      models: [
        {
          name: 'Page',
          type: 'page',
          urlPath: '/{slug}',
          filePath: '{slug}.html',
          fields: [
            { name: 'title', type: 'string', required: true },
            { name: 'body', type: 'markdown' }
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
