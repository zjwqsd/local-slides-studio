<script setup lang="ts">
import { ref, watch, onMounted, inject, type Ref } from 'vue';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { codeToHtml } from 'shiki';
import mermaid from 'mermaid';

const props = defineProps<{ node: any }>();

const highlightedCode = ref<string>('');
const pseudoTitle = ref<string>('');
const pseudoLines = ref<string[]>([]);

const isDark = inject('isDark', ref(false));
const currentDir = inject<Ref<string>>('currentDir', ref(''));
const assetBaseUrl = inject<string>('assetBaseUrl', '');

const NJU_PURPLE = '#6f145f';

const formatPseudoLine = (line: string) => {
  const indentMatched = line.match(/^(\s+)/);
  const indent = indentMatched ? '&nbsp;'.repeat(indentMatched[1].length * 2) : '';

  let content = line.trimStart();

  const keywords = [
    'if',
    'else',
    'while',
    'for',
    'return',
    'function',
    'procedure',
    'end',
    'do',
    'then',
    'break',
    'continue',
    'true',
    'false',
    'repeat',
    'until',
    'input',
    'output',
  ];

  const regex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'gi');

  content = content.replace(
    regex,
    '<strong class="font-semibold text-[#6f145f]">$1</strong>'
  );

  return `${indent}${content}`;
};

const escapeHtml = (value: string) => {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
};

const renderBlock = async () => {
  highlightedCode.value = '';
  pseudoTitle.value = '';
  pseudoLines.value = [];

  if (props.node.type !== 'code') return;

  const lang = props.node.lang || 'text';

  if (lang === 'mermaid') {
    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: isDark.value ? 'dark' : 'default',
        fontFamily: 'inherit',
        themeVariables: {
          primaryColor: '#f8f3f7',
          primaryTextColor: '#222222',
          primaryBorderColor: NJU_PURPLE,
          lineColor: NJU_PURPLE,
          secondaryColor: '#ffffff',
          tertiaryColor: '#f8f3f7',
        },
      });

      const id = `mermaid-${Math.random().toString(36).slice(2, 11)}`;
      const { svg } = await mermaid.render(id, props.node.value);
      highlightedCode.value = svg;
    } catch (error) {
      highlightedCode.value = `
        <div class="text-[#6f145f] bg-[#f8f3f7] px-4 py-2 rounded-sm text-sm border border-[#d8c1d4]">
          Mermaid 语法错误: ${escapeHtml(String(error))}
        </div>
      `;
    }

    return;
  }

  if (lang === 'pseudo' || lang === 'algorithm') {
    const lines = props.node.value.split('\n');
    pseudoTitle.value = lines[0]?.startsWith('//')
      ? lines[0].replace(/^\/\/\s*/, '')
      : 'Algorithm';

    pseudoLines.value = lines[0]?.startsWith('//') ? lines.slice(1) : lines;
    return;
  }

  try {
    highlightedCode.value = await codeToHtml(props.node.value, {
      lang,
      theme: isDark.value ? 'tokyo-night' : 'github-light',
    });
  } catch (error) {
    highlightedCode.value = `
      <pre class="shiki-fallback">${escapeHtml(props.node.value)}</pre>
    `;
  }
};

onMounted(renderBlock);
watch(isDark, renderBlock);
watch(() => props.node, renderBlock, { deep: true });

const isVideo = (url: string) => /\.(mp4|webm|ogg)$/i.test(url);

const isPureMedia = (node: any) => {
  if (node.type !== 'paragraph') return false;

  const validChildren =
    node.children?.filter((c: any) => c.type !== 'text' || c.value.trim() !== '') || [];

  return validChildren.length > 0 && validChildren.every((c: any) => c.type === 'image');
};

const getMediaChildren = (node: any) => {
  return node.children?.filter((c: any) => c.type === 'image') || [];
};

const getGridCols = (count: number) => {
  if (count === 2 || count === 4) return 2;
  if (count >= 3) return 3;
  return 1;
};

