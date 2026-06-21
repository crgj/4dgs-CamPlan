/**
 * 数学工具（src/lib/math.ts）。
 *
 * **铁律（planner-conventions）**：全项目角度换算只允许在此进行。
 * 其它模块收到的是“度”，转换成弧度或反之必须调用这里。
 * 不依赖 three/react（纯函数，可单测、可 Node 复用）。
 */
import type { ColorHex, Vec3 } from '@/types';

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/** 度 → 弧度。 */
export const deg2rad = (deg: number): number => deg * DEG2RAD;

/** 弧度 → 度。 */
export const rad2deg = (rad: number): number => rad * RAD2DEG;

/** 三个欧拉角（度）→ 弧度元组，顺序 XYZ。 */
export const deg3ToRad3 = (deg: Vec3): [number, number, number] => [
  deg2rad(deg[0]),
  deg2rad(deg[1]),
  deg2rad(deg[2]),
];

/** 把度归一到 [0, 360)。 */
export const wrapDeg = (deg: number): number => {
  const r = deg % 360;
  return r < 0 ? r + 360 : r;
};

/** 把度归一到 [-180, 180)。用于显示与差值。 */
export const wrapDegSigned = (deg: number): number => {
  const w = wrapDeg(deg);
  return w >= 180 ? w - 360 : w;
};

/**
 * 计算让「位于 from 的相机看向 target」所需的 XYZ 欧拉角（度，与 Three.js 默认 Euler 'XYZ' 一致）。
 *
 * Three.js 相机/物体默认朝向 -Z，世界 up = (0,1,0)。本函数构造一个「相机 -Z 指向 target」的
 * 旋转矩阵（right = normalize(up × forward)，up' = forward × right），再用 Three.js 的
 * setFromRotationMatrix('XYZ') 公式反解出 [pitch, yaw, roll] 度。这样保证 CameraRig 用
 * `<group rotation={[deg...]} >`（XYZ Euler）渲染时，视锥真正指向 target——
 * 而非简单地分别塞 pitch/yaw（XYZ Euler 有 gimbal 耦合，单纯拼 [pitch,yaw,0] 不指向目标）。
 *
 * 注：当 pitch 与 yaw 同时非零时，反解出的 XYZ 欧拉角含非零 roll（这是 XYZ 顺序表示「水平地平线」
 * 相机姿态的正确且唯一解）。frustum 朝向正确即可，Inspector 显示的是原始欧拉角。
 *
 * 纯函数、不依赖 three/react，可单测、可 Node 复用。
 *
 * #WDD-gpt 2026-06-20 - 统一相机「看向中心」的旋转换算，修正此前 yaw=180+azimuth 偏 90° 的 bug。
 */
export function lookAtRotation(from: Vec3, target: Vec3): Vec3 {
  let fx = target[0] - from[0];
  let fy = target[1] - from[1];
  let fz = target[2] - from[2];
  const fl = Math.hypot(fx, fy, fz);
  if (fl > 1e-9) {
    fx /= fl;
    fy /= fl;
    fz /= fl;
  } else {
    fx = 0;
    fy = 0;
    fz = -1; // 退化：保持默认朝向 -Z
  }
  // right = normalize(forward × worldUp) —— 让相机 right 指向 +X 侧（标准 lookAt 约定）
  // 叉积 a×b = (a.y*b.z - a.z*b.y, a.z*b.x - a.x*b.z, a.x*b.y - a.y*b.x)
  let ux = 0;
  const uy = 1;
  let uz = 0;
  let rx = fy * uz - fz * uy;
  let ry = fz * ux - fx * uz;
  let rz = fx * uy - fy * ux;
  let rl = Math.hypot(rx, ry, rz);
  if (rl < 1e-9) {
    // worldUp 与 forward 共线（正/负朝上），换用 (0,0,1) 作 up
    ux = 0;
    uz = 1;
    rx = fy * uz - fz * uy;
    ry = fz * ux - fx * uz;
    rz = fx * uy - fy * ux;
    rl = Math.hypot(rx, ry, rz);
  }
  if (rl > 1e-9) {
    rx /= rl;
    ry /= rl;
    rz /= rl;
  }
  // up' = right × forward
  const upx = ry * fz - rz * fy;
  const upy = rz * fx - rx * fz;
  const upz = rx * fy - ry * fx;
  // 列主序旋转矩阵：列0=right(X), 列1=up'(Y), 列2=back=-forward(Z)
  const m = [
    rx, ry, rz, 0,
    upx, upy, upz, 0,
    -fx, -fy, -fz, 0,
    0, 0, 0, 1,
  ];
  // setFromRotationMatrix (Euler 'XYZ')：m_ij = m[col*4+row]
  const m11 = m[0];
  const m12 = m[4];
  const m13 = m[8];
  const m23 = m[9];
  const m33 = m[10];
  const x = Math.atan2(-m23, m33);
  const clamped = Math.max(-1, Math.min(1, m13));
  const y = Math.asin(clamped);
  const z = Math.atan2(-m12, m11);
  return [rad2deg(x), rad2deg(y), rad2deg(z)];
}

