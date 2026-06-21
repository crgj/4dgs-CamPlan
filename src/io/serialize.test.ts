// T-020 场景序列化测试：round-trip、版本校验、结构校验。
import { describe, it, expect } from 'vitest';
import type { CameraDef, LightDef, SceneDef, SubjectDef } from '@/types';
import { SCHEMA_VERSION, defaultEnv, defaultSubject } from '@/lib/defaults';
import {
  serializeScene,
  deserializeScene,
  validateScene,
  type PlannerFile,
} from './serialize';

// 复用默认工厂构造带 bounds 的主体（直接手写 bounds 易写错）。
const makeSubject = (overrides?: Partial<SubjectDef>): SubjectDef =>
  defaultSubject(new Set(['unused']), overrides);

const makeCamera = (id: string): CameraDef => ({
  id,
  kind: 'camera',
  name: id,
  transform: { position: [1, 2, 3], rotation: [10, 20, 30], scale: [1, 1, 1] },
  model: 'PINHOLE',
  fov: 55,
  aspect: 16 / 9,
  near: 0.1,
  far: 1000,
  resolution: { width: 1920, height: 1080 },
  exposure: { iso: 200, shutter: 1 / 250, aperture: 4 },
  enabled: true,
});

const makeLight = (): LightDef => ({
  id: 'light_1',
  kind: 'light',
  name: 'Key',
  transform: { position: [5, 5, 5], rotation: [0, 0, 0], scale: [1, 1, 1] },
  lightKind: 'directional',
  color: 0xffffff,
  intensity: 3,
  enabled: true,
});

const makeScene = (): SceneDef => ({
  version: SCHEMA_VERSION,
  cameras: [makeCamera('cam_1'), makeCamera('cam_2')],
  lights: [makeLight()],
  subjects: [makeSubject({ id: 'subj_1', name: 'Cube' })],
  env: defaultEnv(),
});

describe('serialize / round-trip', () => {
  it('serialize→deserialize 无损还原整场景（含相机/灯光/主体/环境）', () => {
    const original = makeScene();
    const json = serializeScene(original);
    const restored = deserializeScene(json);

    // 实体数量
    expect(restored.cameras).toHaveLength(2);
    expect(restored.lights).toHaveLength(1);
    expect(restored.subjects).toHaveLength(1);

    // 相机字段逐项比对（浮点精确，因 JSON 不引入误差）
    const c0 = restored.cameras[0];
    expect(c0.id).toBe('cam_1');
    expect(c0.fov).toBe(55);
    expect(c0.exposure).toEqual({ iso: 200, shutter: 1 / 250, aperture: 4 });
    expect(c0.transform.position).toEqual([1, 2, 3]);
    expect(c0.transform.rotation).toEqual([10, 20, 30]);

    // 灯光
    expect(restored.lights[0].lightKind).toBe('directional');
    expect(restored.lights[0].intensity).toBe(3);

    // 主体（bounds 也要还原）
    expect(restored.subjects[0].geometry).toEqual({ type: 'box', size: [1, 1, 1] });
    expect(restored.subjects[0].bounds).toEqual(original.subjects[0].bounds);

    // 环境
    expect(restored.env.ground.enabled).toBe(true);
    expect(restored.env.ambientIntensity).toBe(0.4);

    // 版本被规范化为当前 SCHEMA_VERSION
    expect(restored.version).toBe(SCHEMA_VERSION);
  });

  it('序列化产物带 kind/version/savedAt/scene 包裹层', () => {
    const json = serializeScene(makeScene());
    const file = JSON.parse(json) as PlannerFile;
    expect(file.kind).toBe('planner');
    expect(file.version).toBe(SCHEMA_VERSION);
    expect(typeof file.savedAt).toBe('string');
    expect(file.scene.cameras).toHaveLength(2);
  });

  it('4DGS time 字段在 round-trip 中保留', () => {
    const scene = makeScene();
    scene.cameras[0].time = 12.5;
    const restored = deserializeScene(serializeScene(scene));
    expect(restored.cameras[0].time).toBe(12.5);
  });

  it('空场景（仅 env）可 round-trip', () => {
    const empty: SceneDef = {
      version: SCHEMA_VERSION,
      cameras: [],
      lights: [],
      subjects: [],
      env: defaultEnv(),
    };
    const restored = deserializeScene(serializeScene(empty));
    expect(restored.cameras).toEqual([]);
    expect(restored.env.ground.enabled).toBe(true);
  });
});

describe('serialize / 错误输入', () => {
  it('非法 JSON 抛出明确错误', () => {
    expect(() => deserializeScene('{不是合法json')).toThrow(/JSON/);
  });
  it('缺 kind/scene 标识抛错', () => {
    expect(() => deserializeScene(JSON.stringify({ foo: 1 }))).toThrow(/kind|scene|有效/i);
  });
  it('version 缺失抛错', () => {
    const bad = JSON.stringify({ kind: 'planner', scene: { cameras: [] } });
    expect(() => deserializeScene(bad)).toThrow(/version/);
  });
  it('文件版本高于当前支持时抛错（migrate 版本判断）', () => {
    // 外层 file.version=999 走到 migrate 的版本上限判断
    const futureFile = JSON.stringify({
      kind: 'planner',
      version: 999,
      savedAt: 'x',
      scene: { version: 1, cameras: [], lights: [], subjects: [], env: defaultEnv() },
    });
    expect(() => deserializeScene(futureFile)).toThrow(/升级|版本/);
  });
});

describe('serialize / validateScene', () => {
  it('合法场景返回空错误列表', () => {
    expect(validateScene(makeScene())).toEqual([]);
  });
  it('cameras 非数组报错', () => {
    const bad = { ...makeScene(), cameras: 'nope' } as unknown;
    const errs = validateScene(bad);
    expect(errs.some((e) => e.includes('cameras'))).toBe(true);
  });
  it('缺 env 报错', () => {
    const bad = { ...makeScene(), env: undefined } as unknown;
    expect(validateScene(bad).some((e) => e.includes('env'))).toBe(true);
  });
  it('相机字段不完整报错', () => {
    const scene = makeScene();
    // 故意删掉 fov
    (scene.cameras[0] as Partial<CameraDef>).fov = undefined;
    const errs = validateScene(scene);
    expect(errs.some((e) => e.includes('cameras[0]'))).toBe(true);
  });
});
