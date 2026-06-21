import { useEffect, useRef, useState } from 'react';
import { usePlanner } from '@/state/store';
import { useTranslation } from '@/lib/i18n';
import { getShortcutRows } from '@/panels/shortcutRows';

export function FpsCounter() {
  const [fps, setFps] = useState(0);
  const frames = useRef(0);
  const last = useRef(0);
  const raf = useRef<number | null>(null);
  const show = usePlanner((s) => s.view.showViewportHud);
  const toggleViewportHud = usePlanner((s) => s.toggleViewportHud);
  const scene = usePlanner((s) => s.scene);
  const quality = usePlanner((s) => s.renderSettings.quality);
  const ssao = usePlanner((s) => s.renderSettings.ssao);
  const projection = usePlanner((s) => s.view.projection);
  const selection = usePlanner((s) => s.selection);
  const editingGroupId = usePlanner((s) => s.editingGroupId);
  const { locale, t } = useTranslation();

  useEffect(() => {
    last.current = performance.now();
    const tick = (now: number) => {
      frames.current += 1;
      const elapsed = now - last.current;
      if (elapsed >= 500) {
        // #WDD-gpt  2026-06-20 - 增加视口 FPS 采样显示，便于观察渲染质量切换性能
        setFps(Math.round((frames.current * 1000) / elapsed));
        frames.current = 0;
        last.current = now;
      }
      raf.current = window.requestAnimationFrame(tick);
    };

    raf.current = window.requestAnimationFrame(tick);
    return () => {
      if (raf.current !== null) window.cancelAnimationFrame(raf.current);
    };
  }, []);

  const tone =
    fps >= 50
      ? 'text-[#8fd17f]'
      : fps >= 30
        ? 'text-[#d7b15f]'
        : 'text-[#e05f5f]';

  if (!show) {
    return (
      <button
        type="button"
        onClick={toggleViewportHud}
        className="viewport-hud pointer-events-auto absolute right-2 top-2 z-20 h-5 rounded-[var(--radius-sm)] border border-[var(--color-panel-border)] bg-[rgba(30,30,30,0.78)] px-1.5 font-mono text-[9px] text-[var(--color-text-dim)] backdrop-blur hover:text-[var(--color-text)]"
        title={t('hideViewportHud')}
      >
        {/* #WDD-gpt  2026-06-21 - HUD 收起态保留实时 FPS，方便不展开也能看性能 */}
        <span className={tone}>{fps}</span>
        <span className="ml-0.5">FPS</span>
      </button>
    );
  }

  const enabledCameras = scene.cameras.filter((c) => c.enabled).length;
  const enabledLights = scene.lights.filter((l) => l.enabled).length;
  const enabledSubjects = scene.subjects.filter((s) => s.enabled).length;
  const shortcutRows = getShortcutRows({ locale, scene, selection, editingGroupId, compact: true });
  const shortcutTitle =
    selection.length === 0
      ? locale === 'zh'
        ? '快捷'
        : 'Keys'
      : locale === 'zh'
        ? selection.length > 1
          ? `选 ${selection.length}`
          : '选中'
        : selection.length > 1
          ? `${selection.length} Sel`
          : 'Sel';

  return (
    <div className="viewport-hud pointer-events-auto absolute right-2 top-2 z-20 w-[132px] max-w-[calc(100%-16px)] rounded-[var(--radius-sm)] border border-[var(--color-panel-border)] bg-[rgba(30,30,30,0.76)] font-mono text-[8px] leading-tight backdrop-blur">
      <div className="flex h-5 items-center justify-between gap-1 border-b border-[var(--color-panel-border)] bg-[rgba(48,48,48,0.72)] px-1.5">
        {/* #WDD-gpt  2026-06-21 - 压缩合并 HUD：窄宽度、小字号，减少视口遮挡 */}
        <span className="min-w-0 truncate font-semibold uppercase tracking-[0.02em] text-[var(--color-text-dim)]">
          <span className={tone}>{fps}</span>
          <span className="ml-0.5">FPS</span>
          <span className="mx-1 text-[var(--color-text-faint)]">|</span>
          <span>{shortcutTitle}</span>
        </span>
        <button
          type="button"
          onClick={toggleViewportHud}
          className="h-3.5 w-3.5 rounded-[var(--radius-sm)] border border-[var(--color-panel-border)] bg-[var(--color-recessed)] text-[8px] leading-[10px] text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
          title={t('hideViewportHud')}
        >
          ×
        </button>
      </div>
      <div className="border-b border-[var(--color-panel-border)] px-1.5 py-1 text-[8px]">
        <div className="truncate text-[var(--color-text-dim)]">
          C <span className="text-[var(--color-text)]">{enabledCameras}/{scene.cameras.length}</span>
          <span className="mx-1 text-[var(--color-text-faint)]">L</span><span className="text-[var(--color-text)]">{enabledLights}/{scene.lights.length}</span>
          <span className="mx-1 text-[var(--color-text-faint)]">S</span><span className="text-[var(--color-text)]">{enabledSubjects}/{scene.subjects.length}</span>
        </div>
        <div className="truncate text-[var(--color-text-dim)]">
          <span className="text-[var(--color-text)]">{quality}{ssao ? '+AO' : ''}</span>
          <span className="mx-1 text-[var(--color-text-faint)]">|</span>
          <span className="text-[var(--color-text)]">{t(projection === 'perspective' ? 'perspective' : projection === 'top' ? 'topView' : projection === 'front' ? 'frontView' : 'sideView')}</span>
        </div>
      </div>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-1 gap-y-0.5 px-1.5 py-1 text-[8px]">
        {shortcutRows.map((row) => (
          <div key={`${row.key}-${row.desc}`} className="contents">
            <kbd className="min-w-0 whitespace-nowrap rounded-[2px] border border-[var(--color-panel-border)] bg-[var(--color-recessed)] px-1 py-0.5 font-mono text-[7px] leading-none text-[var(--color-text)]">
              {row.key}
            </kbd>
            <span className="min-w-0 truncate text-[var(--color-text-dim)]">{row.desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
