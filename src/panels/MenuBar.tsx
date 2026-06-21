/**
 * 顶部下拉菜单栏（src/panels/MenuBar.tsx）。
 * 参考 UE5.8：File/Edit/View/Window/Help 下拉。非阻塞反馈走 store.log（T-033，取代 alert/confirm）。
 *
 * File: New / Open / Save / Save As / Export transforms.json / Export COLMAP / Export Capture List (CSV)
 * Edit: Undo / Redo
 * View: 投影 / 视锥 / 热图
 * Window: Content / Outliner / Details / Stats / Message Log / Reset Layout
 * Help: 语言 / 偏好 / 世界设置
 */
import { useState, useRef, useEffect, useSyncExternalStore } from 'react';
import { usePlanner } from '@/state/store';
import { useTranslation } from '@/lib/i18n';
import { exportToTransformsJson } from '@/export/transforms';
import { exportToColmap } from '@/export/colmap';
import { captureListToCsv, buildCaptureList } from '@/sim/capture';
import { resetDockLayout } from '@/app/dockLayoutPersistence';
import {
  isDockPanelVisible,
  subscribeDockLayout,
} from '@/app/dockLayoutController';
import {
  saveSceneToFile,
  loadSceneFromText,
  pickAndReadTextFile,
  downloadTextFile,
  clearAutosave as clearAutosaveFile,
} from '@/io/sceneFiles';
import { toggleDockPanel } from '@/app/dockLayoutController';

type MenuOption =
  | {
      label: string;
      onClick: () => void;
      checked?: boolean;
      disabled?: boolean;
      divider?: false;
    }
  | {
      divider: true;
      label?: never;
      onClick?: never;
      checked?: never;
      disabled?: never;
    };

interface MenuDefinition {
  id: string;
  label: string;
  options: MenuOption[];
}

