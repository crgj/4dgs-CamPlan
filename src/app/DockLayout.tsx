import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
import { useTranslation } from '@/lib/i18n';
import { notifyDockLayoutChanged, setDockLayoutController, type DockPanelId } from './dockLayoutController';

type LeftPanelId = 'content' | 'outliner' | 'library';
type RightPanelId = 'details' | 'render';

const LEFT_PANEL_ORDER: DockPanelId[] = ['content', 'library', 'outliner'];
const RIGHT_PANEL_ORDER: DockPanelId[] = ['details', 'render'];

function ViewportPanel() {
  const projection = usePlanner((s) => s.view.projection);
  const setProjection = usePlanner((s) => s.setProjection);
  const { locale } = useTranslation();
  const isPerspective = projection === 'perspective';

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
      {/* #WDD-gpt  2026-06-21 - 右下视角导航旁增加返回透视按钮，辅助从顶/前/侧视图快速回到透视 */}
      <button
        type="button"
        onClick={() => setProjection('perspective')}
        className={`pointer-events-auto absolute bottom-2 right-[86px] z-30 flex h-6 w-6 items-center justify-center rounded-[2px] border backdrop-blur transition-colors ${
          isPerspective
            ? 'border-[var(--color-panel-border)] bg-[rgba(30,30,30,0.58)] text-[var(--color-text-faint)] hover:border-[var(--color-accent)] hover:bg-[rgba(45,45,45,0.82)] hover:text-[var(--color-text)]'
            : 'border-[var(--color-accent)] bg-[rgba(10,143,239,0.16)] text-[var(--color-text)] hover:bg-[rgba(10,143,239,0.28)] hover:text-white'
        }`}
        title={locale === 'zh' ? '返回透视视图' : 'Return to perspective view'}
        aria-label={locale === 'zh' ? '返回透视视图' : 'Return to perspective view'}
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3 5.2 8 2.6l5 2.6v5.6l-5 2.6-5-2.6V5.2Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
          <path d="M3.4 5.4 8 7.8l4.6-2.4M8 7.8v5.1" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity="0.82" />
        </svg>
      </button>
    </main>
  );
}

function panelTitle(panelId: DockPanelId, locale: 'zh' | 'en') {
  const zh: Record<DockPanelId, string> = {
    content: '内容',
    outliner: '大纲',
    details: '细节',
    stats: '统计',
    render: '渲染',
    library: '资产库',
  };
  const en: Record<DockPanelId, string> = {
    content: 'Content',
    outliner: 'Outliner',
    details: 'Details',
    stats: 'Stats',
    render: 'Render',
    library: 'Library',
  };
  return locale === 'zh' ? zh[panelId] : en[panelId];
}

function TabButton({
  active,
  panelId,
  children,
  onClick,
}: {
  active: boolean;
  panelId: DockPanelId;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('application/x-dock-panel', panelId);
        e.dataTransfer.effectAllowed = 'move';
      }}
      className={`h-7 border-r border-[var(--color-panel-border)] px-3 text-[11px] ${
        active
          ? 'bg-[var(--color-panel)] text-[var(--color-text)]'
          : 'bg-[var(--color-panel-header)] text-[var(--color-text-dim)] hover:text-[var(--color-text)]'
      }`}
    >
      {children}
    </button>
  );
}

