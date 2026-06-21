// WDD -gemini 2026-06-19 新增 Viewport 内置的相机移动速度控制悬浮 UI，支持滑块调节、一键速度预设和微调
import { useState } from 'react';
import { usePlanner } from '@/state/store';
import { useTranslation } from '@/lib/i18n';

export function CameraSpeedControl() {
  const [collapsed, setCollapsed] = useState(false);
  const { t } = useTranslation();
  const cameraSpeed = usePlanner((s) => s.view.cameraSpeed);
  const setCameraSpeed = usePlanner((s) => s.setCameraSpeed);

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        className="viewport-speed-control absolute bottom-2 left-2 z-20 h-6 rounded-[var(--radius-sm)] border border-[var(--color-panel-border)] bg-[rgba(30,30,30,0.78)] px-2 font-mono text-[10px] text-[var(--color-accent)] backdrop-blur hover:text-[var(--color-text)]"
        title={t('cameraSpeed')}
      >
        {cameraSpeed.toFixed(1)}m/s
      </button>
    );
  }

  return (
    <div className="viewport-speed-control absolute bottom-2 left-2 z-20 flex h-6 max-w-[calc(100%-1rem)] items-center gap-1.5 rounded-[var(--radius-sm)] bg-[rgba(30,30,30,0.78)] border border-[var(--color-panel-border)] px-1.5 text-[10px] text-[var(--color-text)] backdrop-blur-sm select-none">
      {/* #WDD-gpt  2026-06-20 - 相机速度控件改为紧凑悬浮条，并支持收起成速度胶囊 */}
      <button
        type="button"
        onClick={() => setCollapsed(true)}
        className="h-4 w-4 rounded-[var(--radius-sm)] border border-[var(--color-panel-border)] bg-[var(--color-recessed)] text-[10px] leading-3 text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
        title={t('cameraSpeed')}
      >
        -
      </button>
      {/* 摄像机图标 */}
      <svg className="w-3 h-3 fill-[var(--color-text-dim)] shrink-0" viewBox="0 0 16 16">
        <path d="M10.5 4h-5L4.5 5.5h-2A1.5 1.5 0 0 0 1 7v5a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5V7a1.5 1.5 0 0 0-1.5-1.5h-2z" />
        <circle cx="8" cy="9.5" r="2.5" />
      </svg>

      {/* 标题与数值 */}
      <span className="font-medium whitespace-nowrap text-[var(--color-text-dim)]">
        {t('cameraSpeed')}:
      </span>
      <span className="font-mono font-bold text-[var(--color-accent)] w-11 text-right shrink-0">
        {cameraSpeed.toFixed(1)} <span className="text-[9px] text-[var(--color-text-faint)] font-normal">m/s</span>
      </span>

      {/* 紧凑滑块 */}
      <input
        type="range"
        min="0.1"
        max="15.0"
        step="0.1"
        value={cameraSpeed}
        onChange={(e) => setCameraSpeed(parseFloat(e.target.value))}
        className="w-14 h-1 bg-[var(--color-recessed)] rounded-lg appearance-none cursor-pointer accent-[var(--color-accent)] focus:outline-none"
        style={{
          outline: 'none',
        }}
      />

      {/* 快速调节预设按钮 */}
      <div className="h-3 w-px bg-[var(--color-panel-border)] mx-0.5 shrink-0" />
      
      {/* 慢速 (0.5 m/s) */}
      <button
        type="button"
        onClick={() => setCameraSpeed(0.5)}
        className={`px-1 rounded-sm text-[9px] font-mono border-none cursor-pointer transition-colors ${
          Math.abs(cameraSpeed - 0.5) < 0.05
            ? 'bg-[var(--color-accent)] text-white font-bold'
            : 'bg-[var(--color-panel-raised)] text-[var(--color-text-dim)] hover:text-white'
        }`}
        title="Slow Speed (0.5 m/s)"
      >
        0.5
      </button>

      {/* 标准 (3.0 m/s) */}
      <button
        type="button"
        onClick={() => setCameraSpeed(3.0)}
        className={`px-1 rounded-sm text-[9px] font-mono border-none cursor-pointer transition-colors ${
          Math.abs(cameraSpeed - 3.0) < 0.05
            ? 'bg-[var(--color-accent)] text-white font-bold'
            : 'bg-[var(--color-panel-raised)] text-[var(--color-text-dim)] hover:text-white'
        }`}
        title="Default Speed (3.0 m/s)"
      >
        3.0
      </button>

      {/* 快速 (8.0 m/s) */}
      <button
        type="button"
        onClick={() => setCameraSpeed(8.0)}
        className={`px-1 rounded-sm text-[9px] font-mono border-none cursor-pointer transition-colors ${
          Math.abs(cameraSpeed - 8.0) < 0.05
            ? 'bg-[var(--color-accent)] text-white font-bold'
            : 'bg-[var(--color-panel-raised)] text-[var(--color-text-dim)] hover:text-white'
        }`}
        title="Fast Speed (8.0 m/s)"
      >
        8.0
      </button>
    </div>
  );
}
