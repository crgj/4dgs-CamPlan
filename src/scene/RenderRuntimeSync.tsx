import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { usePlanner } from '@/state/store';

export function RenderRuntimeSync() {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const quality = usePlanner((s) => s.renderSettings.quality);
  const ssao = usePlanner((s) => s.renderSettings.ssao);
  const pathTracing = usePlanner((s) => s.renderSettings.pathTracing);
  const sceneVersion = usePlanner((s) => [
    s.scene.cameras.length,
    s.scene.lights.length,
    s.scene.subjects.length,
    s.scene.groups?.length ?? 0,
    s.scene.env.ground.enabled,
    s.scene.env.ground.y,
  ].join(':'));

  useEffect(() => {
    // #WDD-gpt  2026-06-20 - 渲染模式/场景变化后显式刷新阴影贴图与后处理首帧，避免切换多次才显示正确
    // eslint-disable-next-line react-hooks/immutability -- Three.js renderer runtime flag must be mutated to force shadow map refresh.
    gl.shadowMap.needsUpdate = true;
    invalidate();
    const id = window.requestAnimationFrame(() => {
      gl.shadowMap.needsUpdate = true;
      invalidate();
    });
    // #WDD-gpt  2026-06-20 - 新增实体后 SSAO/N8AO 偶发不刷新，短时定时强制重绘让深度/AO pass 收敛
    // #WDD-gpt  2026-06-21 - pathTracing 当前是占位开关，不应跳过标准渲染的 AO/阴影刷新同步
    const interval = ssao && quality !== 'draft'
      ? window.setInterval(() => {
          gl.shadowMap.needsUpdate = true;
          invalidate();
        }, 250)
      : null;
    const stopInterval = interval !== null
      ? window.setTimeout(() => window.clearInterval(interval), 2_000)
      : null;
    return () => {
      window.cancelAnimationFrame(id);
      if (interval !== null) window.clearInterval(interval);
      if (stopInterval !== null) window.clearTimeout(stopInterval);
    };
  }, [gl, invalidate, pathTracing, quality, sceneVersion, ssao]);

  return null;
}
