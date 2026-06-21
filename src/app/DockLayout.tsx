import { useMemo, useRef } from 'react';
import { DockviewReact, type DockviewApi, type DockviewReadyEvent, type IDockviewPanelProps } from 'dockview';
import { allowDrop, handleViewportDrop } from '@/io/dropTarget';
import { ContentBrowser } from '@/panels/ContentBrowser';
import { Outline } from '@/panels/Outline';
import { Inspector } from '@/panels/Inspector';
import { StatsBar } from '@/panels/StatsBar';
import { RenderSettingsPanel } from '@/panels/RenderSettingsPanel';
import { LibraryBrowser } from '@/panels/LibraryBrowser';
import { Scene } from '@/scene/Scene';
import { ViewportToolbar } from '@/scene/ViewportToolbar';
import { FpsCounter } from '@/scene/FpsCounter';
import { CameraSpeedControl } from '@/panels/CameraSpeedControl';
import { usePlanner } from '@/state/store';
import { clearDockLayout, readDockLayout, writeDockLayout } from './dockLayoutPersistence';
import { notifyDockLayoutChanged, setDockLayoutController, type DockPanelId } from './dockLayoutController';

let saveTimer: number | undefined;
type LocalizedDockPanelId = 'content' | 'outliner' | 'library' | 'viewport' | 'details' | 'render' | 'stats';

function dockTitle(key: LocalizedDockPanelId) {
  const { locale } = usePlanner.getState();
  const zh: Record<LocalizedDockPanelId, string> = {
    content: '内容',
    outliner: '大纲',
    library: '资产库',
    viewport: '视口',
    details: '细节',
    render: '渲染',
    stats: '统计',
  };
  const en: Record<LocalizedDockPanelId, string> = {
    content: 'Content',
    outliner: 'Outliner',
    library: 'Library',
    viewport: 'Viewport',
    details: 'Details',
    render: 'Render',
    stats: 'Stats',
  };
  return locale === 'zh' ? zh[key] : en[key];
}

function ViewportPanel() {
  return (
    <main
      className="relative h-full min-h-0 bg-[var(--color-canvas-bg)]"
      onDrop={handleViewportDrop}
      onDragOver={allowDrop}
    >
      <Scene />
      <ViewportToolbar />
      <FpsCounter />
      <CameraSpeedControl />
    </main>
  );
}

function StatsPanel() {
  return (
    <div className="h-full min-h-0 bg-[var(--color-panel)]">
      <StatsBar />
    </div>
  );
}

function PlaceholderPanel({ params }: IDockviewPanelProps<{ title?: string }>) {
  return (
    <div className="flex h-full items-center justify-center bg-[var(--color-panel)] text-[11px] text-[var(--color-text-faint)]">
      {params.title ?? 'Panel'}
    </div>
  );
}

function saveLayout(api: DockviewApi) {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      writeDockLayout(api.toJSON());
    } catch {
      // localStorage may be unavailable in privacy modes; layout persistence is best effort.
    }
  }, 250);
}

function createDefaultLayout(api: DockviewApi) {
  // #WDD-gpt 2026-06-20 - 紧凑面板宽度：左 240 / 右 280，让中间视口最大化。
  // minimumWidth 防止用户把面板拖到无法使用；initialWidth 用于新拆分出的面板。
  // 注意：先建全宽 content，再把 viewport/details 拆到它右侧——content 是被参照的旧面板，
  // initialWidth 对它无效，故末尾用 setSize 显式把左侧压到 240。
  const contentPanel = api.addPanel({
    id: 'content',
    component: 'content',
    title: dockTitle('content'),
    minimumWidth: 200,
  });
  api.addPanel({
    id: 'outliner',
    component: 'outliner',
    title: dockTitle('outliner'),
    position: { referencePanel: 'content', direction: 'within' },
    inactive: true,
  });
  api.addPanel({
    id: 'library',
    component: 'library',
    title: dockTitle('library'),
    position: { referencePanel: 'content', direction: 'within' },
    inactive: true,
  });
  api.addPanel({
    id: 'viewport',
    component: 'viewport',
    title: dockTitle('viewport'),
    position: { referencePanel: 'content', direction: 'right' },
  });
  const detailsPanel = api.addPanel({
    id: 'details',
    component: 'details',
    title: dockTitle('details'),
    position: { referencePanel: 'viewport', direction: 'right' },
    initialWidth: 280,
    minimumWidth: 220,
  });
  api.addPanel({
    id: 'render',
    component: 'render',
    title: dockTitle('render'),
    position: { referencePanel: 'details', direction: 'within' },
    inactive: true,
  });
  const statsPanel = api.addPanel({
    id: 'stats',
    component: 'stats',
    title: dockTitle('stats'),
    position: { referencePanel: 'viewport', direction: 'below' },
    minimumHeight: 32,
  });
  // 紧凑两侧宽度 + 底部统计条高度：initialWidth/initialHeight 在「参照旧面板」+「新面板」
  // 组合下不稳定，故在布局建完后用 setSize 显式定尺寸。顺序：先缩 content（从相邻 viewport
  // 抢空间），再缩 details（从相邻 viewport 抢空间），再缩 stats 高度，让 viewport 吸收调整。
  contentPanel.api.setSize({ width: 240 });
  detailsPanel.api.setSize({ width: 280 });
  statsPanel.api.setSize({ height: 50 });
}

