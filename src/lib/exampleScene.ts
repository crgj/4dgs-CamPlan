/**
 * T-022 内置示例场景（src/lib/exampleScene.ts）。
 * 一个经典的 4DGS 环形相机阵列：8 台相机环绕主体（雕塑箱体），
 * 顶部一盏方向光（太阳）+ 半球补光。用于首次启动演示与端到端冒烟。
 */
import type { CameraDef, LightDef, SceneDef, SubjectDef, Vec3 } from '@/types';
import { SCHEMA_VERSION, defaultEnv } from './defaults';
import { aabbOfSubject } from './aabb';
import { lookAtRotation } from './math';
import { uid } from './id';

const TAU = Math.PI * 2;

/**
 * 构造环形相机阵列（N 台等角分布、俯角约 22.6°、半径 6m，看向中心主体）。
 *
 * #WDD-gpt 2026-06-20 - 相机朝向改用 lookAtRotation（基于旋转矩阵反解 XYZ 欧拉角），
 * 此前手写 [pitch, -angleDeg+180, 0] 偏 90°，相机实际朝外不朝中心。
 */
export function buildExampleScene(camCount = 8): SceneDef {
  const radius = 6;
  const height = 3.5;
  // 雕塑中心（Hero Sculpture bounds 中心），相机看向它而非几何原点
  const target: Vec3 = [0, 1, 0];

  const cameras: CameraDef[] = [];
  for (let i = 0; i < camCount; i++) {
    const angle = (i / camCount) * TAU;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const position: Vec3 = [x, height, z];
    cameras.push({
      id: `cam_${i + 1}`,
      kind: 'camera',
      name: `Camera_${i + 1}`,
      transform: {
        position,
        rotation: lookAtRotation(position, target),
        scale: [1, 1, 1],
      },
      model: 'PINHOLE',
      fov: 55,
      aspect: 16 / 9,
      near: 0.1,
      far: 100,
      resolution: { width: 1920, height: 1080 },
      exposure: { iso: 200, shutter: 1 / 250, aperture: 4 },
      enabled: true,
    });
  }

  const sculpture: SubjectDef = {
    id: 'subj_hero',
    kind: 'subject',
    name: 'Hero Sculpture',
    transform: { position: [0, 1, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    geometry: { type: 'box', size: [2, 2, 2] },
    bounds: { min: [-1, 0, -1], max: [1, 2, 1] },
    sampleDensity: 10,
    enabled: true,
  };

  const pedestal: SubjectDef = {
    id: 'subj_pedestal',
    kind: 'subject',
    name: 'Pedestal',
    transform: { position: [0, -0.5, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    geometry: { type: 'box', size: [1.5, 1, 1.5] },
    bounds: { min: [-0.75, -1, -0.75], max: [0.75, 0, 0.75] },
    sampleDensity: 10,
    enabled: true,
  };

  const sun: LightDef = {
    id: 'light_sun',
    kind: 'light',
    name: 'Sun',
    transform: { position: [8, 12, 6], rotation: [45, -30, 0], scale: [1, 1, 1] },
    lightKind: 'directional',
    color: 0xffffff,
    intensity: 3,
    enabled: true,
  };

  // 补光用 point（半球补光的近似）
  const fill: LightDef = {
    id: 'light_fill',
    kind: 'light',
    name: 'Fill',
    transform: { position: [-5, 4, -5], rotation: [0, 0, 0], scale: [1, 1, 1] },
    lightKind: 'point',
    color: 0x4488ff,
    intensity: 50,
    enabled: true,
  };

  // 校验 bounds（确保 aabb 与 transform 一致）
  sculpture.bounds = aabbOfSubject(sculpture);
  pedestal.bounds = aabbOfSubject(pedestal);

  return {
    version: SCHEMA_VERSION,
    cameras,
    lights: [sun, fill],
    subjects: [sculpture, pedestal],
    env: defaultEnv(),
  };
}

/** 示例场景内部 uid（防冲突）。 */
export function exampleSceneUid(): string {
  return uid('entity');
}
