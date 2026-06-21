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
// #WDD-gpt  2026-06-21 - 默认场景模型路径跟随 Vite base，避免 GitHub Pages 子路径部署时 USDZ 资源 404
const publicUrl = (path: string): string =>
  `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;

/**
 * 构造环形相机阵列（N 台等角分布、俯角约 22.6°、半径 6m，看向中心主体）。
 *
 * #WDD-gpt 2026-06-21 - 默认场景改为空场景（无 box），并插入库中第一个人物模型（泰拳女拳手 Boxer）到原点。
 */
export function buildExampleScene(camCount = 8): SceneDef {
  const radius = 6;
  const height = 3.5;
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

  const human: SubjectDef = {
    id: 'subj_human_1',
    kind: 'subject',
    name: '泰拳女拳手 Boxer',
    transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    geometry: {
      type: 'mesh',
      src: publicUrl('/library/models/Human/Boxer/Female_Muay_Thai_Boxer.usdz'),
      bbox: [0.5, 1.7, 0.3],
      animate: true,
    },
    bounds: { min: [-0.25, 0, -0.15], max: [0.25, 1.7, 0.15] },
    sampleDensity: 50,
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

  human.bounds = aabbOfSubject(human);

  return {
    version: SCHEMA_VERSION,
    cameras,
    lights: [sun, fill],
    subjects: [human],
    env: defaultEnv(),
  };
}

/** 示例场景内部 uid（防冲突）。 */
export function exampleSceneUid(): string {
  return uid('entity');
}
