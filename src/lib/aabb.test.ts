import { describe, it, expect } from 'vitest';
import type { SubjectDef, Transform } from '@/types';
import {
  aabbCenter,
  aabbOfSubject,
  aabbSize,
  localHalfExtents,
  pointInAABB,
  transformAABB,
  unionAABB,
} from './aabb';

describe('aabb / localHalfExtents', () => {
  it('box: size 折半', () => {
    expect(localHalfExtents({ type: 'box', size: [2, 4, 6] })).toEqual([1, 2, 3]);
  });
  it('sphere: 各轴 = radius', () => {
    expect(localHalfExtents({ type: 'sphere', radius: 3 })).toEqual([3, 3, 3]);
  });
  it('mesh: 无 bbox 时占位 0.5', () => {
    expect(localHalfExtents({ type: 'mesh', src: 'a.glb' })).toEqual([0.5, 0.5, 0.5]);
  });
  it('mesh: 有 bbox 时折半', () => {
    expect(localHalfExtents({ type: 'mesh', src: 'a.obj', bbox: [2, 4, 6] })).toEqual([1, 2, 3]);
  });
});

describe('aabb / mesh bbox × scale', () => {
  it('Juliette: cm 级 bbox 乘 scale 0.01 得米级世界 AABB', () => {
    // 模拟 preset-actor-juliette：bbox=[68,160,55]cm, scale=0.01, position 在脚底 y=0
    const subj: SubjectDef = {
      id: 'test',
      kind: 'subject',
      name: 'juliette',
      transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [0.01, 0.01, 0.01] },
      geometry: { type: 'mesh', src: '/x.obj', bbox: [68, 160, 55] },
      sampleDensity: 50,
      enabled: true,
      bounds: { min: [0, 0, 0], max: [0, 0, 0] },
    };
    const aabb = aabbOfSubject(subj);
    // 世界尺寸 = bbox × scale = [0.68, 1.6, 0.55]m，居中于原点
    const size = aabbSize(aabb);
    expect(size[0]).toBeCloseTo(0.68, 2);
    expect(size[1]).toBeCloseTo(1.6, 1);
    expect(size[2]).toBeCloseTo(0.55, 2);
  });
});

describe('aabb / transformAABB', () => {
  it('无旋转：半尺寸盒在原点 → AABB = [-h, +h]', () => {
    const t: Transform = { position: [0, 0, 0], rotation: [0, 0, 0] };
    const a = transformAABB(t, [1, 2, 3]);
    expect(a.min).toEqual([-1, -2, -3]);
    expect(a.max).toEqual([1, 2, 3]);
  });
  it('平移整体偏移', () => {
    const t: Transform = { position: [10, 0, 0], rotation: [0, 0, 0] };
    const a = transformAABB(t, [1, 1, 1]);
    expect(a.min).toEqual([9, -1, -1]);
    expect(a.max).toEqual([11, 1, 1]);
  });
  it('缩放并入尺寸', () => {
    const t: Transform = { position: [0, 0, 0], rotation: [0, 0, 0], scale: [2, 1, 1] };
    const a = transformAABB(t, [1, 1, 1]);
    expect(a.min).toEqual([-2, -1, -1]);
    expect(a.max).toEqual([2, 1, 1]);
  });
});

describe('aabb / 工具', () => {
  it('aabbSize / aabbCenter', () => {
    const a = { min: [-1, -2, -3], max: [1, 2, 3] } as const;
    expect(aabbSize(a)).toEqual([2, 4, 6]);
    expect(aabbCenter(a)).toEqual([0, 0, 0]);
  });
  it('pointInAABB', () => {
    const a = { min: [0, 0, 0], max: [2, 2, 2] } as const;
    expect(pointInAABB([1, 1, 1], a)).toBe(true);
    expect(pointInAABB([0, 0, 0], a)).toBe(true); // 含边界
    expect(pointInAABB([3, 1, 1], a)).toBe(false);
  });
  it('unionAABB', () => {
    const u = unionAABB({ min: [0, 0, 0], max: [1, 1, 1] }, { min: [2, 2, 2], max: [3, 3, 3] });
    expect(u.min).toEqual([0, 0, 0]);
    expect(u.max).toEqual([3, 3, 3]);
  });
  it('aabbOfSubject 对默认立方体', () => {
    const s: SubjectDef = {
      id: 'subj_1',
      kind: 'subject',
      name: 's',
      transform: { position: [0, 0.5, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      geometry: { type: 'box', size: [1, 1, 1] },
      sampleDensity: 10,
      enabled: true,
      bounds: { min: [0, 0, 0], max: [0, 0, 0] },
    };
    const a = aabbOfSubject(s);
    expect(a.min).toEqual([-0.5, 0, -0.5]);
    expect(a.max).toEqual([0.5, 1, 0.5]);
  });
});