// ---------------------------------------------------------------------------
// 颜色：hex 整数 ↔ 归一化线性 rgb（0..1）。全项目颜色换算集中于此。
// ---------------------------------------------------------------------------

export interface RGB {
  r: number;
  g: number;
  b: number;
}

/** hex 整数（0xRRGGBB）→ 0..1 sRGB 分量（未做 gamma 线性化，UI/导出口径统一即可）。 */
export const hexToRgb = (hex: ColorHex): RGB => ({
  r: ((hex >> 16) & 0xff) / 255,
  g: ((hex >> 8) & 0xff) / 255,
  b: (hex & 0xff) / 255,
});

/** 0..1 分量 → hex 整数。分量自动 clamp 到 [0,1]。 */
export const rgbToHex = ({ r, g, b }: RGB): ColorHex => {
  const c = (x: number) => Math.round(Math.min(1, Math.max(0, x)) * 255);
  return (c(r) << 16) | (c(g) << 8) | c(b);
};

// ---------------------------------------------------------------------------
// 向量 / 矩阵纯函数（不依赖 three）。
// 矩阵用列主序 number[16]（与 Three.js / WebGL 一致）。
// ---------------------------------------------------------------------------

/** 单位 4×4 矩阵（列主序）。 */
export const identity4 = (): number[] => [
  1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
];

/**
 * 由 position(米) + rotation(度,XYZ) + scale 构造 4×4 模型矩阵（列主序）。
 * 这是相机/灯光/主体“物体→世界”变换。对相机而言，世界→相机取其逆（见 invert4）。
 */
export function composeMatrix(
  position: Vec3,
  rotationDeg: Vec3,
  scale: Vec3 = [1, 1, 1],
): number[] {
  const [rx, ry, rz] = deg3ToRad3(rotationDeg);
  const cx = Math.cos(rx),
    sx = Math.sin(rx);
  const cy = Math.cos(ry),
    sy = Math.sin(ry);
  const cz = Math.cos(rz),
    sz = Math.sin(rz);

  // R = Rz * Ry * Rx（Three.js 默认 XYZ 即此顺序：先 Rx 再 Ry 再 Rz）
  const m00 = cy * cz;
  const m01 = -cy * sz;
  const m02 = sy;
  const m10 = sx * sy * cz + cx * sz;
  const m11 = -sx * sy * sz + cx * cz;
  const m12 = -sx * cy;
  const m20 = -cx * sy * cz + sx * sz;
  const m21 = cx * sy * sz + sx * cz;
  const m22 = cx * cy;

  const [sx_, sy_, sz_] = scale;
  // 列主序：列0
  return [
    m00 * sx_, m10 * sx_, m20 * sx_, 0,
    m01 * sy_, m11 * sy_, m21 * sy_, 0,
    m02 * sz_, m12 * sz_, m22 * sz_, 0,
    position[0], position[1], position[2], 1,
  ];
}

/** 4×4 矩阵乘法（列主序）。返回新数组。 */
export function multiply4(a: number[], b: number[]): number[] {
  const out = new Array(16);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      out[col * 4 + row] =
        a[0 * 4 + row] * b[col * 4 + 0] +
        a[1 * 4 + row] * b[col * 4 + 1] +
        a[2 * 4 + row] * b[col * 4 + 2] +
        a[3 * 4 + row] * b[col * 4 + 3];
    }
  }
  return out;
}