function PanelShell({
  side,
  tabs,
  active,
  setActive,
  children,
}: {
  side: 'left' | 'right' | 'bottom';
  tabs: DockPanelId[];
  active: DockPanelId;
  setActive: (id: DockPanelId) => void;
  children: ReactNode;
}) {
  const { locale } = useTranslation();
  return (
    <section
      className={`flex min-h-0 flex-col overflow-hidden border-[var(--color-panel-border)] bg-[var(--color-panel)] ${
        side === 'left'
          ? 'border-r'
          : side === 'right'
            ? 'border-l'
            : 'border-t'
      }`}
    >
      <div className="flex h-7 shrink-0 overflow-hidden border-b border-[var(--color-panel-border)] bg-[var(--color-panel-header)]">
        {tabs.map((tab) => (
          <TabButton key={tab} panelId={tab} active={active === tab} onClick={() => setActive(tab)}>
            {panelTitle(tab, locale)}
          </TabButton>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </section>
  );
}

function renderPanel(panelId: DockPanelId) {
  if (panelId === 'content') return <ContentBrowser />;
  if (panelId === 'outliner') return <Outline />;
  if (panelId === 'library') return <LibraryBrowser />;
  if (panelId === 'details') return <Inspector />;
  if (panelId === 'render') return <RenderSettingsPanel />;
  return <StatsBar />;
}

// #WDD-gpt  2026-06-21 - 主视口脱离 Dockview，作为固定中心区域渲染；视口不再有 tab，也不能被拖拽/移动
export function DockLayout() {
  // panel positions: 'left' | 'right' | 'bottom' | 'hidden'
  const [positions, setPositions] = useState<Record<DockPanelId, 'left' | 'right' | 'bottom' | 'hidden'>>({
    content: 'left',
    outliner: 'left',
    library: 'left',
    details: 'right',
    render: 'right',
    stats: 'bottom',
  });
  const [activeLeft, setActiveLeft] = useState<DockPanelId>('content');
  const [activeRight, setActiveRight] = useState<DockPanelId>('details');

  const visibleLeft = useMemo(() => Object.keys(positions).filter((k) => positions[k as DockPanelId] === 'left') as DockPanelId[], [positions]);
  const visibleRight = useMemo(() => Object.keys(positions).filter((k) => positions[k as DockPanelId] === 'right') as DockPanelId[], [positions]);
  // #WDD-gpt  2026-06-21 - 固定左/右面板 tab 的显示顺序，避免大纲与资产库顺序跳动
  const orderedVisibleLeft = useMemo(() =>
    visibleLeft.slice().sort((a, b) => LEFT_PANEL_ORDER.indexOf(a) - LEFT_PANEL_ORDER.indexOf(b)),
    [visibleLeft]
  );
  const orderedVisibleRight = useMemo(() =>
    visibleRight.slice().sort((a, b) => RIGHT_PANEL_ORDER.indexOf(a) - RIGHT_PANEL_ORDER.indexOf(b)),
    [visibleRight]
  );
  const effectiveActiveLeft = orderedVisibleLeft.includes(activeLeft) ? activeLeft : (orderedVisibleLeft[0] ?? 'content');
  const effectiveActiveRight = orderedVisibleRight.includes(activeRight) ? activeRight : (orderedVisibleRight[0] ?? 'details');

  useEffect(() => {
    setDockLayoutController({
      togglePanel: (panelId) => {
        setPositions((current) => {
          const cur = current[panelId];
          const next = { ...current } as typeof current;
          if (cur === 'hidden') {
            // show default side: prefer original grouping
            const defaultSide: Record<DockPanelId, 'left' | 'right' | 'bottom'> = {
              content: 'left',
              outliner: 'left',
              library: 'left',
              details: 'right',
              render: 'right',
              stats: 'bottom',
            };
            next[panelId] = defaultSide[panelId];
            if (next[panelId] === 'left') setActiveLeft(panelId);
            if (next[panelId] === 'right') setActiveRight(panelId);
          } else {
            next[panelId] = 'hidden';
          }
          window.setTimeout(notifyDockLayoutChanged, 0);
          return next;
        });
      },
      isPanelVisible: (panelId) => positions[panelId] !== 'hidden',
    });
    notifyDockLayoutChanged();
    return () => setDockLayoutController(null);
  }, [positions]);

  return (
    <div
      className="grid h-full min-h-[320px] w-full overflow-hidden bg-[var(--color-canvas-bg)]"
      style={{
        gridTemplateColumns: `${visibleLeft.length > 0 ? '240px' : '0px'} minmax(0, 1fr) ${
          visibleRight.length > 0 ? '300px' : '0px'
        }`,
        gridTemplateRows: `minmax(0, 1fr) ${positions.stats !== 'hidden' ? '50px' : '0px'}`,
      }}
    >
      {visibleLeft.length > 0 && (
            <div
              className="col-start-1 row-span-2 min-h-0"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const pid = e.dataTransfer.getData('application/x-dock-panel') as DockPanelId | '';
                if (!pid) return;
                setPositions((cur) => ({ ...cur, [pid]: 'left' }));
                setActiveLeft(pid);
                window.setTimeout(notifyDockLayoutChanged, 0);
              }}
            >
          <PanelShell
            side="left"
            tabs={orderedVisibleLeft}
            active={effectiveActiveLeft}
            setActive={(id) => setActiveLeft(id as LeftPanelId)}
          >
            {renderPanel(effectiveActiveLeft)}
          </PanelShell>
        </div>
      )}

      <div className="col-start-2 row-start-1 min-h-0 min-w-0">
        <ViewportPanel />
      </div>

      {visibleRight.length > 0 && (
            <div
              className="col-start-3 row-span-2 min-h-0"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const pid = e.dataTransfer.getData('application/x-dock-panel') as DockPanelId | '';
                if (!pid) return;
                setPositions((cur) => ({ ...cur, [pid]: 'right' }));
                setActiveRight(pid);
                window.setTimeout(notifyDockLayoutChanged, 0);
              }}
            >
          <PanelShell
            side="right"
            tabs={orderedVisibleRight}
            active={effectiveActiveRight}
            setActive={(id) => setActiveRight(id as RightPanelId)}
          >
            {renderPanel(effectiveActiveRight)}
          </PanelShell>
        </div>
      )}

      {positions.stats !== 'hidden' && (
            <div
              className="col-start-2 row-start-2 min-h-0 min-w-0"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                const pid = e.dataTransfer.getData('application/x-dock-panel') as DockPanelId | '';
                if (!pid) return;
                setPositions((cur) => ({ ...cur, [pid]: 'bottom' }));
                window.setTimeout(notifyDockLayoutChanged, 0);
              }}
            >
          <PanelShell side="bottom" tabs={['stats']} active="stats" setActive={() => undefined}>
            <StatsBar />
          </PanelShell>
        </div>
      )}
    </div>
  );
}
