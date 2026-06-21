/**
 * T-043 表面采样与可见性精化（src/sim/surfaceSampling.ts）。
 * v1 的体积栅格采样（sampleSubjectVolume）改为表面采样：
 *   box → 6 面网格、sphere → 球面参数化、plane → 单面网格。
 * 表面点带法线，可计算入射角（cosθ）与有效像素 footprint。
 * 纯 TS，无 Three 依赖；遮挡仍用 AABB 近似（精确 raycast 见 v2 注释）。
 */
import type { SubjectDef, Vec3 } from '@/types';
import { aabbSize } from '@/lib/aabb';

export interface SurfacePoint {
  position: Vec3;
  /** 该点的表面法线（世界空间，归一化）。 */
  normal: Vec3;
}

const add3 = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const norm3 = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** 在 box 主体 6 个表面生成网格采样点（带向外法线）。 */
function sampleBoxSurface(subject: SubjectDef, density: number): SurfacePoint[] {
  const [sx, sy, sz] = aabbSize(subject.bounds);
  const c = subject.bounds.min;
  const pts: SurfacePoint[] = [];
  const nx = Math.max(2, Math.round(sx * density));
  const ny = Math.max(2, Math.round(sy * density));
  const nz = Math.max(2, Math.round(sz * density));

  const grid = (u0: number, u1: number, nu: number, v0: number, v1: number, nv: number): Array<[number, number]> => {
    const out: Array<[number, number]> = [];
    for (let i = 0; i < nu; i++)
      for (let j = 0; j < nv; j++)
        out.push([u0 + ((u1 - u0) * (i + 0.5)) / nu, v0 + ((v1 - v0) * (j + 0.5)) / nv]);
    return out;
  };

  // X+ / X- 面
  for (const [y, z] of grid(c[1], c[1] + sy, ny, c[2], c[2] + sz, nz)) {
    pts.push({ position: [c[0] + sx, y, z], normal: [1, 0, 0] });
    pts.push({ position: [c[0], y, z], normal: [-1, 0, 0] });
  }
  // Y+ / Y- 面
  for (const [x, z] of grid(c[0], c[0] + sx, nx, c[2], c[2] + sz, nz)) {
    pts.push({ position: [x, c[1] + sy, z], normal: [0, 1, 0] });
    pts.push({ position: [x, c[1], z], normal: [0, -1, 0] });
  }
  // Z+ / Z- 面
  for (const [x, y] of grid(c[0], c[0] + sx, nx, c[1], c[1] + sy, ny)) {
    pts.push({ position: [x, y, c[2] + sz], normal: [0, 0, 1] });
    pts.push({ position: [x, y, c[2]], normal: [0, 0, -1] });
  }
  return pts;
}

/** 球面参数化采样（经纬网格，带径向法线）。 */
function sampleSphereSurface(subject: SubjectDef, density: number): SurfacePoint[] {
  if (subject.geometry.type !== 'sphere') return sampleBoxSurface(subject, density);
  const r = subject.geometry.radius;
  const center = add3(subject.bounds.min, [aabbSize(subject.bounds)[0] / 2, aabbSize(subject.bounds)[1] / 2, aabbSize(subject.bounds)[2] / 2]);
  const pts: SurfacePoint[] = [];
  const nTheta = Math.max(6, Math.round(Math.PI * r * density)); // 极角
  const nPhi = Math.max(8, Math.round(2 * Math.PI * r * density)); // 方位角
  for (let i = 0; i < nTheta; i++) {
    const theta = (Math.PI * (i + 0.5)) / nTheta; // 避免极点退化
    for (let j = 0; j < nPhi; j++) {
      const phi = (2 * Math.PI * j) / nPhi;
      const n: Vec3 = [
        Math.sin(theta) * Math.cos(phi),
        Math.cos(theta),
        Math.sin(theta) * Math.sin(phi),
      ];
      pts.push({ position: [center[0] + n[0] * r, center[1] + n[1] * r, center[2] + n[2] * r], normal: n });
    }
  }
  return pts;
}

/** 平面单面采样（法线朝 +Y，地面/底板）。 */
function samplePlaneSurface(subject: SubjectDef, density: number): SurfacePoint[] {
  const [sx, sy] = aabbSize(subject.bounds);
  const c = subject.bounds.min;
  const pts: SurfacePoint[] = [];
  const nx = Math.max(2, Math.round(sx * density));
  const nz = Math.max(2, Math.round(sy ? sy : sx * density));
  for (let i = 0; i < nx; i++)
    for (let j = 0; j < nz; j++)
      pts.push({
        position: [c[0] + (sx * (i + 0.5)) / nx, c[1], c[2] + ((sy || sx) * (j + 0.5)) / nz],
        normal: [0, 1, 0],
      });
  return pts;
}

/**
 * 按主体几何类型生成表面采样点。
 * @param density 每米采样点数（默认 5）。
 */
export function sampleSubjectSurface(subject: SubjectDef, density = 5): SurfacePoint[] {
  switch (subject.geometry.type) {
    case 'sphere':
      return sampleSphereSurface(subject, density);
    case 'plane':
      return samplePlaneSurface(subject, density);
    case 'box':
    case 'mesh':
    default:
      return sampleBoxSurface(subject, density);
  }
}

/** 采样点到相机的入射角余弦（法线 · 视线），用于评估纹理质量。 */
export function incidenceCosine(point: SurfacePoint, cameraPos: Vec3): number {
  const dir = norm3([cameraPos[0] - point.position[0], cameraPos[1] - point.position[1], cameraPos[2] - point.position[2]]);
  return Math.max(0, dir[0] * point.normal[0] + dir[1] * point.normal[1] + dir[2] * point.normal[2]);
}

/** 采样点到相机的距离（米）。 */
export function distanceTo(point: SurfacePoint, cameraPos: Vec3): number {
  return Math.hypot(
    point.position[0] - cameraPos[0],
    point.position[1] - cameraPos[1],
    point.position[2] - cameraPos[2],
  );
}