const resolveUrl = (url: string) => {
  if (!url) return '';

  if (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('data:')
  ) {
    return url;
  }

  let cleanUrl = url;

  if (currentDir.value && !url.startsWith('/')) {
    const tmp = url.replace(/^\.\//, '');
    cleanUrl = `${currentDir.value}/${tmp}`;
  } else {
    cleanUrl = url.replace(/^\.?\//, '');
  }

  if (assetBaseUrl) {
    return `${assetBaseUrl}${encodeURIComponent(cleanUrl)}`;
  }

  return `/${cleanUrl}`;
};

const isSlideLayoutMarker = (node: any) => {
  if (node.type !== 'html') return false;
  return /^<!--\s*slide-layout:[\s\S]*?-->$/.test(String(node.value ?? '').trim());
};



</script>

<template>
  <template v-if="node.type === 'text'">
    {{ node.value }}
  </template>

  <!-- 布局标记由 SlideView 消费；这里兜底隐藏，避免意外渲染出来 -->
  <template v-else-if="isSlideLayoutMarker(node)" />

  <!-- 现在 --- 是页内区域分隔；若旧数据仍把它传给节点渲染，则显示为轻量分隔线 -->
  <hr
    v-else-if="node.type === 'thematicBreak'"
    class="my-5 border-0 border-t border-[#eaddea]"
  />

  <span
    v-else-if="node.type === 'inlineMath'"
    class="mx-1 text-[#6f145f]"
    v-html="katex.renderToString(node.value, { throwOnError: false })"
  />

  <div
    v-else-if="node.type === 'math'"
    class="math-display my-5 flex justify-center py-4 px-4 w-full rounded-sm bg-[#f8f3f7] border border-[#d8c1d4] text-[#222]"
    v-html="katex.renderToString(node.value, { displayMode: true, throwOnError: false })"
  />

  <strong
    v-else-if="node.type === 'strong'"
    class="font-semibold text-[#111]"
  >
    <AstRenderer
      v-for="(child, idx) in node.children"
      :key="idx"
      :node="child"
    />
  </strong>

  <em
    v-else-if="node.type === 'emphasis'"
    class="italic text-[#444]"
  >
    <AstRenderer
      v-for="(child, idx) in node.children"
      :key="idx"
      :node="child"
    />
  </em>

  <code
    v-else-if="node.type === 'inlineCode'"
    class="bg-[#f8f3f7] text-[#6f145f] px-1.5 py-0.5 rounded-sm text-[0.9em] font-mono mx-0.5 border border-[#d8c1d4]"
  >
    {{ node.value }}
  </code>

  <a
    v-else-if="node.type === 'link'"
    :href="node.url"
    class="text-[#6f145f] hover:text-[#4d0c43] font-medium underline underline-offset-2 transition-colors duration-150"
    target="_blank"
  >
    <AstRenderer
      v-for="(child, idx) in node.children"
      :key="idx"
      :node="child"
    />
  </a>

  <component
    :is="`h${node.depth}`"
    v-else-if="node.type === 'heading' && node.depth >= 3"
    :class="[
      'font-semibold mt-5 mb-3 pl-3 border-l-4 text-[#222]',
      node.depth === 3
        ? 'border-[#6f145f] text-xl'
        : node.depth === 4
          ? 'border-[#8b2a78] text-lg'
          : 'border-[#aaa] text-base'
    ]"
  >
    <AstRenderer
      v-for="(child, idx) in node.children"
      :key="idx"
      :node="child"
    />
  </component>

  <template v-else-if="node.type === 'paragraph'">
    <div
      v-if="isPureMedia(node)"
      class="media-gallery w-full my-5 grid gap-5 place-items-center"
      :style="{
        gridTemplateColumns: `repeat(${getGridCols(getMediaChildren(node).length)}, minmax(0, 1fr))`
      }"
    >
      <AstRenderer
        v-for="(child, idx) in getMediaChildren(node)"
        :key="idx"
        :node="child"
      />
    </div>

    <p
      v-else
      class="mb-4 text-[#222] text-[16px] leading-7"
    >
      <AstRenderer
        v-for="(child, idx) in node.children"
        :key="idx"
        :node="child"
      />
    </p>
  </template>

  <video
    v-else-if="node.type === 'image' && isVideo(node.url)"
    :src="resolveUrl(node.url)"
    controls
    class="max-h-[60vh] mx-auto block rounded-sm border border-[#d8c1d4] bg-white"
  />

  <img
    v-else-if="node.type === 'image' && !isVideo(node.url)"
    :src="resolveUrl(node.url)"
    :alt="node.alt"
    class="max-h-[60vh] w-auto max-w-full object-contain mx-auto block rounded-sm border border-[#d8c1d4] bg-white"
  />

  <blockquote
    v-else-if="node.type === 'blockquote'"
    class="border-l-4 border-[#6f145f] pl-4 py-2 my-5 text-[#333] bg-[#f8f3f7] rounded-r-sm text-base leading-7 font-normal"
  >
    <AstRenderer
      v-for="(child, idx) in node.children"
      :key="idx"
      :node="child"
    />
  </blockquote>

  <div
    v-else-if="node.type === 'table'"
    class="w-full overflow-x-auto my-6 rounded-sm border border-[#d8c1d4]"
  >
    <table class="w-full text-left text-sm border-collapse bg-white">
      <AstRenderer
        v-for="(child, idx) in node.children"
        :key="idx"
        :node="child"
      />
    </table>
  </div>

  <tr
    v-else-if="node.type === 'tableRow'"
    class="border-b border-[#eaddea] last:border-b-0"
  >
    <AstRenderer
      v-for="(child, idx) in node.children"
      :key="idx"
      :node="child"
    />
  </tr>

  <td
    v-else-if="node.type === 'tableCell'"
    class="px-4 py-2.5 text-[#333] font-normal"
  >
    <AstRenderer
      v-for="(child, idx) in node.children"
      :key="idx"
      :node="child"
    />
  </td>

  <component
    :is="node.ordered ? 'ol' : 'ul'"
    v-else-if="node.type === 'list'"
    :class="[
      'mb-4 pl-6 text-[#222] text-[16px] space-y-1.5 leading-7',
      node.ordered ? 'list-decimal' : 'list-disc'
    ]"
  >
    <AstRenderer
      v-for="(child, idx) in node.children"
      :key="idx"
      :node="child"
    />
  </component>

  <li
    v-else-if="node.type === 'listItem'"
    class="pl-1 marker:text-[#6f145f] marker:font-semibold"
  >
    <AstRenderer
      v-for="(child, idx) in node.children"
      :key="idx"
      :node="child"
    />
  </li>

  <div
    v-else-if="node.type === 'code'"
    class="w-full"
  >
    <!-- Mermaid -->
    <div
      v-if="node.lang === 'mermaid'"
      class="mermaid-container my-5 flex justify-center rounded-sm border border-[#e6d8e3] bg-white px-4 py-3 overflow-x-auto"
      v-html="highlightedCode"
    />

    <!-- 伪代码 / 算法 -->
    <div
      v-else-if="node.lang === 'pseudo' || node.lang === 'algorithm'"
      class="my-5 overflow-hidden rounded-sm border border-[#e6d8e3] bg-[#fbf8fb]"
    >
      <div class="flex items-center gap-2 border-b border-[#e6d8e3] px-4 py-2">
        <span class="h-3 w-[3px] bg-[#6f145f]"></span>
        <span class="text-[12px] font-semibold tracking-wide text-[#6f145f]">
          Algorithm
        </span>
        <span class="text-[12px] italic text-[#777]">
          {{ pseudoTitle }}
        </span>
      </div>

      <ol
        class="list-decimal list-outside pl-8 pr-4 py-3 space-y-1 text-[13px] leading-6 marker:text-[#6f145f] marker:font-semibold text-[#222] font-mono"
      >
        <li
          v-for="(line, idx) in pseudoLines"
          :key="idx"
          class="pl-2"
        >
          <span
            class="whitespace-pre-wrap"
            v-html="formatPseudoLine(line)"
          />
        </li>
      </ol>
    </div>

    <!-- 普通代码块 -->
    <div
      v-else
      class="code-card my-5 overflow-hidden rounded-sm border border-[#e6d8e3] bg-[#fbf8fb]"
    >
      <div
        v-if="node.lang"
        class="flex items-center px-4 pt-3 pb-1"
      >
        <span class="h-3 w-[3px] bg-[#6f145f] mr-2"></span>
        <span class="text-[11px] font-semibold uppercase tracking-wide text-[#6f145f]">
          {{ node.lang }}
        </span>
      </div>

      <div class="px-4 pb-4 pt-2">
        <div
          class="shiki-container rounded-sm bg-[#171923] px-4 py-3 text-[13px] font-mono leading-6 overflow-x-auto [&>pre]:bg-transparent [&>pre]:p-0 [&>pre]:m-0"
          v-html="highlightedCode"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
