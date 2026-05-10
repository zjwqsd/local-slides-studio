<script setup lang="ts">
import {
  ref,
  computed,
  watch,
  onMounted,
  onUnmounted,
  provide,
  nextTick,
} from 'vue';
import { parseMarkdownToSlides, type SlideNode } from './core/parser';
import SlideView from './components/SlideView.vue';

type FileTreeNode = {
  name: string;
  path: string;
  type: 'file' | 'dir';
  level: number;
  children: FileTreeNode[];
};

type VisibleTreeRow = FileTreeNode & {
  isExpanded?: boolean;
};

type AppConfig = {
  title?: string;
  workspaceName?: string;
  expandAllByDefault?: boolean;
};

const appConfig = ref<AppConfig>({
  title: 'Local Studio',
  workspaceName: 'Workspace',
  expandAllByDefault: true,
});

const fileList = ref<string[]>([]);
const currentFilePath = ref<string>('');
const currentMarkdown = ref('');
const slides = ref<SlideNode[]>([]);

const currentSlideIndex = ref(0);
const isExporting = ref(false);
const isPdfExport = ref(false);

const showSidebar = ref(true);
const expandedDirs = ref<Set<string>>(new Set());

/**
 * 不再提供主题切换。
 * 保留 isDark 只是为了兼容 AstRenderer 里的 Mermaid / Shiki。
 */
const isDark = ref(false);

const currentDir = computed(() => {
  if (!currentFilePath.value) return '';

  const parts = currentFilePath.value.split('/').filter(Boolean);
  parts.pop();

  return parts.join('/');
});

/**
 * 图片、视频等资源统一走后端 API。
 */
const assetBaseUrl = '/api/asset?path=';

provide('isDark', isDark);
provide('currentDir', currentDir);
provide('assetBaseUrl', assetBaseUrl);

const normalizePath = (path: string) => {
  return String(path || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
};

const isMarkdownFile = (path: string) => {
  return /\.(md|markdown)$/i.test(path);
};

const getDisplayName = (path: string) => {
  const normalized = normalizePath(path);
  return normalized.split('/').pop() || normalized;
};

const currentFileName = computed(() => {
  return currentFilePath.value ? getDisplayName(currentFilePath.value) : '未选择文件';
});

const fileTree = computed<FileTreeNode[]>(() => {
  const root: FileTreeNode[] = [];
  const dirMap = new Map<string, FileTreeNode>();

  const markdownFiles = fileList.value
    .map(normalizePath)
    .filter(Boolean)
    .filter(isMarkdownFile)
    .sort((a, b) => a.localeCompare(b, 'zh-CN'));

  for (const file of markdownFiles) {
    const parts = file.split('/').filter(Boolean);

    let currentChildren = root;
    let currentPath = '';

    parts.forEach((part, index) => {
      const isFile = index === parts.length - 1;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (isFile) {
        currentChildren.push({
          name: part,
          path: currentPath,
          type: 'file',
          level: index,
          children: [],
        });

        return;
      }

      let dirNode = dirMap.get(currentPath);

      if (!dirNode) {
        dirNode = {
          name: part,
          path: currentPath,
          type: 'dir',
          level: index,
          children: [],
        };

        dirMap.set(currentPath, dirNode);
        currentChildren.push(dirNode);
      }

      currentChildren = dirNode.children;
    });
  }

  const sortNodes = (nodes: FileTreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'dir' ? -1 : 1;
      }

      return a.name.localeCompare(b.name, 'zh-CN');
    });

    nodes.forEach(node => sortNodes(node.children));
  };

  sortNodes(root);

  return root;
});

const collectDirPaths = (nodes: FileTreeNode[]) => {
  const result: string[] = [];

  const walk = (items: FileTreeNode[]) => {
    for (const item of items) {
      if (item.type === 'dir') {
        result.push(item.path);
        walk(item.children);
      }
    }
  };

  walk(nodes);

  return result;
};

const expandAllDirs = () => {
  expandedDirs.value = new Set(collectDirPaths(fileTree.value));
};

const collapseAllDirs = () => {
  expandedDirs.value = new Set();
};

