import { useEffect, useRef, useState } from 'react';
import { usePlanner } from '@/state/store';
import { useTranslation } from '@/lib/i18n';

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
  const { t } = useTranslation();

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
        className="viewport-hud pointer-events-auto absolute right-2 top-2 z-20 h-6 rounded-[var(--radius-sm)] border border-[var(--color-panel-border)] bg-[rgba(30,30,30,0.78)] px-2 font-mono text-[10px] text-[var(--color-text-dim)] backdrop-blur hover:text-[var(--color-text)]"
        title={t('hideViewportHud')}
      >
        HUD
      </button>
    );
  }

  const enabledCameras = scene.cameras.filter((c) => c.enabled).length;
  const enabledLights = scene.lights.filter((l) => l.enabled).length;
  const enabledSubjects = scene.subjects.filter((s) => s.enabled).length;

  return (
    <div className="viewport-hud pointer-events-auto absolute right-2 top-2 z-20 min-w-[118px] rounded-[var(--radius-sm)] border border-[var(--color-panel-border)] bg-[rgba(30,30,30,0.72)] px-1.5 py-0.5 font-mono text-[10px] backdrop-blur">
      <div className="mb-0.5 flex items-center justify-between gap-1.5">
        {/* #WDD-gpt  2026-06-20 - 视口 HUD 缩小并保留收起后的恢复按钮，降低右上角遮挡 */}
        <span>
          <span className={tone}>{fps}</span>
          <span className="ml-1 text-[var(--color-text-dim)]">FPS</span>
        </span>
        <button
          type="button"
          onClick={toggleViewportHud}
          className="h-4 w-4 rounded-[var(--radius-sm)] border border-[var(--color-panel-border)] bg-[var(--color-recessed)] text-[10px] leading-3 text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
          title={t('hideViewportHud')}
        >
          ×
        </button>
      </div>
      <div className="grid grid-cols-[auto_auto] gap-x-1.5 gap-y-0 text-[9px]">
        <span className="text-[var(--color-text-dim)]">{t('camerasShort')}</span>
        <span className="text-right text-[var(--color-text)]">{enabledCameras}/{scene.cameras.length}</span>
        <span className="text-[var(--color-text-dim)]">{t('lightsShort')}</span>
        <span className="text-right text-[var(--color-text)]">{enabledLights}/{scene.lights.length}</span>
        <span className="text-[var(--color-text-dim)]">{t('subjectsShort')}</span>
        <span className="text-right text-[var(--color-text)]">{enabledSubjects}/{scene.subjects.length}</span>
        <span className="text-[var(--color-text-dim)]">{t('renderShort')}</span>
        <span className="text-right text-[var(--color-text)]">{quality}{ssao ? '+AO' : ''}</span>
        <span className="text-[var(--color-text-dim)]">{t('viewShort')}</span>
        <span className="text-right text-[var(--color-text)]">{t(projection === 'perspective' ? 'perspective' : projection === 'top' ? 'topView' : projection === 'front' ? 'frontView' : 'sideView')}</span>
      </div>
    </div>
  );
}
