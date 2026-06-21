/**
 * 实体默认参数与评估阈值（src/lib/defaults.ts）。
 * 拖放创建实体时由 store.addEntity 调用，生成带默认参数的实体。
 * 默认值参考 .agents/skills/4dgs-capture 的经验法则。
 */
import type {
  CameraDef,
  EnvDef,
  EvalThresholds,
  GroupDef,
  LightDef,
  SceneDef,
  SubjectDef,
  Transform,
} from '@/types';
import { aabbOfSubject } from './aabb';
import { uid } from './id';

export const SCHEMA_VERSION = 1;

/** 默认变换：原点、无旋转、单位缩放。 */
export const defaultTransform = (): Transform => ({
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
});

/** 计数器：让默认名递增（每个 store 会话从 1 开始）。 */
let camSeq = 0;
let lightSeq = 0;
let subjSeq = 0;
let groupSeq = 0;
export const resetDefaultCounters = (): void => {
  camSeq = 0;
  lightSeq = 0;
  subjSeq = 0;
  groupSeq = 0;
};

/** 默认相机：50° 水平 FOV、1920×1080、标准曝光、看向 -Z（位于 +Z 处即看向原点）。 */
export const defaultCamera = (
  existing?: ReadonlySet<string>,
  overrides?: Partial<CameraDef>,
): CameraDef => {
  camSeq += 1;
  const base: CameraDef = {
    id: uid('cam', existing),
    kind: 'camera',
    name: `Camera ${camSeq}`,
    transform: { position: [0, 1.5, 5], rotation: [0, 0, 0], scale: [1, 1, 1] },
    model: 'PINHOLE',
    fov: 50,
    aspect: 16 / 9,
    near: 0.1,
    far: 1000,
    resolution: { width: 1920, height: 1080 },
    exposure: { iso: 100, shutter: 1 / 125, aperture: 2.8 },
    enabled: true,
  };
  return { ...base, ...overrides };
};

/** 默认灯光：按 lightKind 给合理初值。 */
export const defaultLight = (
  lightKind: LightDef['lightKind'],
  existing?: ReadonlySet<string>,
  overrides?: Partial<LightDef>,
): LightDef => {
  lightSeq += 1;
  const base: LightDef = {
    id: uid('light', existing),
    kind: 'light',
    name: `Light ${lightSeq}`,
    transform: { position: [5, 5, 5], rotation: [0, 0, 0], scale: [1, 1, 1] },
    lightKind,
    color: 0xffffff,
    intensity: lightKind === 'directional' ? 3 : 800,
    enabled: true,
  };
  if (lightKind === 'spot') {
    base.spotAngle = 45;
    base.spotPenumbra = 0.2;
    base.range = 20;
  } else if (lightKind === 'point') {
    base.range = 15;
  }
  return { ...base, ...overrides };
};

/** 默认主体：1×1×1 立方体置于原点。 */
export const defaultSubject = (
  existing?: ReadonlySet<string>,
  overrides?: Partial<SubjectDef>,
): SubjectDef => {
  subjSeq += 1;
  const subject: SubjectDef = {
    id: uid('subj', existing),
    kind: 'subject',
    name: `Subject ${subjSeq}`,
    transform: { position: [0, 0.5, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    geometry: { type: 'box', size: [1, 1, 1] },
    sampleDensity: 50,
    enabled: true,
    bounds: { min: [0, 0, 0], max: [0, 0, 0] }, // 占位，下行重算
  };
  subject.bounds = aabbOfSubject(subject);
  return { ...subject, ...overrides };
};

/** 默认环境：启用地面、低环境补光、无 HDRI。 */
export const defaultEnv = (): EnvDef => ({
  kind: 'environment',
  ambientIntensity: 0.4,
  ground: { enabled: true, y: 0, color: 0x222222 },
});

/** 默认组合/组：原点、启用、单位变换（纯 transform 容器节点）。 */
export const defaultGroup = (
  existing?: ReadonlySet<string>,
  overrides?: Partial<GroupDef>,
): GroupDef => {
  groupSeq += 1;
  const base: GroupDef = {
    id: uid('group', existing),
    kind: 'group',
    name: `Group ${groupSeq}`,
    transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    enabled: true,
  };
  return { ...base, ...overrides };
};

/** 默认空场景（无实体；地面由 env.ground 平面渲染）。 */
export const defaultScene = (): SceneDef => ({
  version: SCHEMA_VERSION,
  cameras: [],
  lights: [],
  subjects: [],
  groups: [],
  env: defaultEnv(),
});

/**
 * 默认评估阈值（参考 4dgs-capture 技能）：
 * - minCoverage 8（每个表面点至少 8 机位覆盖；4DGS 动态区会要求更高）
 * - minOverlap 0.6（相邻相机视场重叠 60%）
 * - baselineRange [0.2, 5]（到主体距离的合理基线区间，按典型小场景）
 * - maxExposureSpread 0.5 EV（阵列曝光一致性）
 */
export const defaultThresholds = (): EvalThresholds => ({
  minCoverage: 8,
  minOverlap: 0.6,
  baselineRange: [0.2, 5],
  maxExposureSpread: 0.5,
});