const expandToFile = (path: string) => {
  const normalized = normalizePath(path);
  const parts = normalized.split('/').filter(Boolean);

  if (parts.length <= 1) return;

  const next = new Set(expandedDirs.value);
  let current = '';

  for (let i = 0; i < parts.length - 1; i++) {
    current = current ? `${current}/${parts[i]}` : parts[i];
    next.add(current);
  }

  expandedDirs.value = next;
};

const visibleTreeRows = computed<VisibleTreeRow[]>(() => {
  const rows: VisibleTreeRow[] = [];

  const walk = (nodes: FileTreeNode[]) => {
    for (const node of nodes) {
      const isExpanded = expandedDirs.value.has(node.path);

      rows.push({
        ...node,
        isExpanded,
      });

      if (node.type === 'dir' && isExpanded) {
        walk(node.children);
      }
    }
  };

  walk(fileTree.value);

  return rows;
});

const toggleDir = (path: string) => {
  const next = new Set(expandedDirs.value);

  if (next.has(path)) {
    next.delete(path);
  } else {
    next.add(path);
  }

  expandedDirs.value = next;
};

const fetchConfig = async () => {
  try {
    const res = await fetch('/api/config');

    if (!res.ok) return;

    const config = await res.json();

    appConfig.value = {
      title: config.title || 'Local Studio',
      workspaceName: config.workspaceName || 'Workspace',
      expandAllByDefault: config.expandAllByDefault ?? true,
    };
  } catch {
    // 配置接口失败不影响主流程
  }
};

const readMarkdown = async (path: string) => {
  const params = new URLSearchParams();
  params.set('path', path);

  const res = await fetch(`/api/read?${params.toString()}`);

  if (!res.ok) {
    throw new Error(`读取文件失败：${path}`);
  }

  currentMarkdown.value = await res.text();
};

const loadFile = async (path: string, options?: { resetSlide?: boolean }) => {
  const shouldResetSlide = options?.resetSlide ?? true;

  currentFilePath.value = normalizePath(path);

  if (shouldResetSlide) {
    currentSlideIndex.value = 0;
  }

  expandToFile(currentFilePath.value);

  await readMarkdown(currentFilePath.value);
};

const fetchFiles = async (options?: { keepCurrent?: boolean }) => {
  const res = await fetch('/api/files');

  if (!res.ok) {
    throw new Error('获取文件列表失败');
  }

  const files = await res.json();

  fileList.value = Array.isArray(files)
    ? files.map(normalizePath).filter(Boolean)
    : [];

  await nextTick();

  if (!options?.keepCurrent && appConfig.value.expandAllByDefault) {
    expandAllDirs();
  }

  const urlParams = new URLSearchParams(window.location.search);
  const initFile = urlParams.get('file');

  isPdfExport.value = urlParams.get('export') === 'true';

  if (isPdfExport.value) {
    document.body.classList.add('export-mode');

    setTimeout(() => {
      [
        document.documentElement,
        document.body,
        document.getElementById('app'),
      ].forEach(el => {
        if (el) {
          el.style.setProperty('height', 'auto', 'important');
          el.style.setProperty('min-height', '100vh', 'important');
          el.style.setProperty('max-height', 'none', 'important');
          el.style.setProperty('overflow', 'visible', 'important');
          el.style.setProperty('position', 'static', 'important');
        }
      });
    }, 50);
  }

  if (options?.keepCurrent && currentFilePath.value) {
    const stillExists = fileList.value.includes(currentFilePath.value);

    if (stillExists) {
      await readMarkdown(currentFilePath.value);
      return;
    }
  }

  const normalizedInitFile = initFile ? normalizePath(initFile) : '';

  if (normalizedInitFile && fileList.value.includes(normalizedInitFile)) {
    await loadFile(normalizedInitFile, { resetSlide: true });
    return;
  }

  if (fileList.value.length > 0 && !currentFilePath.value) {
    await loadFile(fileList.value[0], { resetSlide: true });
  }
};

const refreshFiles = async () => {
  try {
    await fetchFiles({ keepCurrent: true });
  } catch (error) {
    alert(error);
  }
};