li > p {
  margin-bottom: 0;
}

.media-gallery > img,
.media-gallery > video {
  width: 100% !important;
  height: 100% !important;
  max-height: 40vh !important;
  object-fit: cover !important;
  aspect-ratio: 16 / 9;
  margin: 0 !important;
}

.media-gallery:has(> :only-child) > img,
.media-gallery:has(> :only-child) > video {
  object-fit: contain !important;
  max-height: 70vh !important;
  aspect-ratio: auto;
}

table tr:first-child {
  font-weight: 600;
  color: white;
  background: #6f145f;
}

table tr:first-child td {
  color: white;
}

.math-display {
  font-size: clamp(0.95rem, 1.1vw, 1.15rem);
  overflow-x: auto;
  overflow-y: hidden;
}

.mermaid-container :deep(svg) {
  max-width: 100%;
  height: auto;
}

.code-card :deep(pre),
.shiki-container :deep(pre) {
  margin: 0 !important;
  padding: 0 !important;
  background: transparent !important;
  overflow-x: auto;
}

.code-card :deep(code),
.shiki-container :deep(code) {
  font-family:
    "JetBrains Mono",
    "Fira Code",
    "SFMono-Regular",
    Consolas,
    "Liberation Mono",
    Menlo,
    monospace;
  font-size: 13px;
  line-height: 1.55;
}

.code-card :deep(.shiki),
.shiki-container :deep(.shiki) {
  background: transparent !important;
}

.shiki-fallback {
  margin: 0;
  padding: 0;
  background: transparent;
  color: #d8dee9;
  white-space: pre;
  overflow-x: auto;
}

@media print {
  .page-break-inside-avoid {
    page-break-inside: avoid;
  }

  .math-display {
    overflow-x: visible !important;
    white-space: normal !important;
    page-break-inside: avoid;
  }

  .math-display :deep(.katex-display) {
    max-width: 100%;
    overflow-wrap: break-word;
    display: inline-block;
  }
}
</style>