// server/pdfExport.ts
import fs from 'fs';
import os from 'os';
import path from 'path';
import puppeteer from 'puppeteer-core';
import {
  safeResolve,
  isMarkdownFile,
} from './fileSystem';

export function getExecutablePath() {
  const platform = os.platform();

  if (platform === 'win32') {
    return 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  }

  if (platform === 'darwin') {
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  }

  const linuxPaths = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/snap/bin/chromium',
    '/usr/bin/microsoft-edge-stable',
  ];

  for (const p of linuxPaths) {
    if (fs.existsSync(p)) return p;
  }

  throw new Error('未找到浏览器路径，请手动指定 executablePath');
}

export async function exportPdf(options: {
  file: string;
  mode: string;
  origin: string;
}) {
  const { file, mode, origin } = options;

  const fullPath = safeResolve(file);

  if (!fs.existsSync(fullPath)) {
    throw new Error('Markdown file not found');
  }

  if (!isMarkdownFile(fullPath)) {
    throw new Error('Only markdown files can be exported');
  }

  const targetUrl =
    `${origin}/?file=${encodeURIComponent(file)}` +
    `&mode=${encodeURIComponent(mode)}` +
    `&export=true`;

  console.log(`[PDF Export] 启动后台浏览器准备渲染: ${file} in ${mode} mode`);

  const browser = await puppeteer.launch({
    executablePath: getExecutablePath(),
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  });

  try {
    const page = await browser.newPage();

    await page.emulateMediaType('screen');

    await page.goto(targetUrl, {
      waitUntil: 'networkidle0',
    });

    await new Promise(resolve => setTimeout(resolve, 1500));

    let pdfOptions: any = {
      printBackground: true,
      displayHeaderFooter: false,
    };

    if (mode === 'slides') {
      pdfOptions = {
        ...pdfOptions,
        width: '1920px',
        height: '1080px',
        margin: {
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
        },
      };
    } else {
      const totalContentHeight = await page.evaluate(() => {
        return document.documentElement.scrollHeight + 100;
      });

      pdfOptions = {
        ...pdfOptions,
        width: '1200px',
        height: `${totalContentHeight}px`,
        margin: {
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
        },
      };
    }

    const pdfBuffer = await page.pdf(pdfOptions);

    const outputName =
      path.basename(file).replace(/\.(md|markdown)$/i, '.pdf') ||
      'export.pdf';

    console.log(`[PDF Export] 成功导出 PDF: ${file}`);

    return {
      pdfBuffer,
      outputName,
    };
  } finally {
    await browser.close();
  }
}