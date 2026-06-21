// WDD -gemini 2026-06-19 新增 transforms.json 导出与导入反向解析逻辑，去除 any 并修复 ESLint 赋值警告

import type { CameraDef, SceneDef, Exposure } from '@/types';
import { composeMatrix, deg2rad, rad2deg, getWorldTransform } from '@/lib/math';
import { validateTransformsJson } from './schema';
import type { TransformsJsonData, TransformsFrameData } from './schema';

/**
 * 将 SceneDef 中的启用相机导出为 Nerfstudio 兼容的 transforms.json 格式。
 * 如果所有启用的相机内参完全相同，则将其提取到顶层；
 * 否则在每个 frame 中保存各自的内参，以支持混合相机阵列。
 */
export function exportToTransformsJson(scene: SceneDef): string {
  const activeCams = scene.cameras.filter((c) => c.enabled);
  if (activeCams.length === 0) {
    return JSON.stringify(
      {
        camera_model: 'PERSPECTIVE',
        frames: [],
      },
      null,
      2
    );
  }

  // 检查是否所有相机的内参、宽高、裁剪面完全一致
  const first = activeCams[0];
  const allIdentical = activeCams.every(
    (c) =>
      c.fov === first.fov &&
      c.aspect === first.aspect &&
      c.resolution.width === first.resolution.width &&
      c.resolution.height === first.resolution.height &&
      c.near === first.near &&
      c.far === first.far
  );

  const buildIntrinsics = (cam: CameraDef) => {
    const fovXRad = deg2rad(cam.fov);
    const fl_x = cam.resolution.width / (2 * Math.tan(fovXRad / 2));
    const fl_y = fl_x; // 像素是正方形
    const cx = cam.resolution.width / 2;
    const cy = cam.resolution.height / 2;
    return {
      fl_x,
      fl_y,
      cx,
      cy,
      w: cam.resolution.width,
      h: cam.resolution.height,
      near: cam.near,
      far: cam.far,
    };
  };

  const allEntities = [
    ...scene.cameras,
    ...scene.lights,
    ...scene.subjects,
    ...(scene.groups ?? []),
  ];

  const buildFrame = (cam: CameraDef): TransformsFrameData => {
    // WDD -gemini 2026-06-19 导出时必须获取相机的世界变换矩阵，而非可能具有父子的局部变换矩阵
    const transform = getWorldTransform(cam, allEntities);
    const M = composeMatrix(
      transform.position,
      transform.rotation,
      transform.scale ?? [1, 1, 1]
    );

    // 列主序 16 维转为行主序 4x4 二维数组
    // 依 NeRF 规范，OpenGL 坐标系，相机看向 -Z
    const camera_to_world = [
      [M[0], M[4], M[8], M[12]],
      [M[1], M[5], M[9], M[13]],
      [M[2], M[6], M[10], M[14]],
      [M[3], M[7], M[11], M[15]],
    ];

    const frameData: TransformsFrameData = {
      file_path: `images/${cam.name}.png`,
      camera_to_world,
      // 自定义保存属性，以便导入时 100% 无损还原
      id: cam.id,
      name: cam.name,
      exposure: cam.exposure,
      enabled: cam.enabled,
    };

    if (cam.time !== undefined) {
      frameData.time = cam.time;
    }

    if (!allIdentical) {
      Object.assign(frameData, buildIntrinsics(cam));
    }

    return frameData;
  };

  const output: TransformsJsonData = {
    camera_model: 'PERSPECTIVE',
    frames: [],
  };

  if (allIdentical) {
    Object.assign(output, buildIntrinsics(first));
  }

  output.frames = activeCams.map(buildFrame);

  return JSON.stringify(output, null, 2);
}

/**
 * 从 transforms.json 数据中恢复 CameraDef 列表。
 * 主要用于自校验 round-trip 与数据恢复。
 */
export function importFromTransformsJson(jsonStr: string): CameraDef[] {
  const parsed = JSON.parse(jsonStr);
  if (!validateTransformsJson(parsed)) {
    throw new Error('Invalid transforms.json format');
  }

  const data = parsed as unknown as TransformsJsonData;

  const globalFov =
    data.fl_x !== undefined && data.w !== undefined
      ? rad2deg(2 * Math.atan(data.w / (2 * data.fl_x)))
      : undefined;

  return data.frames.map((frame: TransformsFrameData, index: number): CameraDef => {
    const c2w = frame.camera_to_world;

    // 提取 position
    const position: [number, number, number] = [c2w[0][3], c2w[1][3], c2w[2][3]];

    // 提取 scale
    const sx = Math.sqrt(c2w[0][0] ** 2 + c2w[1][0] ** 2 + c2w[2][0] ** 2);
    const sy = Math.sqrt(c2w[0][1] ** 2 + c2w[1][1] ** 2 + c2w[2][1] ** 2);
    const sz = Math.sqrt(c2w[0][2] ** 2 + c2w[1][2] ** 2 + c2w[2][2] ** 2);
    const scale: [number, number, number] = [sx, sy, sz];

    // 提取 rotation (度) - XYZ 欧拉角顺序
    const r02_n = c2w[0][2] / sz;
    const r00_n = c2w[0][0] / sx;
    const r01_n = c2w[0][1] / sy;
    const r10_n = c2w[1][0] / sx;
    const r11_n = c2w[1][1] / sy;
    const r12_n = c2w[1][2] / sz;
    const r22_n = c2w[2][2] / sz;

    const sy_val = Math.max(-1, Math.min(1, r02_n));
    const ry_rad = Math.asin(sy_val);
    let rx_rad: number;
    let rz_rad: number;

    if (Math.abs(sy_val) < 0.999999) {
      rx_rad = Math.atan2(-r12_n, r22_n);
      rz_rad = Math.atan2(-r01_n, r00_n);
    } else {
      // 万向锁：ry = 90 或 -90 度
      rx_rad = 0;
      rz_rad = Math.atan2(r10_n, r11_n);
    }

    const rotation: [number, number, number] = [
      rad2deg(rx_rad),
      rad2deg(ry_rad),
      rad2deg(rz_rad),
    ];

    // 提取内参
    const fl_x = frame.fl_x ?? data.fl_x;
    const w = frame.w ?? data.w;
    const h = frame.h ?? data.h;
    
    // 防御性校验
    if (fl_x === undefined || w === undefined || h === undefined) {
      throw new Error('Missing intrinsic parameters');
    }

    const fov = globalFov ?? rad2deg(2 * Math.atan(w / (2 * fl_x)));
    const aspect = w / h;
    const near = frame.near ?? data.near ?? 0.1;
    const far = frame.far ?? data.far ?? 1000;

    // 提取元数据与标识符
    const name =
      frame.name ??
      frame.file_path.split('/').pop()?.replace('.png', '') ??
      `Camera_${index}`;
    const id = frame.id ?? `cam_${index}`;
    const exposure: Exposure = frame.exposure ?? {
      iso: 100,
      shutter: 0.008,
      aperture: 2.8,
    };
    const enabled = frame.enabled ?? true;

    const camera: CameraDef = {
      id,
      kind: 'camera',
      name,
      transform: { position, rotation, scale },
      model: 'PINHOLE',
      fov,
      aspect,
      near,
      far,
      resolution: { width: w, height: h },
      exposure,
      enabled,
    };

    if (frame.time !== undefined) {
      camera.time = frame.time;
    } else if (data.time !== undefined) {
      camera.time = data.time;
    }

    return camera;
  });
}
