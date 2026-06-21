/**
 * 视锥角点（世界空间）工具（src/scene/lib/frustumCorners.ts）。
 * 给定相机定义，返回近/远面 8 个角点（世界坐标），用于线框可视化。
 * 复用 sim/frustum 的相机基向量推导。
 */
import type { CameraDef, Vec3 } from '@/types';
import { verticalFovFromHorizontal } from '@/sim/frustum';
import { deg2rad } from '@/lib/math';

/** 返回顺序：[nTL,nTR,nBR,nBL, fTL,fTR,fBR,fBL]（近/远面 左上/右上/右下/左下）。 */
export function frustumCornersWorld(cam: CameraDef): Vec3[] {
  const [px, py, pz] = cam.transform.position;
  const [rxd, ryd, rzd] = cam.transform.rotation;
  const rx = deg2rad(rxd), ry = deg2rad(ryd), rz = deg2rad(rzd);

  // 相机世界基：forward=-Z, right=+X, up=+Y，经欧拉旋转
  const rot = (v: Vec3): Vec3 => {
    const [x, y, z] = v;
    const y1 = y * Math.cos(rx) - z * Math.sin(rx);
    const z1 = y * Math.sin(rx) + z * Math.cos(rx);
    const x2 = x * Math.cos(ry) + z1 * Math.sin(ry);
    const z2 = -x * Math.sin(ry) + z1 * Math.cos(ry);
    const x3 = x2 * Math.cos(rz) - y1 * Math.sin(rz);
    const y3 = x2 * Math.sin(rz) + y1 * Math.cos(rz);
    return [x3, y3, z2];
  };
  const forward = rot([0, 0, -1]);
  const right = rot([1, 0, 0]);
  const up = rot([0, 1, 0]);

  const halfV = Math.tan(verticalFovFromHorizontal(cam.fov, cam.aspect) / 2);
  const halfH = halfV * cam.aspect;

  const plane = (dist: number): Vec3[] => {
    const cx = px + forward[0] * dist;
    const cy = py + forward[1] * dist;
    const cz = pz + forward[2] * dist;
    const hw = halfH * dist;
    const hv = halfV * dist;
    const corner = (sR: number, sU: number): Vec3 => [
      cx + right[0] * hw * sR + up[0] * hv * sU,
      cy + right[1] * hw * sR + up[1] * hv * sU,
      cz + right[2] * hw * sR + up[2] * hv * sU,
    ];
    return [corner(-1, 1), corner(1, 1), corner(1, -1), corner(-1, -1)];
  };

  return [...plane(cam.near), ...plane(cam.far)];
}
