// WDD -gemini 2026-06-19 重构 App 顶层容器，支持 MenuBar 下拉菜单、中英文一键切换、以及多面板动态停靠/悬浮/拖动/缩放/折叠布局

import { useKeyboard } from '@/io/useKeyboard';
import { useAutosave } from '@/io/useAutosave';
import { MenuBar } from '@/panels/MenuBar';
import { MessageLog } from '@/panels/MessageLog';
import { Preferences } from '@/panels/Preferences';
import { WorldSettings } from '@/panels/WorldSettings';
import { usePlanner } from '@/state/store';
import { Shortcuts } from '@/panels/Shortcuts';
import { useTranslation } from '@/lib/i18n';
import { DockLayout } from './DockLayout';
import { isDockPanelVisible, subscribeDockLayout, toggleDockPanel } from './dockLayoutController';
import { useSyncExternalStore } from 'react';

function DockPanelToggle({
  side,
  active,
  onClick,
  title,
}: {
  side: 'left' | 'right';
  active: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`group relative flex h-7 w-7 items-center justify-center rounded-[2px] border text-[12px] transition-colors ${
        active
          ? 'border-[var(--color-panel-border)] bg-[var(--color-panel-raised)] text-[var(--color-accent)]'
          : 'border-transparent bg-transparent text-[var(--color-text-dim)] hover:border-[var(--color-panel-border)] hover:bg-[var(--color-panel-raised)] hover:text-[var(--color-text)]'
      }`}
    >
      {/* #WDD-gpt  2026-06-21 - Dock 显隐按钮选中态改为细状态条，避免 topbar 大面积蓝底突兀 */}
      <span className={`absolute bottom-[2px] left-1 right-1 h-[2px] rounded-full ${active ? 'bg-[var(--color-accent)]' : 'bg-transparent'}`} />
      <span className="relative h-3.5 w-4 rounded-[1px] border border-current opacity-90">
        <span
          className={`absolute top-0 h-full w-[5px] bg-current opacity-55 ${
            side === 'left' ? 'left-0' : 'right-0'
          }`}
        />
      </span>
    </button>
  );
}

