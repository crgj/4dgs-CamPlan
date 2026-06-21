/**
 * #WDD -gemini 2026-06-19 新建 CoverageHeatmap.tsx
 * 基于 R3F Points 的表面覆盖热图渲染组件：
 * - 从 sim/coverage 读取栅格化采样点，颜色根据覆盖相机数 count 动态映射到 5 级色阶
 * - 0 覆盖（盲区）显示为微弱的暗灰色，防止遮挡背景同时把盲区一目了然标示出来
 * - 材质设置 depthWrite=false 以防止点云在三维空间中频繁互相深度闪烁
 * - Space 键由全局 useKeyboard 自动切换其 view.showCoverageHeatmap 显隐状态
 */
import { useMemo } from 'react';
import { usePlanner } from '@/state/store';
import { coverageOf } from '@/sim/coverage';
import { defaultThresholds } from '@/lib/defaults';

export function CoverageHeatmap() {
  const scene = usePlanner((s) => s.scene);
  const show = usePlanner((s) => s.view.showCoverageHeatmap);

  const thresholds = useMemo(() => defaultThresholds(), []);

  // 计算采样点覆盖
  const stats = useMemo(() => {
    if (!show) return null;
    return coverageOf(scene, thresholds, 16);
  }, [scene, show, thresholds]);

  // 映射生成 Three.js Points 数据
  const pointsData = useMemo(() => {
    if (!stats || stats.samples.length === 0) return null;

    const positions: number[] = [];
    const colors: number[] = [];

    // UE5.8 规范 HSL 调整的热图颜色归一化分量
    // heat-0: #2670a8 (蓝)
    // heat-1: #36b37e (绿)
    // heat-2: #97c93c (黄绿)
    // heat-3: #e0a538 (黄/橙)
    // heat-4: #c83838 (红)
    const heatColors = [
      [38 / 255, 112 / 255, 168 / 255],
      [54 / 255, 179 / 255, 126 / 255],
      [151 / 255, 201 / 255, 60 / 255],
      [224 / 255, 165 / 255, 56 / 255],
      [200 / 255, 56 / 255, 56 / 255],
    ];

    for (const sample of stats.samples) {
      positions.push(...sample.position);

      const count = sample.count;
      let rgb = [0.22, 0.22, 0.22]; // 盲区(0覆盖)：低对比度暗冷灰，确保不会过度刺眼

      if (count > 0) {
        if (count <= 2) rgb = heatColors[0];
        else if (count <= 4) rgb = heatColors[1];
        else if (count <= 7) rgb = heatColors[2];
        else if (count <= 10) rgb = heatColors[3];
        else rgb = heatColors[4];
      }
      colors.push(...rgb);
    }

    return {
      positions: new Float32Array(positions),
      colors: new Float32Array(colors),
    };
  }, [stats]);

  if (!show || !pointsData) return null;

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[pointsData.positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[pointsData.colors, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.07} // 点的物理尺寸（米）
        vertexColors
        transparent
        opacity={0.8}
        sizeAttenuation={true}
        depthWrite={false}
      />
    </points>
  );
}
