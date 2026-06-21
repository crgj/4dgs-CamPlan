/**
 * 视锥（frustum）数学（src/sim/frustum.ts）。
 *
 * **铁律**：本文件是纯 TS，不 import react/three。只依赖 @/types 与 @/lib。
 * 用纯矩阵构造“相机→裁剪”变换，把世界点变到裁剪空间判定可见性。
 * 覆盖/重叠计算(T-006/T-007)建立在此之上。
 *
 * 相机约定（与 Three.js/OpenCV 一致）：相机看向自身局部 -Z 轴，上 +Y，右 +X。
 * CameraDef.transform 描述“相机→世界”(物体→世界)位姿；视图矩阵 = 其逆。
 *
 * 角度统一在 lib/math 换算（不在本文件出现裸 *π/180）。
 */
import type { AnyEntity, CameraDef, Vec3 } from '@/types';
import { composeMatrix, deg2rad, invert4, multiply4, transformPoint, getWorldTransform } from '@/lib/math';

/**
 * 透视投影矩阵（列主序），与 OpenGL/WebGL/Three.js 约定一致：
 * 把相机空间点映射到裁剪空间，使得可见点满足：
 *   -w ≤ x,y ≤ w,  0 ≤ z ≤ w   (即 NDC z ∈ [0,1])
 *
 * @param fovY 垂直视场角（弧度）。
 * @param aspect 宽/高。
 * @param near 近裁剪面（>0）。
 * @param far  远裁剪面（>near）。
 */
export function perspectiveFovY(
  fovY: number,
  aspect: number,
  near: number,
  far: number,
): number[] {
  const f = 1 / Math.tan(fovY / 2);
  const nf = 1 / (near - far);
  // 列主序
  return [
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far) * nf, -1,
    0, 0, far * near * nf, 0,
  ];
}

/**
 * 由水平 fov(度) 与 aspect 求垂直 fov(弧度)。
 * tan(fovH/2) = aspect * tan(fovV/2)。
 */
export const verticalFovFromHorizontal = (fovDeg: number, aspect: number): number =>
  2 * Math.atan(Math.tan(deg2rad(fovDeg) / 2) / aspect);

/**
 * 由相机定义构造 view 矩阵（世界 → 相机）。
 * = invert(相机→世界 的模型矩阵)。
 * #WDD -gemini 2026-06-19 增加 allEntities 级联计算以支持子相机世界位姿反算
 */
// #WDD-gpt  2026-06-19 - 级联世界变换参数改为 AnyEntity[]，避免 sim 层 any 漏洞
export function viewMatrix(cam: CameraDef, allEntities?: AnyEntity[]): number[] {
  const transform = allEntities
    ? getWorldTransform(cam, allEntities)
    : cam.transform;
  const model = composeMatrix(
    transform.position,
    transform.rotation,
    transform.scale ?? [1, 1, 1],
  );
  return invert4(model);
}

/**
 * 由相机定义构造 view-projection 矩阵（世界 → 裁剪）。
 * proj @ view。
 */
export function viewProjection(cam: CameraDef, allEntities?: AnyEntity[]): number[] {
  const fovY = verticalFovFromHorizontal(cam.fov, cam.aspect);
  const proj = perspectiveFovY(fovY, cam.aspect, cam.near, cam.far);
  return multiply4(proj, viewMatrix(cam, allEntities));
}

/** 裁剪空间点（含 w）。 */
export type ClipPoint = [x: number, y: number, z: number, w: number];

/** 世界点经 view-projection 变到裁剪空间。 */
export function toClip(vp: number[], p: Vec3): ClipPoint {
  return transformPoint(vp, p);
}

/**
 * 裁剪空间点是否在视锥内（可见）。
 * 条件：-w ≤ x ≤ w,  -w ≤ y ≤ w,  0 ≤ z ≤ w，且 w > 0。
 * （w > 0 保证点在相机前方；w ≤ 0 表示在背后或奇异。）
 */
export function pointInFrustumClip(c: ClipPoint): boolean {
  const { 0: x, 1: y, 2: z, 3: w } = c;
  if (w <= 0) return false;
  return x >= -w && x <= w && y >= -w && y <= w && z >= 0 && z <= w;
}

/**
 * 世界点是否在该相机的视锥内（可见）。
 * 等价于：经 view-projection 到裁剪空间后通过 pointInFrustumClip。
 */
export function pointVisibleToCamera(cam: CameraDef, p: Vec3, allEntities?: AnyEntity[]): boolean {
  const vp = viewProjection(cam, allEntities);
  return pointInFrustumClip(toClip(vp, p));
}

// ---------------------------------------------------------------------------
// 注：6 平面表示（Gribb-Hartmann / 几何平面）刻意未在 v1 提供。
// 裁剪空间法已能正确判定可见性，且单测充分。若后续算法（如精确遮挡、
// 逐平面距离权重）确需 6 平面，再在此实现并补交叉验证单测——避免维护
// 一套未使用且易错的第二种实现。
// ---------------------------------------------------------------------------
