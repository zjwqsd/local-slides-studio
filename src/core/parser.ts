// src/core/parser.ts
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';

export interface SlideLayout {
  raw: string;
  areas?: string[];
  preset?: string;
}

export interface SlideRegion {
  elements: any[];
}

export interface SlideNode {
  type: 'cover' | 'content';
  title: string;
  layout?: SlideLayout;

  /**
   * 兼容旧逻辑：当前幻灯片的所有内容节点
   */
  elements: any[];

  /**
   * 新逻辑：当前幻灯片内部的布局区域
   */
  regions: SlideRegion[];
}

const SLIDE_LAYOUT_HTML_PREFIX = 'slide-layout:';

function preprocessSlideBreaks(mdContent: string): string {
  /**
   * Markdown 标准里：
   * --- {left|right}
   *
   * 通常不会被解析成 thematicBreak。
   *
   * 所以先转成：
   * ---
   * <!-- slide-layout:left|right -->
   */
  return mdContent.replace(
    /^(\s*)---\s*\{([^}]+)\}\s*$/gm,
    (_, indent, layout) =>
      `${indent}---\n${indent}<!-- ${SLIDE_LAYOUT_HTML_PREFIX}${layout.trim()} -->`
  );
}

function extractText(node: any): string {
  if (!node) return '';

  if (typeof node.value === 'string') {
    return node.value;
  }

  if (Array.isArray(node.children)) {
    return node.children.map(extractText).join('');
  }

  return '';
}

function parseLayout(raw: string): SlideLayout {
  const value = raw.trim();

  if (value.includes('|')) {
    return {
      raw: value,
      areas: value
        .split('|')
        .map(item => item.trim())
        .filter(Boolean),
    };
  }

  return {
    raw: value,
    preset: value,
  };
}

function extractTitleAndLayoutFromHeading(node: any): {
  title: string;
  layout?: SlideLayout;
} {
  const fullText = extractText(node).trim();

  /**
   * 支持：
   * ## 标题 {left|right}
   * ## 标题 {top|bottom}
   * ## 标题 {grid:2x2}
   */
  const match = fullText.match(/^(.*?)\s*\{([^}]+)\}\s*$/);

  if (!match) {
    return {
      title: fullText,
    };
  }

  return {
    title: match[1].trim(),
    layout: parseLayout(match[2]),
  };
}

function extractLayoutFromHtmlNode(node: any): SlideLayout | null {
  if (node.type !== 'html') return null;

  const value = String(node.value ?? '').trim();

  const match = value.match(/^<!--\s*slide-layout:([\s\S]*?)\s*-->$/);

  if (!match) return null;

  return parseLayout(match[1]);
}

function createEmptyRegion(): SlideRegion {
  return {
    elements: [],
  };
}

export function parseMarkdownToSlides(mdContent: string): SlideNode[] {
  const normalizedContent = preprocessSlideBreaks(mdContent);

  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath);

  const ast = processor.parse(normalizedContent);

  const slides: SlideNode[] = [];
  let currentSlide: SlideNode | null = null;
  let currentRegion: SlideRegion | null = null;

  for (const node of ast.children as any[]) {
    if (node.type === 'heading' && (node.depth === 1 || node.depth === 2)) {
      const { title, layout } = extractTitleAndLayoutFromHeading(node);

      currentRegion = createEmptyRegion();

      currentSlide = {
        type: node.depth === 1 ? 'cover' : 'content',
        title,
        layout,
        elements: [],
        regions: [currentRegion],
      };

      slides.push(currentSlide);
    }

    /**
     * 现在 --- 不再分页。
     * 它只负责在当前幻灯片内部创建一个新的 region。
     */
    else if (node.type === 'thematicBreak') {
      if (currentSlide) {
        currentRegion = createEmptyRegion();
        currentSlide.regions.push(currentRegion);
      }
    }

    else if (currentSlide && currentRegion) {
      /**
       * 支持：
       * --- {left|right}
       *
       * 这种写法会被预处理成 html layout marker。
       */
      const layoutFromHtml = extractLayoutFromHtmlNode(node);

      if (layoutFromHtml) {
        currentSlide.layout = layoutFromHtml;
        continue;
      }

      currentSlide.elements.push(node);
      currentRegion.elements.push(node);
    }
  }

  return slides;
}