watch(currentMarkdown, async newMd => {
  const previousIndex = currentSlideIndex.value;

  slides.value = parseMarkdownToSlides(newMd);

  await nextTick();

  if (slides.value.length === 0) {
    currentSlideIndex.value = 0;
  } else {
    currentSlideIndex.value = Math.min(previousIndex, slides.value.length - 1);
  }
});

if (import.meta.hot) {
  import.meta.hot.on('md-update', async payload => {
    const payloadPath = normalizePath(payload.path);

    if (payload.type === 'add' || payload.type === 'unlink') {
      await fetchFiles({ keepCurrent: true });
      return;
    }

    if (payloadPath === currentFilePath.value) {
      await readMarkdown(currentFilePath.value);
    }
  });
}

const exportPdf = async () => {
  if (isExporting.value || !currentFilePath.value) return;

  isExporting.value = true;

  try {
    const params = new URLSearchParams();

    params.set('file', currentFilePath.value);
    params.set('mode', 'slides');

    const res = await fetch(`/api/export-pdf?${params.toString()}`);

    if (!res.ok) {
      throw new Error('导出失败，请检查终端日志');
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download =
      currentFilePath.value
        .split('/')
        .pop()
        ?.replace(/\.(md|markdown)$/i, '.pdf') || 'export.pdf';

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    window.URL.revokeObjectURL(url);
  } catch (error) {
    alert(error);
  } finally {
    isExporting.value = false;
  }
};

const goPrevSlide = () => {
  if (currentSlideIndex.value > 0) {
    currentSlideIndex.value--;
  }
};

const goNextSlide = () => {
  if (currentSlideIndex.value < slides.value.length - 1) {
    currentSlideIndex.value++;
  }
};

const handleKeydown = async (e: KeyboardEvent) => {
  const target = e.target as HTMLElement;

  if (['INPUT', 'TEXTAREA'].includes(target.tagName)) return;

  if (e.key.toLowerCase() === 'e') {
    showSidebar.value = !showSidebar.value;
  }

  if (e.key.toLowerCase() === 'p' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    await exportPdf();
  }

  if (slides.value.length > 0) {
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
      e.preventDefault();
      goNextSlide();
    }

    if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      e.preventDefault();
      goPrevSlide();
    }
  }
};

