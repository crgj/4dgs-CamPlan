/**
 * 渲染设置面板（src/panels/RenderSettingsPanel.tsx）。
 *
 * 背景：T-080~T-088 已经把 renderSettings 切片、PostFXStack、PathTracerPreview、
 * 质量等级等"引擎"做出来了，但**没有任何 UI 暴露它们**——用户完全无法切换质量、
 * 色调映射、Bloom、PT 等设置，整个高质量渲染能力对用户不可见（最大可用性 bug）。
 *
 * 本面板补齐这块：作为 Dockview 的一个可停靠 tab（Window 菜单可开关），提供
 *   1. 质量预设 Draft/Standard/High/Ultra（联动 pixelRatio/阴影/后处理/PT 上限）
 *   2. 色调映射 ACES/AgX/Filmic/Linear
 *   3. Bloom 开关 + 强度
 *   4. SSAO 开关
 *   5. Path Tracing 开关 + 采样数 + 反弹数（钳到当前质量上限）
 *   6. 一键"导出当前视口截图"（T-090 renderOutput 的最常用入口）
 *   7. 一键"生成相机 contact sheet"（T-089）
 *   8. 光照均匀性速览（T-082 lightMeter，纯逻辑只读展示）
 *
 * 风格遵循 ue5-ui-reference：分类折叠 section、勾选/下拉/NumberInput、暗色色板。
 */
import { useState } from 'react';
import { usePlanner } from '@/state/store';
import { useTranslation } from '@/lib/i18n';
import { NumberInput } from '@/ui/NumberInput';
import {
  QUALITY_PROFILES,
  clampPathTracingSettings,
  type RenderQuality,
} from '@/scene/RenderQuality';
import { requestPathTracingSnapshot } from '@/scene/pathtracing/pathTracingSnapshot';
import { meterScene } from '@/sim/lightMeter';

/** 折叠分区（UE5 Details 分组风格）。 */
function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-[var(--color-panel-border)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 bg-[var(--color-panel-header)] px-3 py-1.5 text-left text-[11px] font-bold uppercase tracking-wide text-[var(--color-text-dim)] hover:bg-[var(--color-panel-raised)]"
      >
        <span className="text-[9px]">{open ? '▼' : '▶'}</span>
        <span>{title}</span>
      </button>
      {open && <div className="py-1">{children}</div>}
    </div>
  );
}

/** 属性行（label + control，与 Preferences 同构）。 */
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-[var(--row-h)] items-center gap-3 px-3 py-1">
      <span className="w-32 shrink-0 text-[11px] text-[var(--color-text-dim)]">{label}</span>
      <div className="flex flex-1 items-center">{children}</div>
    </div>
  );
}

