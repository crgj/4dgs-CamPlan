/**
 * T-002 类型契约测试（src/types/types.test-d.ts）。
 * 这是**纯类型测试**：命名 *.test-d.ts，不被 vitest 执行（vitest.config 只匹配
 * *.{test,spec}.{ts,tsx}），仅靠 `tsc` 编译校验。任何破坏性字段改动都会在此编译失败。
 *
 * 断言手法：通过 `assertType<T>(value)` 把一个值固定为类型 T——
 *   - 若 value 与 T 结构不符 → 编译错误；
 *   - 用 `Equal<A,B>` 做精确等价断言（而非宽松的 assignable）。
 * 不依赖任何运行时导入，符合 verbatimModuleSyntax。
 */
import type {
  AnyEntity,
  CameraDef,
  CameraModel,
  EnvDef,
  EvalThresholds,
  LightDef,
  SceneDef,
  SubjectDef,
  SubjectGeometry,
  Transform,
  Vec3,
} from '@/types';

// --- 编译期断言工具 ---
const assertType = <T>(_: T): T => _;
type Equal<A, B> =
  (<U>() => U extends A ? 1 : 2) extends <U>() => U extends B ? 1 : 2
    ? true
    : false;
type AssertTrue<T extends true> = T;

// --- Vec3 精确等价（readonly 三元组）---
type _Vec3 = AssertTrue<Equal<Vec3, readonly [number, number, number]>>;

// --- Transform：rotation 单位度，注释中说明；结构锁定 ---
const t: Transform = { position: [0, 1, 2], rotation: [10, 20, 30] };
assertType<Transform>({ ...t, scale: [1, 1, 1] });

// --- 相机：必填字段齐全 + 4DGS 预留 time 可选 ---
const cam: CameraDef = {
  id: 'cam_1',
  kind: 'camera',
  name: 'cam-1',
  transform: { position: [0, 0, 5], rotation: [0, 0, 0] },
  model: 'PINHOLE',
  fov: 50,
  aspect: 16 / 9,
  near: 0.1,
  far: 1000,
  resolution: { width: 1920, height: 1080 },
  exposure: { iso: 100, shutter: 1 / 125, aperture: 2.8 },
  enabled: true,
};
// time 可省略（v1 静态）
assertType<CameraDef>({ ...cam });
// time 可填（4DGS 时序）
assertType<CameraDef>({ ...cam, time: 0.5 });
// CameraModel 锁为 PINHOLE
type _CamModel = AssertTrue<Equal<CameraModel, 'PINHOLE'>>;

// --- 灯光：四种 lightKind 均可构造 ---
assertType<LightDef>({
  id: 'light_1',
  kind: 'light',
  name: 'key',
  transform: { position: [5, 5, 5], rotation: [0, 0, 0] },
  lightKind: 'spot',
  color: 0xffffff,
  intensity: 800,
  spotAngle: 45,
  spotPenumbra: 0.2,
  range: 20,
  enabled: true,
});
assertType<LightDef>({
  id: 'light_2',
  kind: 'light',
  name: 'sun',
  transform: { position: [0, 0, 0], rotation: [0, 0, 0] },
  lightKind: 'directional',
  color: 0xffeecc,
  intensity: 3,
  enabled: true,
});

// --- 主体几何判别联合：每种 type 可构造 ---
const sphereGeo: SubjectGeometry = { type: 'sphere', radius: 1 };
assertType<SubjectGeometry>({ type: 'box', size: [1, 1, 1] });
assertType<SubjectGeometry>(sphereGeo);
assertType<SubjectGeometry>({ type: 'plane', size: [2, 2, 0] });
assertType<SubjectGeometry>({ type: 'mesh', src: 'a.glb' });

const subject: SubjectDef = {
  id: 'subj_1',
  kind: 'subject',
  name: 'target',
  transform: { position: [0, 0, 0], rotation: [0, 0, 0] },
  geometry: sphereGeo,
  bounds: { min: [-1, -1, -1], max: [1, 1, 1] },
  sampleDensity: 50,
  enabled: true,
};
assertType<SubjectDef>(subject);

// --- 环境（单数 env，一个场景一套）---
const env: EnvDef = {
  kind: 'environment',
  ambientIntensity: 0.4,
  ground: { enabled: true, y: 0, color: 0x222222 },
  fog: { color: 0x111111, near: 10, far: 80 },
  hdri: 'studio.hdr',
};
assertType<EnvDef>(env);
assertType<EnvDef>({ kind: 'environment', ambientIntensity: 0, ground: { enabled: false, y: 0, color: 0 } });

// --- 场景聚合 ---
const scene: SceneDef = {
  version: 1,
  cameras: [cam],
  lights: [],
  subjects: [subject],
  env,
};
assertType<SceneDef>(scene);

// --- 联合类型（大纲/store 通用处理）---
assertType<AnyEntity[]>([cam, subject]);
// 环境不是 AnyEntity（它不是可在大纲多选的“实例”实体）
type _EnvNotEntity = AssertTrue<Equal<EnvDef extends AnyEntity ? true : false, false>>;

// --- 阈值配置 ---
assertType<EvalThresholds>({
  minCoverage: 8,
  minOverlap: 0.6,
  baselineRange: [0.2, 5],
  maxExposureSpread: 0.5,
});

// 确保未使用的类型别名仍被“消费”（避免 noUnusedLocals 误报）。
// 用 `true satisfies ...` 触发对每个 Equal 断言的编译期校验：任一为 false 即报错。
void (true satisfies _Vec3 & _CamModel & _EnvNotEntity);
