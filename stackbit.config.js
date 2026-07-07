import { defineStackbitConfig } from '@stackbit/types';
import { GitContentSource } from '@stackbit/cms-git';
import fs from 'fs';
import sdk from '@stackbit/sdk';
import core from '@stackbit/cms-core';
import coreUtils from '@stackbit/cms-core/dist/utils/index.js';

// Add html to supported extensions so Git Content Source scans .html files
if (sdk && sdk.SUPPORTED_FILE_EXTENSIONS && !sdk.SUPPORTED_FILE_EXTENSIONS.includes('html')) {
  sdk.SUPPORTED_FILE_EXTENSIONS.push('html');
}

// Override core.utils.parseFile to handle .html files and parse them as page models
if (core && core.utils) {
  const origParseFile = core.utils.parseFile;
  core.utils = {
    ...core.utils,
    parseFile: (filePath) => {
      if (filePath.endsWith('.html')) {
        return fs.promises.readFile(filePath, 'utf8').then((data) => {
          const parsed = coreUtils.parseMarkdownWithFrontMatter(data);
          return {
            type: 'Page',
            title: parsed?.frontmatter?.title || '',
            body: parsed?.markdown || ''
          };
        });
      }
      return origParseFile(filePath);
    }
  };
}

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
