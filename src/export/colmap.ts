// T-018 COLMAP 三件套导出（src/export/colmap.ts）。
// 纯 TS，不依赖 react/three。复用 lib/math 的矩阵工具。
//
// COLMAP 文本格式（与 transforms.json 的关键差异）：
// - cameras.txt:  CAMERA_ID MODEL WIDTH HEIGHT PARAMS...  (PINHOLE: fx fy cx cy)
// - images.txt:   IMAGE_ID QW QX QY QZ TX TY TZ CAMERA_ID NAME
//                 —— 旋转用四元数(w,x,y,z)，平移+旋转描述 **world→camera** 变换（c2w 的逆）
// - points3D.txt: v1 留空（无点云）
//
// 内参推导与 transforms.ts 一致：fl = W/(2·tan(fovx/2))，像素正方形 → fx=fy，cx=W/2 cy=H/2。

import type { CameraDef, SceneDef } from '@/types';
import { composeMatrix, deg2rad, invert4, getWorldTransform } from '@/lib/math';

/** 由旋转矩阵(列主序 4x4 取左上 3x3)求四元数 (w,x,y,z)。 */
function mat3ToQuaternion(m: number[]): [number, number, number, number] {
  // 列主序元素
  const m00 = m[0], m10 = m[1], m20 = m[2];
  const m01 = m[4], m11 = m[5], m21 = m[6];
  const m02 = m[8], m12 = m[9], m22 = m[10];
  const trace = m00 + m11 + m22;
  let qw: number, qx: number, qy: number, qz: number;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2; // s=4*qw
    qw = 0.25 * s;
    qx = (m21 - m12) / s;
    qy = (m02 - m20) / s;
    qz = (m10 - m01) / s;
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2; // s=4*qx
    qw = (m21 - m12) / s;
    qx = 0.25 * s;
    qy = (m01 + m10) / s;
    qz = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2; // s=4*qy
    qw = (m02 - m20) / s;
    qx = (m01 + m10) / s;
    qy = 0.25 * s;
    qz = (m12 + m21) / s;
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2; // s=4*qz
    qw = (m10 - m01) / s;
    qx = (m02 + m20) / s;
    qy = (m12 + m21) / s;
    qz = 0.25 * s;
  }
  // 归一化（数值噪声兜底）
  const n = Math.hypot(qw, qx, qy, qz) || 1;
  return [qw / n, qx / n, qy / n, qz / n];
}

export interface ColmapFiles {
  camerasTxt: string;
  imagesTxt: string;
  points3DTxt: string;
}

/** 导出 COLMAP 三件套（文本）。 */
export function exportToColmap(scene: SceneDef): ColmapFiles {
  const activeCams = scene.cameras.filter((c) => c.enabled);
  // group 必须进入变换链：挂在组合下的相机的世界变换需经过 group
  const allEntities = [...scene.cameras, ...scene.lights, ...scene.subjects, ...(scene.groups ?? [])];

  const camerasLines: string[] = ['# CAMERA_ID MODEL WIDTH HEIGHT fx fy cx cy'];
  const imagesLines: string[] = [
    '# IMAGE_ID QW QX QY QZ TX TY TZ CAMERA_ID NAME',
    '# 空行占位（COLMAP 每 image 后需一行 points 索引，这里空）',
  ];

  activeCams.forEach((cam, i) => {
    const camId = i + 1;
    const { width: W, height: H } = cam.resolution;
    const fovxRad = deg2rad(cam.fov);
    const fx = W / (2 * Math.tan(fovxRad / 2));
    const fy = fx; // 像素正方形
    const cx = W / 2;
    const cy = H / 2;

    // cameras.txt：PINHOLE 模型
    camerasLines.push(`${camId} PINHOLE ${W} ${H} ${fx} ${fy} ${cx} ${cy}`);

    // world→camera 变换 = invert(camera→world)
    const wt = getWorldTransform(cam, allEntities);
    const c2w = composeMatrix(wt.position, wt.rotation, wt.scale ?? [1, 1, 1]);
    const w2c = invert4(c2w);

    // 四元数（旋转部分）
    const [qw, qx, qy, qz] = mat3ToQuaternion(w2c);
    // 平移（w2c 的第 4 列：index 12,13,14，列主序）
    const tx = w2c[12];
    const ty = w2c[13];
    const tz = w2c[14];

    imagesLines.push(
      `${camId} ${qw} ${qx} ${qy} ${qz} ${tx} ${ty} ${tz} ${camId} ${cam.name}`,
    );
    // 每个 image 后一个空行（COLMAP 约定：第二行是观测点列表，这里空）
    imagesLines.push('');
  });

  return {
    camerasTxt: camerasLines.join('\n') + '\n',
    imagesTxt: imagesLines.join('\n'),
    points3DTxt: '# v1 无点云\n# POINT3D_ID X Y Z R G B ERROR TRACK[]\n',
  };
}

