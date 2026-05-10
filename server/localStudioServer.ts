// server/localStudioServer.ts
import fs from 'fs';
import path from 'path';
import type { ViteDevServer } from 'vite';

import slidesConfig from '../slides.config';
import {
  CONTENT_ROOT,
  getMarkdownFiles,
  getMimeType,
  getRelativePathFromAbsolute,
  isMarkdownFile,
  safeResolve,
} from './fileSystem';
import { exportPdf } from './pdfExport';

function sendJson(res: any, data: unknown) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function sendText(res: any, data: string, statusCode = 200) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end(data);
}

function getRequestUrl(req: any) {
  return new URL(req.url || '/', `http://${req.headers.host}`);
}

export function localStudioServerPlugin() {
  return {
    name: 'local-studio-server',

    configureServer(server: ViteDevServer) {
      if (!fs.existsSync(CONTENT_ROOT)) {
        fs.mkdirSync(CONTENT_ROOT, {
          recursive: true,
        });
      }

      console.log('[Local Studio] CONTENT_ROOT =', CONTENT_ROOT);
      console.log('[Local Studio] exists =', fs.existsSync(CONTENT_ROOT));

      server.middlewares.use('/api/config', (_req, res) => {
        sendJson(res, {
          title: slidesConfig.title || 'Local Studio',
          workspaceName: path.basename(CONTENT_ROOT),
          expandAllByDefault: slidesConfig.expandAllByDefault ?? true,
        });
      });

      server.middlewares.use('/api/files', (_req, res) => {
        try {
          sendJson(res, getMarkdownFiles());
        } catch (error) {
          console.error('[Files API Error]', error);
          sendText(res, String(error), 500);
        }
      });

      server.middlewares.use('/api/read', (req, res) => {
        try {
          const url = getRequestUrl(req);
          const filePath = url.searchParams.get('path') || '';
          const fullPath = safeResolve(filePath);

          if (!fs.existsSync(fullPath)) {
            sendText(res, '文件不存在', 404);
            return;
          }

          if (!isMarkdownFile(fullPath)) {
            sendText(res, '只能读取 Markdown 文件', 400);
            return;
          }

          const content = fs.readFileSync(fullPath, 'utf-8');
          sendText(res, content);
        } catch (error) {
          console.error('[Read API Error]', error);
          sendText(res, String(error), 500);
        }
      });

      server.middlewares.use('/api/asset', (req, res) => {
        try {
          const url = getRequestUrl(req);
          const assetPath = url.searchParams.get('path') || '';
          const fullPath = safeResolve(assetPath);

          if (!fs.existsSync(fullPath)) {
            sendText(res, '资源不存在', 404);
            return;
          }

          const stat = fs.statSync(fullPath);

          if (!stat.isFile()) {
            sendText(res, '不是文件资源', 400);
            return;
          }

          res.statusCode = 200;
          res.setHeader('Content-Type', getMimeType(fullPath));
          fs.createReadStream(fullPath).pipe(res);
        } catch (error) {
          console.error('[Asset API Error]', error);
          sendText(res, String(error), 500);
        }
      });

      server.middlewares.use('/api/export-pdf', async (req, res) => {
        try {
          const url = getRequestUrl(req);
          const file = url.searchParams.get('file');
          const mode = url.searchParams.get('mode') || 'slides';

          if (!file) {
            sendText(res, 'Missing file parameter', 400);
            return;
          }

          const origin = `http://${req.headers.host}`;

          const { pdfBuffer, outputName } = await exportPdf({
            file,
            mode,
            origin,
          });

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader(
            'Content-Disposition',
            `attachment; filename="${encodeURIComponent(outputName)}"`,
          );
          res.end(pdfBuffer);
        } catch (error) {
          console.error('[PDF Export Error]', error);
          sendText(res, 'Export failed', 500);
        }
      });

      server.watcher.add(CONTENT_ROOT);

      server.watcher.on('all', (eventName: string, file: string) => {
        if (!isMarkdownFile(file)) return;

        const relativePath = getRelativePathFromAbsolute(file);

        server.ws.send({
          type: 'custom',
          event: 'md-update',
          data: {
            type: eventName,
            path: relativePath,
          },
        });
      });
    },
  };
}