export function MenuBar() {
  const { t, locale } = useTranslation();
  const setLocale = usePlanner((s) => s.setLocale);
  const undo = usePlanner((s) => s.undo);
  const redo = usePlanner((s) => s.redo);
  const canUndo = usePlanner((s) => s.canUndo());
  const canRedo = usePlanner((s) => s.canRedo());
  const resetScene = usePlanner((s) => s.resetScene);
  const loadExampleScene = usePlanner((s) => s.loadExampleScene);
  const loadScene = usePlanner((s) => s.loadScene);
  const scene = usePlanner((s) => s.scene);
  const log = usePlanner((s) => s.log);
  const toggleLogs = usePlanner((s) => s.toggleLogs);
  const setActiveOverlay = usePlanner((s) => s.setActiveOverlay);

  const projection = usePlanner((s) => s.view.projection);
  const setProjection = usePlanner((s) => s.setProjection);
  const showFrustums = usePlanner((s) => s.view.showFrustums);
  const toggleFrustums = usePlanner((s) => s.toggleFrustums);
  const showCoverageHeatmap = usePlanner((s) => s.view.showCoverageHeatmap);
  const toggleCoverageHeatmap = usePlanner((s) => s.toggleCoverageHeatmap);

  const currentFileName = usePlanner((s) => s.currentFileName);
  const setCurrentFileName = usePlanner((s) => s.setCurrentFileName);
  const markClean = usePlanner((s) => s.markClean);

  // T-031：Window 菜单显示各 dock panel 可见性状态
  const contentVisible = useSyncExternalStore(subscribeDockLayout, () => isDockPanelVisible('content'), () => true);
  const outlinerVisible = useSyncExternalStore(subscribeDockLayout, () => isDockPanelVisible('outliner'), () => true);
  const detailsVisible = useSyncExternalStore(subscribeDockLayout, () => isDockPanelVisible('details'), () => true);
  const statsVisible = useSyncExternalStore(subscribeDockLayout, () => isDockPanelVisible('stats'), () => true);
  const renderVisible = useSyncExternalStore(subscribeDockLayout, () => isDockPanelVisible('render'), () => false);
  const libraryVisible = useSyncExternalStore(subscribeDockLayout, () => isDockPanelVisible('library'), () => false);
  const showLogs = usePlanner((s) => s.showLogs);

  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // —— 导出 ——
  const handleExportTransforms = () => {
    try {
      downloadTextFile(exportToTransformsJson(scene), 'transforms.json');
      log('info', `${t('exportedSuccessfully')}: transforms.json`);
    } catch (err) {
      log('error', `${t('exportFailed')}: transforms.json — ${err}`);
    }
    setActiveMenu(null);
  };

  const handleExportColmap = () => {
    try {
      const files = exportToColmap(scene);
      // COLMAP 三件套打包为单文件文本（带分隔注释），便于用户使用
      const bundle =
            `# COLMAP export bundle — 3 files concatenated\n` +
            `# === cameras.txt ===\n${files.camerasTxt}\n` +
            `# === images.txt ===\n${files.imagesTxt}\n` +
            `# === points3D.txt ===\n${files.points3DTxt}`;
      downloadTextFile(bundle, 'colmap_export.txt', 'text/plain');
      log('info', `${t('exportedSuccessfully')}: colmap_export.txt (cameras/images/points3D)`);
    } catch (err) {
      log('error', `${t('exportFailed')}: COLMAP — ${err}`);
    }
    setActiveMenu(null);
  };

  const handleExportCaptureList = () => {
    try {
      const csv = captureListToCsv(buildCaptureList(scene));
      downloadTextFile(csv, 'capture_list.csv', 'text/csv');
      log('info', `${t('exportedSuccessfully')}: capture_list.csv`);
    } catch (err) {
      log('error', `${t('exportFailed')}: capture list — ${err}`);
    }
    setActiveMenu(null);
  };

  // —— 保存/加载 ——
  const confirmDiscardIfDirty = (): boolean => {
    if (!usePlanner.getState().dirty) return true;
    // 用 log 而非阻塞 confirm；危险操作（清空/新建/打开）仍需确认，这里保留 confirm 仅作破坏性守门
    return window.confirm(t('confirmDiscardDirty'));
  };

  const handleSave = () => {
    const name = currentFileName ?? 'scene.planner.json';
    const r = saveSceneToFile(scene, name);
    if (r.ok) {
      setCurrentFileName(name);
      markClean();
      clearAutosaveFile();
      log('info', `${t('savedSuccessfully')}: ${name}`);
    } else {
      log('error', `${t('saveFailed')}: ${r.error}`);
    }
    setActiveMenu(null);
  };

  const handleSaveAs = () => {
    const name = window.prompt(locale === 'zh' ? '文件名：' : 'Filename:', 'scene.planner.json');
    if (!name) {
      setActiveMenu(null);
      return;
    }
    const r = saveSceneToFile(scene, name);
    if (r.ok) {
      setCurrentFileName(name);
      markClean();
      clearAutosaveFile();
      log('info', `${t('savedSuccessfully')}: ${name}`);
    } else {
      log('error', `${t('saveFailed')}: ${r.error}`);
    }
    setActiveMenu(null);
  };

  const handleOpen = async () => {
    if (!confirmDiscardIfDirty()) {
      setActiveMenu(null);
      return;
    }
    try {
      const { name, content } = await pickAndReadTextFile();
      const r = loadSceneFromText(content);
      if (r.scene) {
        loadScene(r.scene);
        setCurrentFileName(name);
        markClean();
        clearAutosaveFile();
        log('info', `${t('loadedSuccessfully')}: ${name}`);
      } else {
        log('error', `${t('loadFailed')}: ${r.error}`);
      }
    } catch (e) {
      if (e instanceof Error && e.message !== 'cancelled') {
        log('error', `${t('loadFailed')}: ${e.message}`);
      }
    }
    setActiveMenu(null);
  };

  const handleNew = () => {
    if (!confirmDiscardIfDirty()) {
      setActiveMenu(null);
      return;
    }
    resetScene();
    log('info', t('sceneCleared'));
    setActiveMenu(null);
  };

  const handleLoadExample = () => {
    if (!confirmDiscardIfDirty()) {
      setActiveMenu(null);
      return;
    }
    loadExampleScene();
    log('info', locale === 'zh' ? '已加载示例场景（环形相机阵列）' : 'Loaded example scene (ring array)');
    setActiveMenu(null);
  };

  const handleClear = () => {
    if (!window.confirm(t('confirmClear'))) {
      setActiveMenu(null);
      return;
    }
    resetScene();
    log('info', t('sceneCleared'));
    setActiveMenu(null);
  };

  const menuItems: MenuDefinition[] = [
    {
      id: 'file',
      label: t('file'),
      options: [
        { label: t('newScene'), onClick: handleNew },
        { label: t('loadExampleScene'), onClick: handleLoadExample },
        { label: t('openScene') + '...', onClick: handleOpen },
        { label: t('saveScene'), onClick: handleSave },
        { label: t('saveSceneAs') + '...', onClick: handleSaveAs },
        { divider: true },
        { label: t('exportTransforms'), onClick: handleExportTransforms },
        { label: t('exportColmap'), onClick: handleExportColmap },
        { label: t('exportCaptureList'), onClick: handleExportCaptureList },
        { divider: true },
        { label: t('clearScene'), onClick: handleClear },
      ],
    },
    {
      id: 'edit',
      label: t('edit'),
      options: [
        { label: `${t('undo')} (Ctrl+Z)`, disabled: !canUndo, onClick: () => { undo(); setActiveMenu(null); } },
        { label: `${t('redo')} (Ctrl+Y)`, disabled: !canRedo, onClick: () => { redo(); setActiveMenu(null); } },
      ],
    },
    {
      id: 'view',
      label: t('view'),
      options: [
        { label: t('perspective'), checked: projection === 'perspective', onClick: () => { setProjection('perspective'); setActiveMenu(null); } },
        { label: t('topView'), checked: projection === 'top', onClick: () => { setProjection('top'); setActiveMenu(null); } },
        { label: t('frontView'), checked: projection === 'front', onClick: () => { setProjection('front'); setActiveMenu(null); } },
        { label: t('sideView'), checked: projection === 'side', onClick: () => { setProjection('side'); setActiveMenu(null); } },
        { divider: true },
        { label: t('toggleFrustum'), checked: showFrustums, onClick: () => { toggleFrustums(); setActiveMenu(null); } },
        { label: t('toggleHeatmap') + ' (Space)', checked: showCoverageHeatmap, onClick: () => { toggleCoverageHeatmap(); setActiveMenu(null); } },
      ],
    },
    {
      id: 'window',
      label: t('window'),
      options: [
        { label: t('content'), checked: contentVisible, onClick: () => { toggleDockPanel('content'); setActiveMenu(null); } },
        { label: t('outliner'), checked: outlinerVisible, onClick: () => { toggleDockPanel('outliner'); setActiveMenu(null); } },
        { label: t('details'), checked: detailsVisible, onClick: () => { toggleDockPanel('details'); setActiveMenu(null); } },
        { label: t('render'), checked: renderVisible, onClick: () => { toggleDockPanel('render'); setActiveMenu(null); } },
        { label: t('library'), checked: libraryVisible, onClick: () => { toggleDockPanel('library'); setActiveMenu(null); } },
        { label: t('stats'), checked: statsVisible, onClick: () => { toggleDockPanel('stats'); setActiveMenu(null); } },
        { divider: true },
        { label: t('messageLog'), checked: showLogs, onClick: () => { toggleLogs(); setActiveMenu(null); } },
        { divider: true },
        { label: t('resetDockLayout'), onClick: () => { resetDockLayout(); setActiveMenu(null); } },
      ],
    },
    {
      id: 'help',
      label: t('help'),
      options: [
        { label: t('preferences'), onClick: () => { setActiveOverlay('preferences'); setActiveMenu(null); } },
        { label: t('worldSettings'), onClick: () => { setActiveOverlay('worldSettings'); setActiveMenu(null); } },
        { divider: true },
        { label: t('chinese'), checked: locale === 'zh', onClick: () => { setLocale('zh'); setActiveMenu(null); } },
        { label: t('english'), checked: locale === 'en', onClick: () => { setLocale('en'); setActiveMenu(null); } },
      ],
    },
  ];

  return (
    <div className="flex items-center gap-1" ref={menuRef}>
      {menuItems.map((menu) => {
        const isOpen = activeMenu === menu.id;
        return (
          <div key={menu.id} className="relative">
            <button
              onClick={() => setActiveMenu(isOpen ? null : menu.id)}
              onMouseEnter={() => activeMenu && setActiveMenu(menu.id)}
              className={`h-7 px-2.5 rounded text-[12px] font-medium transition-colors outline-none select-none ${
                isOpen
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'text-[var(--color-text-dim)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--color-text)]'
              }`}
            >
              {menu.label}
            </button>

            {isOpen && (
              <div className="absolute left-0 top-8 z-50 min-w-[200px] py-1 rounded border border-[var(--color-panel-border)] bg-[rgba(24,24,24,0.92)] shadow-2xl backdrop-blur-md">
                {menu.options.map((opt, i) => {
                  if (opt.divider) {
                    return <div key={`div-${i}`} className="my-1 h-px bg-[var(--color-panel-border)]" />;
                  }
                  return (
                    <button
                      key={`opt-${i}`}
                      disabled={opt.disabled}
                      onClick={opt.onClick}
                      className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-[12px] transition-colors select-none ${
                        opt.disabled
                          ? 'opacity-30 cursor-not-allowed text-[var(--color-text-faint)]'
                          : 'text-[var(--color-text-dim)] hover:bg-[var(--color-accent)] hover:text-white'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {opt.checked && (
                        <span className="text-[var(--color-accent-cyan)] font-bold text-[10px] ml-2">✓</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
