// server/fileSystem.ts
import fs from 'fs';
import path from 'path';
import slidesConfig from '../slides.config';

export const CONTENT_ROOT = path.resolve(
  slidesConfig.contentRoot || path.resolve(process.cwd(), 'public'),
);

export const MARKDOWN_EXTENSIONS = (
  slidesConfig.markdownExtensions ?? ['.md', '.markdown']
).map(ext => ext.toLowerCase());

export const IGNORED_DIRS = slidesConfig.ignoredDirs ?? [
  'node_modules',
  '.git',
  '.vite',
  'dist',
];

export function normalizeRelativePath(value: string) {
  return String(value || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');
}

export function safeResolve(relativePath: string) {
  const normalized = normalizeRelativePath(relativePath);
  const absolutePath = path.resolve(CONTENT_ROOT, normalized);

  const rootWithSep = CONTENT_ROOT.endsWith(path.sep)
    ? CONTENT_ROOT
    : CONTENT_ROOT + path.sep;

  if (absolutePath !== CONTENT_ROOT && !absolutePath.startsWith(rootWithSep)) {
    throw new Error(`非法路径：${relativePath}`);
  }

  return absolutePath;
}

export function isIgnoredDir(name: string) {
  return IGNORED_DIRS.includes(name);
}

export function isMarkdownFile(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  return MARKDOWN_EXTENSIONS.includes(ext);
}

export function getMarkdownFiles(dir = CONTENT_ROOT, rootDir = CONTENT_ROOT): string[] {
  let results: string[] = [];

  if (!fs.existsSync(dir)) return results;

  const list = fs.readdirSync(dir, {
    withFileTypes: true,
  });

  list.sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) {
      return a.isDirectory() ? -1 : 1;
    }

    return a.name.localeCompare(b.name, 'zh-CN');
  });

  for (const item of list) {
    if (item.name.startsWith('.')) continue;

    if (item.isDirectory() && isIgnoredDir(item.name)) {
      continue;
    }

    const fullPath = path.join(dir, item.name);

    if (item.isDirectory()) {
      results = results.concat(getMarkdownFiles(fullPath, rootDir));
      continue;
    }

    if (item.isFile() && isMarkdownFile(item.name)) {
      results.push(path.relative(rootDir, fullPath).replace(/\\/g, '/'));
    }
  }

  return results;
}

export function getRelativePathFromAbsolute(file: string) {
  return path.relative(CONTENT_ROOT, file).replace(/\\/g, '/');
}

export function getMimeType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();

  const map: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.bmp': 'image/bmp',

    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogg': 'video/ogg',

    '.pdf': 'application/pdf',
    '.txt': 'text/plain; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
  };

  return map[ext] || 'application/octet-stream';
}