/** 解析 cameras.txt + images.txt 还原 CameraDef（round-trip 自校验用）。 */
export function importFromColmap(files: ColmapFiles, aspectFallback = 16 / 9): CameraDef[] {
  const camRows = files.camerasTxt
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

  const imgRows = files.imagesTxt
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));

  // 内参表：camId → {fx,fy,cx,cy,W,H}
  const intrinsics = new Map<number, { fx: number; fy: number; cx: number; cy: number; W: number; H: number }>();
  for (const row of camRows) {
    const p = row.split(/\s+/);
    const id = Number(p[0]);
    const model = p[1];
    const W = Number(p[2]);
    const H = Number(p[3]);
    let fx: number, fy: number, cx: number, cy: number;
    if (model === 'PINHOLE') {
      [fx, fy, cx, cy] = [Number(p[4]), Number(p[5]), Number(p[6]), Number(p[7])];
    } else {
      // SIMPLE_PINHOLE: f cx cy
      fx = fy = Number(p[4]);
      cx = Number(p[5]);
      cy = Number(p[6]);
    }
    intrinsics.set(id, { fx, fy, cx, cy, W, H });
  }

  const cams: CameraDef[] = [];
  // images.txt：每 image 一行数据 + 一行空观测；按奇偶取数据行
  const dataRows = imgRows.filter((_, idx) => idx % 2 === 0);
  dataRows.forEach((row, i) => {
    const p = row.split(/\s+/);
    const qw = Number(p[1]), qx = Number(p[2]), qy = Number(p[3]), qz = Number(p[4]);
    const tx = Number(p[5]), ty = Number(p[6]), tz = Number(p[7]);
    const camId = Number(p[8]);
    const name = p.slice(9).join(' ') || `Camera_${i + 1}`;
    const intr = intrinsics.get(camId);
    if (!intr) return;

    // w2c 旋转矩阵（由四元数）
    const r: [number, number, number, number, number, number, number, number, number] = [
      1 - 2 * (qy * qy + qz * qz),
      2 * (qx * qy + qw * qz),
      2 * (qx * qz - qw * qy),
      2 * (qx * qy - qw * qz),
      1 - 2 * (qx * qx + qz * qz),
      2 * (qy * qz + qw * qx),
      2 * (qx * qz + qw * qy),
      2 * (qy * qz - qw * qx),
      1 - 2 * (qx * qx + qy * qy),
    ];
    // c2w = inverse(w2c)；用 [r|t]⁻¹：旋转转置 + -Rᵀt
    const px = -(r[0] * tx + r[3] * ty + r[6] * tz);
    const py = -(r[1] * tx + r[4] * ty + r[7] * tz);
    const pz = -(r[2] * tx + r[5] * ty + r[8] * tz);

    // 由 c2w 旋转矩阵反推欧拉角 XYZ（度）
    const sy_val = Math.max(-1, Math.min(1, r[2])); // r[2]=m02
    const ry = Math.asin(sy_val);
    let rx: number, rz: number;
    if (Math.abs(sy_val) < 0.999999) {
      rx = Math.atan2(-r[5], r[8]); // -m12 / m22
      rz = Math.atan2(-r[1], r[0]); // -m01 / m00
    } else {
      rx = 0;
      rz = Math.atan2(r[3], r[4]);
    }

    const fovxRad = 2 * Math.atan(intr.W / (2 * intr.fx));
    cams.push({
      id: `cam_colmap_${i + 1}`,
      kind: 'camera',
      name,
      transform: {
        position: [px, py, pz],
        rotation: [
          (rx * 180) / Math.PI,
          (ry * 180) / Math.PI,
          (rz * 180) / Math.PI,
        ],
        scale: [1, 1, 1],
      },
      model: 'PINHOLE',
      fov: (fovxRad * 180) / Math.PI,
      aspect: intr.W / intr.H || aspectFallback,
      near: 0.1,
      far: 1000,
      resolution: { width: intr.W, height: intr.H },
      exposure: { iso: 100, shutter: 1 / 125, aperture: 2.8 },
      enabled: true,
    });
  });

  return cams;
}