function addPanelById(api: DockviewApi, panelId: DockPanelId) {
  if (api.getPanel(panelId)) return;
  if (panelId === 'content') {
    api.addPanel({ id: 'content', component: 'content', title: dockTitle('content'), position: { direction: 'left' } });
    return;
  }
  if (panelId === 'outliner') {
    api.addPanel({ id: 'outliner', component: 'outliner', title: dockTitle('outliner'), position: { referencePanel: 'content', direction: 'within' } });
    return;
  }
  if (panelId === 'details') {
    api.addPanel({ id: 'details', component: 'details', title: dockTitle('details'), position: { direction: 'right' } });
    return;
  }
  if (panelId === 'render') {
    api.addPanel({ id: 'render', component: 'render', title: dockTitle('render'), position: { referencePanel: 'details', direction: 'within' } });
    return;
  }
  if (panelId === 'library') {
    api.addPanel({ id: 'library', component: 'library', title: dockTitle('library'), position: { referencePanel: 'content', direction: 'within' } });
    return;
  }
  api.addPanel({ id: 'stats', component: 'stats', title: dockTitle('stats'), position: { direction: 'below' } });
}

function restoreSavedLayout(api: DockviewApi): boolean {
  const savedLayout = readDockLayout();
  if (!savedLayout) return false;
  try {
    api.fromJSON(savedLayout);
    return true;
  } catch {
    clearDockLayout();
    return false;
  }
}

// #WDD-gpt  2026-06-19 - 用 Dockview 替换手写 PanelWrapper 主布局，获得高性能 tabs/split/docking/floating 与布局持久化
export function DockLayout() {
  const apiRef = useRef<DockviewApi | null>(null);
  const components = useMemo(
    () => ({
      content: ContentBrowser,
      outliner: Outline,
      viewport: ViewportPanel,
      details: Inspector,
      render: RenderSettingsPanel,
      library: LibraryBrowser,
      stats: StatsPanel,
      placeholder: PlaceholderPanel,
    }),
    [],
  );

  const handleReady = (event: DockviewReadyEvent) => {
    apiRef.current = event.api;
    // #WDD-gpt  2026-06-19 - 浏览器恢复 Dockview 序列化布局，保留 split 宽高、tab、关闭面板与 floating 状态
    if (!restoreSavedLayout(event.api)) {
      createDefaultLayout(event.api);
    }
    setDockLayoutController({
      togglePanel: (panelId) => {
        const panel = event.api.getPanel(panelId);
        if (panel) {
          panel.api.close();
        } else {
          addPanelById(event.api, panelId);
        }
      },
      isPanelVisible: (panelId) => Boolean(event.api.getPanel(panelId)),
    });
    event.api.onDidLayoutChange(() => {
      saveLayout(event.api);
      notifyDockLayoutChanged();
    });
    saveLayout(event.api);
    notifyDockLayoutChanged();
  };

  return (
    <div className="planner-dockview dockview-theme-dark h-full min-h-[320px] w-full">
      <DockviewReact
        components={components}
        onReady={handleReady}
        disableFloatingGroups={false}
        className="h-full min-h-[320px]"
      />
    </div>
  );
}