export function App() {
  useKeyboard();
  useAutosave();
  const { locale } = useTranslation();
  const showLogs = usePlanner((s) => s.showLogs);
  const activeOverlay = usePlanner((s) => s.activeOverlay);
  const setActiveOverlay = usePlanner((s) => s.setActiveOverlay);
  const dirty = usePlanner((s) => s.dirty);
  const currentFileName = usePlanner((s) => s.currentFileName);
  const leftVisible = useSyncExternalStore(
    subscribeDockLayout,
    () => isDockPanelVisible('content') || isDockPanelVisible('outliner'),
    () => true,
  );
  const rightVisible = useSyncExternalStore(
    subscribeDockLayout,
    () => isDockPanelVisible('details'),
    () => true,
  );

  return (
    <div className="flex h-full w-full flex-col bg-[var(--color-canvas-bg)] text-[var(--color-text)] relative overflow-hidden select-none">
      {/* 顶部 Header：Unreal Editor 5 工业风格，合并了 MenuBar 和 Toolbar */}
      <header className="flex h-9 shrink-0 items-center gap-3 border-b border-[var(--color-panel-border)] bg-[var(--color-panel)] px-3 text-[var(--text-label)] text-[var(--color-text-dim)] z-50">
        <div className="flex items-center gap-2">
          {/* #WDD-gpt  2026-06-20 - Logo 改为单摄像机结合地面 Grid，表达机位规划空间 */}
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="shrink-0" aria-hidden="true">
            <path d="M1.8 12.6 7.2 8.95 16.2 11.7 10.7 15.55Z" fill="#1c1c1c" stroke="#3a3a3a" strokeWidth="0.9" strokeLinejoin="round" />
            <path d="M4.05 11.1 13.2 13.95M6.45 9.5 15.45 12.25M5.55 14.1 11.05 10.3M9.05 15.1 14.55 11.25" stroke="#22a8f2" strokeOpacity="0.58" strokeWidth="0.72" strokeLinecap="round" />
            <path d="M8.25 6.95 14.85 9.15 10.1 12.25Z" fill="rgba(34,168,242,0.14)" stroke="#22a8f2" strokeWidth="1" strokeLinejoin="round" />
            <path d="M2.3 4.05h6.4a1.25 1.25 0 0 1 1.25 1.25v4.05A1.25 1.25 0 0 1 8.7 10.6H2.3a1.25 1.25 0 0 1-1.25-1.25V5.3A1.25 1.25 0 0 1 2.3 4.05Z" fill="#2f3640" stroke="#c0c0c0" strokeWidth="1.05" />
            <path d="M3.05 4.05 3.9 2.65h2.45l0.82 1.4" stroke="#c0c0c0" strokeWidth="1.05" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="5.55" cy="7.32" r="1.65" fill="#11161c" stroke="#22a8f2" strokeWidth="1.05" />
            <circle cx="5.55" cy="7.32" r="0.58" fill="#22a8f2" />
          </svg>
          <span className="font-bold tracking-wider text-[var(--color-text)]">CamPlan </span> 
          <span className="text-[10px] font-normal text-[var(--color-text-faint)]">v1.3 </span>
        </div>
        <div className="h-4 w-px bg-[var(--color-panel-border)]" />
        
        {/* 顶部菜单系统 */}
        <MenuBar />

        <div className="h-4 w-px bg-[var(--color-panel-border)]" />
        <div className="flex items-center gap-1">
          {/* #WDD-gpt  2026-06-19 - 顶栏增加左右 Dock 面板显隐按钮 */}
          <DockPanelToggle
            side="left"
            active={leftVisible}
            onClick={() => {
              toggleDockPanel('content');
              toggleDockPanel('outliner');
            }}
            title={locale === 'zh' ? '显示/隐藏左侧内容与大纲' : 'Show/hide left content and outliner'}
          />
          <DockPanelToggle
            side="right"
            active={rightVisible}
            onClick={() => toggleDockPanel('details')}
            title={locale === 'zh' ? '显示/隐藏右侧细节面板' : 'Show/hide right details panel'}
          />
          <button
            type="button"
            onClick={() => setActiveOverlay(activeOverlay === 'shortcuts' ? null : 'shortcuts')}
            title={locale === 'zh' ? '显示/隐藏快捷按键帮助' : 'Show/hide shortcuts help'}
            className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] border text-[12px] border-[var(--color-panel-border)] bg-[var(--color-recessed)] text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
          >
            ?
          </button>
        </div>
        
        <span className="ml-auto text-[10px] text-[var(--color-text-faint)] flex items-center gap-2">
          {currentFileName && (
            <span className="text-[var(--color-text-dim)]">
              {currentFileName}{dirty ? ' •' : ''}
            </span>
          )}
          {dirty && (
            <span className="text-[#e0a030]" title={locale === 'zh' ? '未保存的修改' : 'Unsaved changes'}>
              ●
            </span>
          )}
        </span>
      </header>

      <div className="min-h-0 flex-1 bg-[var(--color-canvas-bg)]">
        <DockLayout />
      </div>

      {/* Message Log 浮动面板（T-033，从底部滑出，不占 dock 位） */}
      {showLogs && (
        <div className="pointer-events-auto absolute bottom-6 left-2 right-2 z-40 h-48 rounded-[var(--radius-md)] border border-[var(--color-panel-border)] bg-[var(--color-panel)] shadow-2xl">
          <MessageLog />
        </div>
      )}

      {/* 模态覆盖层（T-032/T-034） */}
      {activeOverlay === 'preferences' && <Preferences />}
      {activeOverlay === 'worldSettings' && <WorldSettings />}
      {activeOverlay === 'shortcuts' && <Shortcuts />}

      {/* 6. 最底状态栏 */}
      <footer className="flex h-6 shrink-0 items-center gap-4 border-t border-[var(--color-panel-border)] bg-[var(--color-panel)] px-3 text-[11px] text-[var(--color-text-faint)] z-50">
        <span className="shrink-0">
          {locale === 'zh' ? '就绪' : 'Ready'}
        </span>
        <div className="h-3 w-px bg-[var(--color-panel-border)] shrink-0" />
        <span className="ml-auto shrink-0">
          {locale === 'zh' ? '米 (m) · 度 (deg)' : 'm · deg'}
        </span>
      </footer>
    </div>
  );
}
