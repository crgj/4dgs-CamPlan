/**
 * T-085/T-086 后处理与色调映射栈（src/scene/post/PostFXStack.tsx）。
 * Bloom + SSAO（可选）+ 色调映射（ACES/AgX/Filmic）。
 * 由 store.renderSettings 控制；draft 质量下禁用以保性能。
 * path tracing 真正接管画布前仍保留标准后处理，避免占位开关导致渲染链路断开。
 */
import { EffectComposer, Bloom, N8AO, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { useEffect, useState } from 'react';
import { usePlanner } from '@/state/store';

const modeMap: Record<string, ToneMappingMode> = {
  aces: ToneMappingMode.ACES_FILMIC,
  agx: ToneMappingMode.AGX,
  filmic: ToneMappingMode.REINHARD2,
  linear: ToneMappingMode.LINEAR,
};

export function PostFXStack() {
  const { bloom, bloomIntensity, ssao, toneMapping, quality } = usePlanner(
    (s) => s.renderSettings,
  );
  const sceneVersion = usePlanner((s) => [
    s.scene.cameras.length,
    s.scene.lights.length,
    s.scene.subjects.length,
    s.scene.groups?.length ?? 0,
  ].join(':'));
  const [readyFrame, setReadyFrame] = useState(0);

  useEffect(() => {
    // #WDD-gpt  2026-06-20 - 刷新页面/新增物体后等待场景深度稳定再挂载 AO，避免必须切换质量才显示 SSAO
    let second: number | null = null;
    const first = window.requestAnimationFrame(() => {
      second = window.requestAnimationFrame(() => setReadyFrame((v) => v + 1));
    });
    return () => {
      window.cancelAnimationFrame(first);
      if (second !== null) window.cancelAnimationFrame(second);
    };
  }, [bloom, quality, sceneVersion, ssao, toneMapping]);

  // draft 质量下不走后处理
  // #WDD-gpt  2026-06-21 - PathTracerPreview 目前不输出 PT 帧，不能因 pathTracing 开关卸载标准后处理
  if (quality === 'draft') return null;
  if (readyFrame === 0) return null;

  return (
    <EffectComposer
      key={`${quality}:${ssao}:${toneMapping}:${bloom}:${sceneVersion}:${readyFrame}`}
      multisampling={quality === 'ultra' ? 4 : 0}
      autoClear
    >
      {ssao ? (
        <N8AO
          aoRadius={2.5}
          distanceFalloff={1.2}
          intensity={2.2}
          quality={quality === 'ultra' ? 'high' : 'medium'}
          aoSamples={16}
          denoiseSamples={8}
          denoiseRadius={8}
          halfRes={false}
        />
      ) : <></>}
      {bloom ? (
        <Bloom
          intensity={bloomIntensity}
          luminanceThreshold={0.7}
          luminanceSmoothing={0.9}
          mipmapBlur
        />
      ) : <></>}
      <ToneMapping mode={modeMap[toneMapping] ?? ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}
