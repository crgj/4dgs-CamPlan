// T-022 示例场景测试：结构有效、可被 validateScene 通过、相机环形分布。
import { describe, it, expect } from 'vitest';
import { buildExampleScene } from './exampleScene';
import { validateScene, serializeScene, deserializeScene } from '@/io/serialize';

describe('buildExampleScene', () => {
  it('默认生成 8 台相机 + 2 灯光 + 2 主体', () => {
    const s = buildExampleScene();
    expect(s.cameras).toHaveLength(8);
    expect(s.lights).toHaveLength(2);
    expect(s.subjects).toHaveLength(2);
  });

  it('相机环形分布：等角、半径一致、看向原点附近', () => {
    const s = buildExampleScene(8);
    const radii = s.cameras.map((c) => Math.hypot(c.transform.position[0], c.transform.position[2]));
    // 所有相机水平半径应一致（≈6）
    radii.forEach((r) => expect(r).toBeCloseTo(6, 1));
  });

  it('所有实体 enabled 且有合法 id', () => {
    const s = buildExampleScene();
    for (const c of s.cameras) expect(c.enabled).toBe(true);
    for (const l of s.lights) expect(l.enabled).toBe(true);
    for (const m of s.subjects) expect(m.enabled).toBe(true);
    const ids = [...s.cameras, ...s.lights, ...s.subjects].map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length); // id 唯一
  });

  it('主体 bounds 非空且与几何尺寸匹配', () => {
    const s = buildExampleScene();
    const hero = s.subjects.find((m) => m.id === 'subj_hero')!;
    const sizeY = hero.bounds.max[1] - hero.bounds.min[1];
    expect(sizeY).toBeCloseTo(2, 5);
  });

  it('通过 validateScene 结构校验', () => {
    const s = buildExampleScene();
    expect(validateScene(s)).toEqual([]);
  });

  it('可序列化 round-trip（T-022 端到端依赖）', () => {
    const s = buildExampleScene();
    const restored = deserializeScene(serializeScene(s));
    expect(restored.cameras).toHaveLength(8);
    expect(restored.subjects).toHaveLength(2);
  });
});
