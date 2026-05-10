<script setup lang="ts">
import { computed } from 'vue';
import type { SlideNode } from '../core/parser';
import AstRenderer from './AstRenderer.vue';

const props = defineProps<{
  slide: SlideNode;
}>();

const displayTitle = computed(() => props.slide.title);

const normalizedRegions = computed(() => {
  const regions = (props.slide as any).regions;

  if (Array.isArray(regions) && regions.length > 0) {
    return regions.map((region: any) => ({
      elements: Array.isArray(region?.elements) ? region.elements : [],
    }));
  }

  return [
    {
      elements: Array.isArray(props.slide.elements) ? props.slide.elements : [],
    },
  ];
});

const allSlideElements = computed(() => {
  if (Array.isArray(props.slide.elements) && props.slide.elements.length > 0) {
    return props.slide.elements;
  }

  return normalizedRegions.value.flatMap(region => region.elements);
});

const layoutRaw = computed(() => {
  const layout = (props.slide as any).layout;
  return String(layout?.raw || layout?.preset || '').trim();
});

const layoutAreas = computed(() => {
  const layout = (props.slide as any).layout;

  if (Array.isArray(layout?.areas) && layout.areas.length > 0) {
    return layout.areas
      .map((area: string) => area.trim())
      .filter(Boolean);
  }

  if (layoutRaw.value.includes('|')) {
    return layoutRaw.value
      .split('|')
      .map(area => area.trim())
      .filter(Boolean);
  }

  return [];
});

const hasExplicitLayout = computed(() => layoutRaw.value.length > 0);

const regionLayoutMode = computed(() => {
  const raw = layoutRaw.value.toLowerCase();
  const areas = layoutAreas.value.map((area: string) => area.toLowerCase());

  /**
   * 没有写 {left|right} / {top|bottom} / {grid:2x2} 时，
   * 即使 parser 因为 --- 产生了 regions，也不触发布局分块。
   * 默认直接采用文章式顺序排版。
   */
  if (!hasExplicitLayout.value) return '';

  if (
    raw === 'left|right' ||
    raw === 'right|left' ||
    (areas.length === 2 && areas.includes('left') && areas.includes('right'))
  ) {
    return 'left-right';
  }

  if (
    raw === 'top|bottom' ||
    raw === 'bottom|top' ||
    (areas.length === 2 && areas.includes('top') && areas.includes('bottom'))
  ) {
    return 'top-bottom';
  }

  if (raw.startsWith('grid:') || areas.length >= 3) {
    return 'grid';
  }

  return 'stack';
});

const layoutMode = computed(() => {
  if (props.slide.type === 'cover') return 'cover';
  if (regionLayoutMode.value) return 'regions';

  /**
   * 默认布局：
   * 不再自动拆分文字区 / 视觉区。
   * 直接按照 Markdown AST 顺序渲染。
   */
  return 'article';
});

const regionGridStyle = computed(() => {
  const raw = layoutRaw.value.toLowerCase();
  const match = raw.match(/^grid:(\d+)(?:x(\d+))?$/);
  const regionCount = Math.max(normalizedRegions.value.length, 1);

  if (match) {
    const cols = Math.max(Number(match[1]) || 1, 1);
    const rows = match[2]
      ? Math.max(Number(match[2]) || 1, 1)
      : Math.ceil(regionCount / cols);

    return {
      gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
      gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
    };
  }

  const cols =
    regionCount === 2 || regionCount === 4
      ? 2
      : regionCount >= 3
        ? 3
        : 1;

  return {
    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
  };
});

const topBottomGridStyle = computed(() => {
  const regionCount = Math.max(normalizedRegions.value.length, 1);

  return {
    gridTemplateRows: `repeat(${regionCount}, minmax(0, 1fr))`,
  };
});

const articleFlowClass = 'article-flow text-[#222] text-[16px] leading-7';

const getRegionClass = (idx: number) => {
  const base = `${articleFlowClass} region-flow min-w-0 min-h-0 overflow-y-auto scrollbar-hide`;

  if (regionLayoutMode.value === 'left-right') {
    return [
      base,
      'region-flow-left-right flex flex-col justify-start pr-4',
      idx === 0 ? 'border-r border-[#eaddea]' : 'pl-2',
    ];
  }

  if (regionLayoutMode.value === 'top-bottom') {
    return [
      base,
      'region-flow-top-bottom flex flex-col justify-start pr-4',
      idx === 0 ? 'border-b border-[#eaddea] pb-3' : 'pt-1',
    ];
  }

  if (regionLayoutMode.value === 'grid') {
    return [
      base,
      'region-flow-grid flex flex-col justify-start rounded-sm border border-[#eaddea] bg-white/60 px-4 py-3',
    ];
  }

  return [
    base,
    'region-flow-stack flex flex-col justify-start pr-4',
  ];
};
</script>

