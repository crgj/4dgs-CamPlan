/**
 * T-083 渐进式 Path Tracing 预览（src/scene/pathtracing/PathTracerPreview.tsx）。
 *
 * 设计：pathTracing 模式下用 three-gpu-pathtracer 渐进采样。
 * 当前为骨架——three-gpu-pathtracer API 在 0.0.x 版本仍频繁变动，
 * 完整命令式集成（BVH 构建 + 帧循环 + accumulation reset + 输出到 Canvas）
 * 需在浏览器实测调通，避免沙箱内引入无法验证的运行时崩溃。
 *
 * 启用条件：store.renderSettings.pathTracing === true。
 * 骨架负责：声明依赖、暴露集成点、不接管画布、不破坏标准渲染。
 */
import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { WebGLPathTracer } from 'three-gpu-pathtracer';
import { usePlanner } from '@/state/store';
import {
  emitPathTracingSnapshotStatus,
  type PathTracingSnapshotRequest,
  subscribePathTracingSnapshot,
} from './pathTracingSnapshot';

function nextFrame(): Promise<void> {
  return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
}

export function PathTracerPreview() {
  const { camera, gl, invalidate, scene } = useThree();
  const log = usePlanner((s) => s.log);
  // 读取设置确保组件订阅（未来集成用）
  const enabled = usePlanner((s) => s.renderSettings.pathTracing);
  const samples = usePlanner((s) => s.renderSettings.ptSamples);
  const bounces = usePlanner((s) => s.renderSettings.ptBounces);

  useEffect(() => {
    if (!enabled) return;
    // #WDD-gpt  2026-06-21 - PT 仍是占位实现；启用时只触发一次标准渲染刷新，不创建空 PT pass 覆盖画面
    invalidate();
  }, [bounces, enabled, invalidate, samples]);

  useEffect(() => {
    let busy = false;
    let cancelled = false;

    const handleSnapshot = async (detail: PathTracingSnapshotRequest) => {
      if (busy) {
        log('warn', 'PT snapshot is already rendering');
        return;
      }
      busy = true;
      const sampleCount = Math.max(1, Math.min(Math.floor(detail.samples), 64));
      const bounceCount = Math.max(1, Math.min(Math.floor(detail.bounces), 8));
      let pathTracer: WebGLPathTracer | null = null;
      try {
        emitPathTracingSnapshotStatus({
          id: detail.id,
          state: 'rendering',
          message: `PT snapshot rendering: ${sampleCount} samples / ${bounceCount} bounces`,
        });
        log('info', `PT snapshot started: ${sampleCount} samples / ${bounceCount} bounces`);
        // #WDD-gpt  2026-06-21 - 静态快照只渲染有限样本并下载 PNG，不把 PT 接入实时主循环
        pathTracer = new WebGLPathTracer(gl);
        pathTracer.bounces = bounceCount;
        pathTracer.tiles.set(1, 1);
        pathTracer.dynamicLowRes = false;
        pathTracer.renderToCanvas = true;
        pathTracer.setScene(scene, camera);
        pathTracer.reset();

        for (let i = 0; i < sampleCount && !cancelled; i++) {
          pathTracer.renderSample();
          await nextFrame();
        }
        if (cancelled) return;
        const filename = `camplan_pt_snapshot_${Date.now()}.png`;
        const dataURL = gl.domElement.toDataURL('image/png');
        emitPathTracingSnapshotStatus({
          id: detail.id,
          state: 'complete',
          message: `PT snapshot ready: ${sampleCount} samples`,
          dataURL,
          filename,
        });
        log('info', `PT snapshot exported: ${sampleCount} samples`);
      } catch (err) {
        const message = `PT snapshot failed: ${err instanceof Error ? err.message : String(err)}`;
        emitPathTracingSnapshotStatus({ id: detail.id, state: 'error', message });
        log('error', message);
      } finally {
        pathTracer?.dispose();
        invalidate();
        busy = false;
      }
    };

    const unsubscribe = subscribePathTracingSnapshot(handleSnapshot);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [camera, gl, invalidate, log, scene]);

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