onMounted(async () => {
  try {
    await fetchConfig();
    await fetchFiles();
  } catch (error) {
    alert(error);
  }

  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <!-- PDF 导出模式：只输出 SlideView -->
  <div
    v-if="isPdfExport"
    class="bg-white min-h-screen"
  >
    <div class="w-full">
      <div
        v-for="(slide, index) in slides"
        :key="index"
        style="width: 1920px; height: 1080px; page-break-after: always; overflow: hidden;"
      >
        <SlideView :slide="slide" />
      </div>
    </div>
  </div>

  <!-- 普通预览模式 -->
  <div
    v-else
    class="w-screen h-screen overflow-hidden bg-gray-100 flex relative"
  >
    <!-- 左侧文件树 -->
    <aside
      v-if="showSidebar"
      class="w-[320px] h-full bg-white border-r border-gray-200 flex flex-col shrink-0 z-20"
    >
      <!-- 顶部 -->
      <div class="px-4 py-4 border-b border-gray-200 bg-gray-50">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="text-sm font-extrabold text-gray-800 tracking-wide">
              {{ appConfig.title }}
            </div>

            <div
              class="text-[11px] text-gray-400 mt-1 truncate"
              :title="appConfig.workspaceName"
            >
              {{ appConfig.workspaceName }}
            </div>
          </div>

          <button
            class="shrink-0 text-xs text-gray-500 hover:text-[#6f145f] transition-colors"
            title="刷新文件"
            @click="refreshFiles"
          >
            刷新
          </button>
        </div>

        <div class="mt-3 flex items-center gap-3 text-[11px] text-gray-400">
          <button
            class="hover:text-[#6f145f] transition-colors"
            @click="expandAllDirs"
          >
            全部展开
          </button>

          <span class="text-gray-300">/</span>

          <button
            class="hover:text-[#6f145f] transition-colors"
            @click="collapseAllDirs"
          >
            全部收起
          </button>
        </div>
      </div>

      <!-- 文件树 -->
      <div class="flex-1 overflow-y-auto custom-scrollbar py-3">
        <div
          v-if="visibleTreeRows.length === 0"
          class="px-4 py-8 text-sm text-gray-400 leading-6"
        >
          配置目录下没有 Markdown 文件。
        </div>

        <div
          v-for="node in visibleTreeRows"
          :key="node.path"
          class="select-none"
        >
          <!-- 目录 -->
          <button
            v-if="node.type === 'dir'"
            class="w-full h-8 flex items-center gap-1.5 pr-3 text-left text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            :style="{ paddingLeft: `${12 + node.level * 16}px` }"
            @click="toggleDir(node.path)"
          >
            <span class="w-4 text-[10px] text-gray-400">
              {{ node.isExpanded ? '▾' : '▸' }}
            </span>

            <span class="text-gray-400">
              {{ node.isExpanded ? '📂' : '📁' }}
            </span>

            <span class="truncate font-medium">
              {{ node.name }}
            </span>
          </button>

          <!-- 文件 -->
          <button
            v-else
            class="w-full h-8 flex items-center gap-1.5 pr-3 text-left text-sm transition-colors border-l-2"
            :style="{ paddingLeft: `${12 + node.level * 16}px` }"
            :class="node.path === currentFilePath
              ? 'bg-[#f8f3f7] text-[#6f145f] border-[#6f145f] font-semibold'
              : 'text-gray-600 border-transparent hover:bg-gray-50'"
            :title="node.path"
            @click="loadFile(node.path, { resetSlide: true })"
          >
            <span class="w-4"></span>

            <span class="text-gray-400">
              📝
            </span>

            <span class="truncate">
              {{ node.name }}
            </span>
          </button>
        </div>
      </div>

      <!-- 底部状态 -->
      <div class="px-4 py-3 border-t border-gray-200 bg-gray-50">
        <div
          class="text-[11px] text-gray-400 truncate"
          :title="currentFilePath"
        >
          {{ currentFilePath || '未选择 Markdown 文件' }}
        </div>
      </div>
    </aside>

    <!-- SlideView 预览区 -->
    <main class="flex-1 h-full overflow-hidden bg-gray-100 relative">
      <transition
        name="fade-view"
        mode="out-in"
      >
        <SlideView
          v-if="slides.length > 0"
          :key="currentSlideIndex"
          :slide="slides[currentSlideIndex]"
        />

        <div
          v-else
          key="empty"
          class="h-full flex items-center justify-center text-gray-400 text-sm"
        >
          请选择一个 Markdown 文件。
        </div>
      </transition>

      <!-- 当前文件名 -->
      <div
        v-if="slides.length > 0"
        class="fixed top-5 z-50 bg-white/80 text-gray-500 text-xs px-3 py-1 rounded-full shadow-sm backdrop-blur"
        :class="showSidebar ? 'left-[344px]' : 'left-6'"
      >
        {{ currentFileName }}
      </div>

      <!-- 页码 -->
      <div
        v-if="slides.length > 0"
        class="fixed bottom-6 right-8 z-50 bg-gray-800/60 text-white font-mono text-xs px-3 py-1.5 rounded-full shadow backdrop-blur"
      >
        {{ currentSlideIndex + 1 }} / {{ slides.length }}
      </div>

      <!-- 导出 Loading -->
      <transition name="fade-view">
        <div
          v-if="isExporting"
          class="absolute bottom-24 right-8 bg-[#6f145f] text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 z-50 font-bold tracking-wide"
        >
          <svg
            class="animate-spin h-5 w-5 text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            />

            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>

          正在导出 PDF...
        </div>
      </transition>
    </main>
  </div>
</template>

<style>
.fade-view-enter-active,
.fade-view-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.fade-view-enter-from {
  opacity: 0;
  transform: translateY(10px);
}

.fade-view-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 10px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

:global(body.export-mode) #app {
  height: auto !important;
  max-height: none !important;
  overflow: visible !important;
  background: white !important;
}

:global(body.export-mode) .overflow-y-auto,
:global(body.export-mode) .custom-scrollbar,
:global(body.export-mode) .h-full,
:global(body.export-mode) .h-screen {
  height: auto !important;
  max-height: none !important;
  overflow: visible !important;
}
</style>