<template>
  <div class="relative w-full h-full bg-white text-[#111] overflow-hidden box-border">
    <!-- 右上角南大 Logo -->
    <img
      src="/assets/nju-logo.png"
      alt="Nanjing University"
      class="absolute top-4 right-6 h-9 w-auto object-contain"
    />

    <!-- 封面 -->
    <div
      v-if="layoutMode === 'cover'"
      class="h-full flex flex-col items-center justify-center text-center px-16"
    >
      <h1 class="text-[34px] leading-tight font-bold tracking-wide text-[#111]">
        {{ slide.title }}
      </h1>

      <div class="w-32 h-[2px] bg-[#6f145f] mt-7 mb-8"></div>

      <div class="article-flow text-[15px] leading-7 text-[#333] max-w-[760px]">
        <AstRenderer
          v-for="(el, idx) in allSlideElements"
          :key="idx"
          :node="el"
        />
      </div>
    </div>

    <!-- 内容页 -->
    <template v-else>
      <!-- 标题区 -->
      <div class="absolute top-5 left-6 right-48">
        <h2 class="text-[18px] leading-none font-bold tracking-tight text-[#111]">
          {{ displayTitle }}
        </h2>

        <div class="mt-2 h-[1px] w-[205px] bg-[#6f145f]"></div>
      </div>

      <!-- 内容区 -->
      <main class="absolute left-10 right-10 top-20 bottom-8 overflow-hidden">
        <!-- 显式布局：只负责外层区域排布；每个区域内部仍按文章顺序渲染 -->
        <div
          v-if="layoutMode === 'regions'"
          class="h-full min-h-0"
        >
          <!-- 左右布局 -->
          <div
            v-if="regionLayoutMode === 'left-right'"
            class="h-full grid grid-cols-[1fr_1fr] gap-8 min-h-0"
          >
            <section
              v-for="(region, idx) in normalizedRegions"
              :key="'region-lr-' + idx"
              :class="getRegionClass(idx)"
            >
              <AstRenderer
                v-for="(el, elIdx) in region.elements"
                :key="elIdx"
                :node="el"
              />
            </section>
          </div>

          <!-- 上下布局 -->
          <div
            v-else-if="regionLayoutMode === 'top-bottom'"
            class="h-full grid gap-5 min-h-0"
            :style="topBottomGridStyle"
          >
            <section
              v-for="(region, idx) in normalizedRegions"
              :key="'region-tb-' + idx"
              :class="getRegionClass(idx)"
            >
              <AstRenderer
                v-for="(el, elIdx) in region.elements"
                :key="elIdx"
                :node="el"
              />
            </section>
          </div>

          <!-- 网格布局 -->
          <div
            v-else-if="regionLayoutMode === 'grid'"
            class="h-full grid gap-5 min-h-0"
            :style="regionGridStyle"
          >
            <section
              v-for="(region, idx) in normalizedRegions"
              :key="'region-grid-' + idx"
              :class="getRegionClass(idx)"
            >
              <AstRenderer
                v-for="(el, elIdx) in region.elements"
                :key="elIdx"
                :node="el"
              />
            </section>
          </div>

          <!-- 其他显式布局兜底：按区域顺序上下堆叠 -->
          <div
            v-else
            class="h-full flex flex-col gap-5 max-h-full overflow-y-auto scrollbar-hide pr-4 text-[#222] text-[16px] leading-7"
          >
            <section
              v-for="(region, idx) in normalizedRegions"
              :key="'region-stack-' + idx"
              :class="[
                'article-flow min-w-0',
                idx > 0 ? 'border-t border-[#eaddea] pt-4' : ''
              ]"
            >
              <AstRenderer
                v-for="(el, elIdx) in region.elements"
                :key="elIdx"
                :node="el"
              />
            </section>
          </div>
        </div>

        <!-- 默认布局：没有 {} 时，始终像文章一样顺序排版 -->
        <div
          v-else
          class="article-flow h-full flex flex-col justify-start max-h-full overflow-y-auto scrollbar-hide pr-4 w-full text-[#222] text-[16px] leading-7"
        >
          <AstRenderer
            v-for="(el, idx) in allSlideElements"
            :key="idx"
            :node="el"
          />
        </div>
      </main>
    </template>
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}

.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.article-flow :deep(> *:first-child) {
  margin-top: 0 !important;
}

.article-flow :deep(> *:last-child) {
  margin-bottom: 0 !important;
}

/* 默认文章式排版：保持原来的阅读感，不压得太狠 */
.article-flow {
  font-size: 16px;
  line-height: 1.65;
}

/* 分块内部：只略微紧凑，不大幅缩小 */
.region-flow {
  font-size: 15px;
  line-height: 1.6;
}

/* 段落间距轻微压缩 */
.article-flow :deep(p),
.region-flow :deep(p) {
  margin-bottom: 0.75rem !important;
  line-height: 1.6 !important;
  font-size: inherit !important;
}

/* 列表轻微压缩 */
.article-flow :deep(ul),
.article-flow :deep(ol),
.region-flow :deep(ul),
.region-flow :deep(ol) {
  margin-bottom: 0.75rem !important;
  padding-left: 1.4rem !important;
  line-height: 1.6 !important;
  font-size: inherit !important;
}

.article-flow :deep(li),
.region-flow :deep(li) {
  margin-bottom: 0.25rem !important;
}

