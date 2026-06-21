// T-019 拍摄清单生成（src/sim/capture.ts）。
// 纯 TS。把启用的相机阵列整理为“拍摄清单”：每机位的世界→相机 4×4 矩阵、
// 内参、曝光、期望触发时刻（4DGS 预留 t）。可导出 CSV/JSON。
//
// 这是连接“规划场景”与“真实采集执行”的桥梁：操作员据此摆机位、设曝光、按时刻触发。

import type { CameraDef, CaptureList, CaptureRow, SceneDef } from '@/types';
import type { HierarchicalEntity } from '@/lib/math';
import { composeMatrix, deg2rad, invert4, getWorldTransform } from '@/lib/math';

/** 由相机定义算单行清单。 */
export function captureRowForCamera(
  cam: CameraDef,
  allEntities: readonly HierarchicalEntity[],
): CaptureRow {
  const wt = getWorldTransform(cam as unknown as HierarchicalEntity, [...allEntities]);
  const c2w = composeMatrix(wt.position, wt.rotation, wt.scale ?? [1, 1, 1]);
  const w2c = invert4(c2w); // 世界→相机（列主序 16 维）

  const { width: W, height: H } = cam.resolution;
  const fovxRad = deg2rad(cam.fov);
  const fx = W / (2 * Math.tan(fovxRad / 2));
  const fy = fx;

  const row: CaptureRow = {
    id: cam.id,
    name: cam.name,
    worldToCamera: w2c,
    intrinsics: { fx, fy, cx: W / 2, cy: H / 2, width: W, height: H },
    exposure: cam.exposure,
  };
  if (cam.time !== undefined) row.time = cam.time;
  return row;
}

/** 生成整个场景的拍摄清单（仅启用相机）。按 time（若有）升序，否则按数组序。 */
export function buildCaptureList(scene: SceneDef): CaptureList {
  const allEntities = [...scene.cameras, ...scene.lights, ...scene.subjects];
  const rows = scene.cameras
    .filter((c) => c.enabled)
    .map((c) => captureRowForCamera(c, allEntities))
    .sort((a, b) => (a.time ?? 0) - (b.time ?? 0));

  return { rows, generatedAt: new Date().toISOString() };
}

/** 拍摄清单 → CSV（操作员友好）。 */
export function captureListToCsv(list: CaptureList): string {
  const header = [
    'id',
    'name',
    'time',
    'px', 'py', 'pz',
    'fx', 'fy', 'cx', 'cy',
    'w', 'h',
    'iso', 'shutter', 'aperture',
  ].join(',');
  const lines = [header];
  for (const r of rowsSorted(list)) {
    // 平移取自 w2c 第 4 列（列主序 12,13,14）
    const px = r.worldToCamera[12];
    const py = r.worldToCamera[13];
    const pz = r.worldToCamera[14];
    lines.push(
      [
        r.id,
        `"${r.name.replace(/"/g, '""')}"`,
        r.time ?? '',
        px.toFixed(6), py.toFixed(6), pz.toFixed(6),
        r.intrinsics.fx.toFixed(4), r.intrinsics.fy.toFixed(4),
        r.intrinsics.cx.toFixed(2), r.intrinsics.cy.toFixed(2),
        r.intrinsics.width, r.intrinsics.height,
        r.exposure.iso, r.exposure.shutter, r.exposure.aperture,
      ].join(','),
    );
  }
  return lines.join('\n') + '\n';
}

/** 拍摄清单 → JSON 字符串（含生成时间）。 */
export const captureListToJson = (list: CaptureList): string =>
  JSON.stringify(list, null, 2);

// 小工具：按原始序输出（CSV 不再二次排序，避免与 list 不一致）
function rowsSorted(list: CaptureList): CaptureRow[] {
  return list.rows;
}
