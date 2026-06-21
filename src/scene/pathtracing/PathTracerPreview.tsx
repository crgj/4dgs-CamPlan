/**
 * T-083 渐进式 Path Tracing 预览（src/scene/pathtracing/PathTracerPreview.tsx）。
 *
 * 设计：pathTracing 模式下用 three-gpu-pathtracer 渐进采样。
 * 当前为骨架——three-gpu-pathtracer API 在 0.0.x 版本仍频繁变动，
 * 完整命令式集成（BVH 构建 + 帧循环 + accumulation reset + 输出到 Canvas）
 * 需在浏览器实测调通，避免沙箱内引入无法验证的运行时崩溃。
 *
 * 启用条件：store.renderSettings.pathTracing === true。
 * 骨架负责：声明依赖、暴露集成点、不崩溃。
 */
import { usePlanner } from '@/state/store';

export function PathTracerPreview() {
  // 读取设置确保组件订阅（未来集成用）
  const enabled = usePlanner((s) => s.renderSettings.pathTracing);
  const samples = usePlanner((s) => s.renderSettings.ptSamples);
  const bounces = usePlanner((s) => s.renderSettings.ptBounces);

  if (!enabled) return null;

  // TODO(browser): 接入 three-gpu-pathtracer
  // 1. const ptRenderer = new PathTracingRenderer(gl)
  // 2. 构建 MeshBVH(scene) → ptRenderer.material.bvh.updateFrom(bvh)
  // 3. 帧循环 ptRenderer.update() 渐进采样；场景变化时 ptRenderer.reset()
  // 4. samples/bounces 写入 ptRenderer.material
  void samples;
  void bounces;
  return null;
}