/* 小标题轻微压缩 */
.article-flow :deep(h3),
.region-flow :deep(h3) {
  margin-top: 0.9rem !important;
  margin-bottom: 0.5rem !important;
  font-size: 1.08rem !important;
  line-height: 1.35 !important;
}

.article-flow :deep(h4),
.region-flow :deep(h4) {
  margin-top: 0.75rem !important;
  margin-bottom: 0.45rem !important;
  font-size: 1rem !important;
  line-height: 1.35 !important;
}

/* 单张图片：完整显示，同时尽量放大 */
.article-flow :deep(img),
.article-flow :deep(video),
.region-flow :deep(img),
.region-flow :deep(video) {
  display: block !important;
  width: auto !important;
  height: auto !important;
  max-width: 100% !important;
  object-fit: contain !important;
  margin-left: auto !important;
  margin-right: auto !important;

  /* 覆盖 AstRenderer 里图片自带的边框，避免出现右侧大框 */
  border: none !important;
  background: transparent !important;
}

/* 默认文章流里的图片 */
.article-flow :deep(img),
.article-flow :deep(video) {
  max-height: 58vh !important;
}

/* 左右分栏：右侧图可以尽量吃满高度 */
.region-flow-left-right :deep(img),
.region-flow-left-right :deep(video) {
  max-height: 62vh !important;
}

/* 上下布局才需要限制高度 */
.region-flow-top-bottom :deep(img),
.region-flow-top-bottom :deep(video) {
  max-height: 30vh !important;
}

/* 网格布局再稍微小一点 */
.region-flow-grid :deep(img),
.region-flow-grid :deep(video) {
  max-height: 24vh !important;
}

/* 纯图片段落：作为图像区域处理，给图片更多空间 */
.article-flow :deep(.media-gallery),
.region-flow :deep(.media-gallery) {
  margin-top: 0.4rem !important;
  margin-bottom: 0.4rem !important;
  gap: 0.75rem !important;
  align-items: center !important;
  justify-items: center !important;
}

/* 分块里的纯媒体段落尽量撑满当前块 */
.region-flow :deep(.media-gallery) {
  flex: 1 1 auto;
  min-height: 0;
  width: 100%;
}

/* 覆盖 AstRenderer 里原来的 cover 裁切，但不强制产生大边框 */
.article-flow :deep(.media-gallery > img),
.article-flow :deep(.media-gallery > video),
.region-flow :deep(.media-gallery > img),
.region-flow :deep(.media-gallery > video) {
  width: auto !important;
  height: auto !important;
  max-width: 100% !important;
  object-fit: contain !important;
  aspect-ratio: auto !important;
  margin: 0 auto !important;
  border: none !important;
  background: transparent !important;
}

/* 默认区域媒体 */
.article-flow :deep(.media-gallery > img),
.article-flow :deep(.media-gallery > video) {
  max-height: 58vh !important;
}

/* 左右分栏媒体：尽量放大 */
.region-flow-left-right :deep(.media-gallery > img),
.region-flow-left-right :deep(.media-gallery > video) {
  max-height: 62vh !important;
}

/* 上下分栏媒体 */
.region-flow-top-bottom :deep(.media-gallery > img),
.region-flow-top-bottom :deep(.media-gallery > video) {
  max-height: 30vh !important;
}

/* 网格媒体 */
.region-flow-grid :deep(.media-gallery > img),
.region-flow-grid :deep(.media-gallery > video) {
  max-height: 24vh !important;
}

/* 表格只略微压缩 */
.article-flow :deep(table),
.region-flow :deep(table) {
  font-size: 0.9em !important;
}

.article-flow :deep(td),
.region-flow :deep(td) {
  padding: 0.45rem 0.65rem !important;
}

/* 数学公式不要压太小 */
.article-flow :deep(.math-display),
.region-flow :deep(.math-display) {
  margin-top: 0.7rem !important;
  margin-bottom: 0.7rem !important;
  padding: 0.7rem 0.9rem !important;
  font-size: 0.95em !important;
}

/* Mermaid 轻微压缩 */
.article-flow :deep(.mermaid-container),
.region-flow :deep(.mermaid-container) {
  margin-top: 0.7rem !important;
  margin-bottom: 0.7rem !important;
  padding: 0.7rem 0.9rem !important;
}

/* 代码块轻微压缩 */
.article-flow :deep(.code-card),
.region-flow :deep(.code-card) {
  margin-top: 0.7rem !important;
  margin-bottom: 0.7rem !important;
}

.article-flow :deep(.shiki-container),
.region-flow :deep(.shiki-container) {
  padding: 0.75rem 0.9rem !important;
}

.article-flow :deep(.code-card code),
.article-flow :deep(.shiki-container code),
.region-flow :deep(.code-card code),
.region-flow :deep(.shiki-container code) {
  font-size: 12px !important;
  line-height: 1.5 !important;
}

/* 引用轻微压缩 */
.article-flow :deep(blockquote),
.region-flow :deep(blockquote) {
  margin-top: 0.7rem !important;
  margin-bottom: 0.7rem !important;
  padding-top: 0.55rem !important;
  padding-bottom: 0.55rem !important;
}
</style>