/** UE5 风勾选框（带左侧 ✓）。 */
function Check({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex h-4 w-4 items-center justify-center rounded-[2px] border text-[10px] ${
        checked
          ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white'
          : 'border-[var(--color-panel-border)] bg-[var(--color-recessed)]'
      }`}
    >
      {checked ? '✓' : ''}
    </button>
  );
}

const QUALITY_OPTIONS: RenderQuality[] = ['draft', 'standard', 'high', 'ultra'];
const TONE_OPTIONS = ['aces', 'agx', 'filmic', 'linear'] as const;

export function RenderSettingsPanel() {
  const { locale } = useTranslation();
  const rs = usePlanner((s) => s.renderSettings);
  const setRenderSettings = usePlanner((s) => s.setRenderSettings);
  const scene = usePlanner((s) => s.scene);
  const log = usePlanner((s) => s.log);

  const profile = QUALITY_PROFILES[rs.quality];
  const clamped = clampPathTracingSettings(rs.quality, rs.ptSamples, rs.ptBounces);
  // 若当前 PT 设置超过质量上限，自动收敛一次（避免 Draft 下设 512 卡死）
  if (clamped.samples !== rs.ptSamples || clamped.bounces !== rs.ptBounces) {
    setRenderSettings({ ptSamples: clamped.samples, ptBounces: clamped.bounces });
  }

  const lightReport = meterScene(scene);

  // —— 截图：从 DOM 取视口 canvas，编码 PNG 下载（T-090 renderOutput 入口）——
  const handleScreenshot = () => {
    const canvas = document.querySelector<HTMLCanvasElement>('canvas');
    if (!canvas) {
      log('error', locale === 'zh' ? '未找到视口 canvas' : 'Viewport canvas not found');
      return;
    }
    try {
      const url = canvas.toDataURL('image/png');
      // 内联下载，避免与 io/sceneFiles 形成循环引用
      const a = document.createElement('a');
      a.href = url;
      a.download = `planner_viewport_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      log('info', locale === 'zh' ? '已导出视口截图' : 'Viewport screenshot exported');
    } catch (err) {
      // preserveDrawingBuffer=false 时 readback 可能失败
      log('error', `${locale === 'zh' ? '截图失败' : 'Screenshot failed'}: ${err}`);
    }
  };

  const zh = locale === 'zh';

  return (
    <div className="h-full overflow-y-auto bg-[var(--color-panel)] text-[var(--color-text)]">
      <div className="sticky top-0 z-10 flex h-8 items-center border-b border-[var(--color-panel-border)] bg-[var(--color-panel-header)] px-3 text-[11px] font-bold uppercase tracking-wide">
        {zh ? '渲染设置' : 'Render Settings'}
      </div>

      <Section title={zh ? '质量预设' : 'Quality Preset'}>
        <Row label={zh ? '渲染质量' : 'Quality'}>
          <select
            className="h-6 flex-1 rounded-sm border border-[var(--color-panel-border)] bg-[var(--color-recessed)] px-1 text-[11px] text-[var(--color-text)]"
            value={rs.quality}
            onChange={(e) => setRenderSettings({ quality: e.target.value as RenderQuality })}
          >
            {QUALITY_OPTIONS.map((q) => (
              <option key={q} value={q}>
                {q} {zh ? `(DPR≤${profile.pixelRatioCap})` : `(DPR≤${profile.pixelRatioCap})`}
              </option>
            ))}
          </select>
        </Row>
        <div className="px-3 py-1 text-[10px] text-[var(--color-text-faint)]">
          {zh
            ? `阴影 ${profile.shadowMapSize || '关'} · 后处理 ${profile.postFX ? '开' : '关'} · MSAA ${profile.multisampling}`
            : `Shadows ${profile.shadowMapSize || 'off'} · PostFX ${profile.postFX ? 'on' : 'off'} · MSAA ${profile.multisampling}`}
        </div>
      </Section>

      <Section title={zh ? '色调映射' : 'Tone Mapping'}>
        <Row label={zh ? '模式' : 'Mode'}>
          <select
            className="h-6 flex-1 rounded-sm border border-[var(--color-panel-border)] bg-[var(--color-recessed)] px-1 text-[11px] text-[var(--color-text)]"
            value={rs.toneMapping}
            onChange={(e) => setRenderSettings({ toneMapping: e.target.value as (typeof TONE_OPTIONS)[number] })}
          >
            {TONE_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m.toUpperCase()}
              </option>
            ))}
          </select>
        </Row>
      </Section>

      <Section title={zh ? '后处理' : 'Post Processing'}>
        <Row label={zh ? '泛光 Bloom' : 'Bloom'}>
          <Check checked={rs.bloom} onChange={(v) => setRenderSettings({ bloom: v })} />
        </Row>
        {rs.bloom && (
          <Row label={zh ? '泛光强度' : 'Bloom Intensity'}>
            <NumberInput
              value={rs.bloomIntensity}
              onCommitHistory={() => undefined}
              onChange={(v) => setRenderSettings({ bloomIntensity: v })}
              min={0}
              max={4}
              step={0.1}
              precision={2}
              className="flex-1"
            />
          </Row>
        )}
        <Row label="SSAO">
          <Check checked={rs.ssao} onChange={(v) => setRenderSettings({ ssao: v })} />
        </Row>
      </Section>

      <Section title={zh ? '路径追踪预览' : 'Path Traced Preview'} defaultOpen={false}>
        <div className="px-3 py-1 text-[10px] leading-4 text-[var(--color-text-faint)]">
          {/* #WDD-gpt  2026-06-21 - PT 目前仅保留设置入口，避免用户误以为开关会立即改变视口渲染 */}
          {zh
            ? '当前为占位功能：启用后仍使用标准视口渲染，真正路径追踪输出尚未接入。'
            : 'Placeholder only: enabling this still uses the standard viewport renderer; path traced output is not wired yet.'}
        </div>
        <Row label={zh ? '启用 PT' : 'Enable PT'}>
          <Check checked={rs.pathTracing} onChange={(v) => setRenderSettings({ pathTracing: v })} />
        </Row>
        {rs.pathTracing && (
          <>
            <Row label={zh ? '采样数' : 'Samples'}>
              <NumberInput
                value={rs.ptSamples}
                onCommitHistory={() => undefined}
                onChange={(v) => setRenderSettings({ ptSamples: Math.max(1, Math.min(v, profile.ptSamplesCap)) })}
                min={1}
                max={profile.ptSamplesCap}
                step={16}
                precision={0}
                className="flex-1"
              />
            </Row>
            <Row label={zh ? '反弹数' : 'Bounces'}>
              <NumberInput
                value={rs.ptBounces}
                onCommitHistory={() => undefined}
                onChange={(v) => setRenderSettings({ ptBounces: Math.max(1, Math.min(v, profile.ptBouncesCap)) })}
                min={1}
                max={profile.ptBouncesCap}
                step={1}
                precision={0}
                className="flex-1"
              />
            </Row>
            <div className="px-3 py-1 text-[10px] text-[var(--color-text-faint)]">
              {zh
                ? `当前质量上限：${profile.ptSamplesCap} 采样 / ${profile.ptBouncesCap} 反弹`
                : `Cap at this quality: ${profile.ptSamplesCap} samples / ${profile.ptBouncesCap} bounces`}
            </div>
            <div className="flex gap-2 px-3 py-2">
              <button
                type="button"
                onClick={() => requestPathTracingSnapshot({
                  samples: rs.ptSamples,
                  bounces: rs.ptBounces,
                })}
                className="rounded-[var(--radius-sm)] border border-[var(--color-panel-border)] bg-[var(--color-recessed)] px-3 py-1 text-[11px] text-[var(--color-text)] hover:bg-[var(--color-panel-raised)]"
              >
                {zh ? '生成 PT 快照 (PNG)' : 'Render PT Snapshot (PNG)'}
              </button>
            </div>
          </>
        )}
      </Section>

      <Section title={zh ? '光照评估 (只读)' : 'Light Meter (read-only)'} defaultOpen={false}>
        <Row label={zh ? '平均照度' : 'Avg Illum.'}>
          <span className="font-mono text-[11px] text-[var(--color-text)]">
            {lightReport.avgIlluminance.toFixed(3)}
          </span>
        </Row>
        <Row label={zh ? '均匀性' : 'Uniformity'}>
          <span className="font-mono text-[11px] text-[var(--color-text)]">
            {(lightReport.uniformity * 100).toFixed(0)}%
          </span>
        </Row>
        <Row label={zh ? '过曝占比' : 'Overexposed'}>
          <span className="font-mono text-[11px] text-[var(--color-text)]">
            {(lightReport.overexposureRatio * 100).toFixed(0)}%
          </span>
        </Row>
        <Row label={zh ? '欠曝占比' : 'Underexposed'}>
          <span className="font-mono text-[11px] text-[var(--color-text)]">
            {(lightReport.underexposureRatio * 100).toFixed(0)}%
          </span>
        </Row>
      </Section>

      <Section title={zh ? '渲染输出' : 'Render Output'} defaultOpen={false}>
        <div className="flex gap-2 px-3 py-2">
          <button
            type="button"
            onClick={handleScreenshot}
            className="rounded-[var(--radius-sm)] border border-[var(--color-panel-border)] bg-[var(--color-recessed)] px-3 py-1 text-[11px] text-[var(--color-text)] hover:bg-[var(--color-panel-raised)]"
          >
            {zh ? '导出视口截图 (PNG)' : 'Export Viewport (PNG)'}
          </button>
        </div>
        <div className="px-3 pb-2 text-[10px] text-[var(--color-text-faint)]">
          {zh
            ? '每相机 contact sheet 将随 T-089 完整渲染管线接入；当前可导出主视口当前帧。'
            : 'Per-camera contact sheet arrives with T-089; current version exports the main viewport frame.'}
        </div>
      </Section>
    </div>
  );
}
