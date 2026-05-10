// slides.config.ts
import path from 'path';

export default {
  title: 'Local Studio',

  contentRoot: path.resolve('./slides'),

  markdownExtensions: ['.md', '.markdown'],

  ignoredDirs: [
    'node_modules',
    '.git',
    '.vite',
    'dist',
  ],

  expandAllByDefault: true,
};