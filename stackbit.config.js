import { defineStackbitConfig } from '@stackbit/types';
import { GitContentSource } from '@stackbit/cms-git';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sdk from '@stackbit/sdk';
import core from '@stackbit/cms-core';
import coreUtils from '@stackbit/cms-core/dist/utils/index.js';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

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
  devCommand: 'node ./node_modules/.bin/serve public --listen tcp://{HOSTNAME}:{PORT}',
  sitemap: ({ documents }) => {
    const homeDocument = documents.find((document) => document.id === 'public/index.html');

    if (!homeDocument) {
      return [];
    }

    return [
      {
        stableId: 'home',
        label: 'Home',
        urlPath: '/',
        document: {
          id: homeDocument.id,
          modelName: homeDocument.modelName,
          srcType: homeDocument.srcType,
          srcProjectId: homeDocument.srcProjectId
        }
      }
    ];
  },
  contentSources: [
    new GitContentSource({
      rootPath: rootDir,
      contentDirs: ['public'],
      models: [
        {
          name: 'Page',
          type: 'page',
          filePath: 'index.html',
          singleInstance: true,
          labelField: 'title',
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