/** 4×4 矩阵求逆（通用，列主序）。奇异矩阵返回单位阵。 */
export function invert4(m: number[]): number[] {
  const out = new Array(16);
  // 行主序展开便于读公式：把列主序 m 映射到 a[row][col]
  const a00 = m[0],
    a01 = m[4],
    a02 = m[8],
    a03 = m[12];
  const a10 = m[1],
    a11 = m[5],
    a12 = m[9],
    a13 = m[13];
  const a20 = m[2],
    a21 = m[6],
    a22 = m[10],
    a23 = m[14];
  const a30 = m[3],
    a31 = m[7],
    a32 = m[11],
    a33 = m[15];

  const b00 = a00 * a11 - a01 * a10;
  const b01 = a00 * a12 - a02 * a10;
  const b02 = a00 * a13 - a03 * a10;
  const b03 = a01 * a12 - a02 * a11;
  const b04 = a01 * a13 - a03 * a11;
  const b05 = a02 * a13 - a03 * a12;
  const b06 = a20 * a31 - a21 * a30;
  const b07 = a20 * a32 - a22 * a30;
  const b08 = a20 * a33 - a23 * a30;
  const b09 = a21 * a32 - a22 * a31;
  const b10 = a21 * a33 - a23 * a31;
  const b11 = a22 * a33 - a23 * a32;

  let det =
    b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (det === 0) return identity4();
  det = 1 / det;

  out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
  out[1] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
  out[2] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
  out[3] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
  out[4] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
  out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
  out[6] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
  out[7] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
  out[8] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
  out[9] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
  out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
  out[11] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
  out[12] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
  out[13] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
  out[14] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
  out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
  return out;
}

/** 矩阵 × 点（w=1），返回齐次坐标 [x,y,z,w]。 */
export function transformPoint(m: number[], p: Vec3): [number, number, number, number] {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
    m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15],
  ];
}

/** 三向量距离（米）。 */
export const distance3 = (a: Vec3, b: Vec3): number =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** 数值容差：比较矩阵/坐标时用（round-trip 测试）。 */
export const EPS = 1e-9;

/** 数组近似相等（按元素绝对差 < eps）。 */
export const approx = (a: number[], b: number[], eps = EPS): boolean => {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > eps) return false;
  return true;
};

/** 具有层级与变换特征的通用实体接口 */
export interface HierarchicalEntity {
  id: string;
  parentId?: string;
  transform: {
    position: Vec3;
    rotation: Vec3;
    scale?: Vec3;
  };
}

/** 
 * 根据层级计算出实体的世界空间变换
 * #WDD -gemini 2026-06-19 增加通用层级矩阵级联计算，将局部坐标变换解算为世界坐标变换
 */
export function getWorldTransform(
  entity: HierarchicalEntity,
  allEntities: HierarchicalEntity[],
): {
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
} {
  // 1. 向上寻找变换链路
  const path: HierarchicalEntity[] = [];
  let curr: HierarchicalEntity | undefined = entity;
  const visited = new Set<string>();

  while (curr) {
    if (visited.has(curr.id)) break; // 防闭环
    visited.add(curr.id);
    path.unshift(curr); // 祖先在最前面
    if (!curr.parentId) break;
    curr = allEntities.find((e) => e.id === curr!.parentId);
  }

  // 2. 依次乘积
  let worldMat = identity4();
  for (const ent of path) {
    const localMat = composeMatrix(
      ent.transform.position,
      ent.transform.rotation,
      ent.transform.scale ?? [1, 1, 1],
    );
    worldMat = multiply4(worldMat, localMat);
  }

  // 3. 解构世界坐标位姿
  const position: Vec3 = [worldMat[12], worldMat[13], worldMat[14]];

  // 提取各轴 scale
  const sx = Math.sqrt(worldMat[0] ** 2 + worldMat[1] ** 2 + worldMat[2] ** 2);
  const sy = Math.sqrt(worldMat[4] ** 2 + worldMat[5] ** 2 + worldMat[6] ** 2);
  const sz = Math.sqrt(worldMat[8] ** 2 + worldMat[9] ** 2 + worldMat[10] ** 2);
  const scale: Vec3 = [sx, sy, sz];

  // 提取旋转欧拉角 (XYZ)
  const r02_n = worldMat[8] / sz;
  const r00_n = worldMat[0] / sx;
  const r01_n = worldMat[4] / sy;
  const r10_n = worldMat[1] / sx;
  const r11_n = worldMat[5] / sy;
  const r12_n = worldMat[9] / sz;
  const r22_n = worldMat[10] / sz;

  const sy_val = Math.max(-1, Math.min(1, r02_n));
  const ry_rad = Math.asin(sy_val);
  let rx_rad: number;
  let rz_rad: number;

  if (Math.abs(sy_val) < 0.999999) {
    rx_rad = Math.atan2(-r12_n, r22_n);
    rz_rad = Math.atan2(-r01_n, r00_n);
  } else {
    rx_rad = 0;
    rz_rad = Math.atan2(r10_n, r11_n);
  }

  return {
    position,
    rotation: [
      rad2deg(rx_rad),
      rad2deg(ry_rad),
      rad2deg(rz_rad),
    ],
    scale,
  };
}
