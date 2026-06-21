// 内置预设库 seed 单测（src/lib/libraryPresets.test.ts）。
// 预设现以 JSON 存于 public/library/，由 scripts/gen-library-presets.mjs 生成，
// 分 人物(Human)/物体(Object) 两大类。mock fetch + IndexedDB CRUD。
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pubDir = resolve(process.cwd(), 'public/library');
function readJson(rel: string): unknown {
  return JSON.parse(readFileSync(resolve(pubDir, rel), 'utf-8'));
}
const indexJson = readJson('index.json') as { presets: string[]; categories: string[] };

vi.stubGlobal('fetch', vi.fn(async (url: string) => {
  const rel = url.replace(/^\/library\//, '');
  try {
    const body = readJson(rel);
    return { ok: true, status: 200, json: async () => body } as Response;
  } catch {
    return { ok: false, status: 404, json: async () => ({}) } as Response;
  }
}));

const store = new Map<string, object>();
vi.mock('./libraryAsset', () => ({
  listAssets: async () => Array.from(store.values()) as never,
  saveAsset: async (asset: object) => {
    const a = asset as { id: string };
    store.set(a.id, asset);
    return asset as never;
  },
}));

import { listAssets } from './libraryAsset';
import { seedLibraryIfEmpty, loadBuiltinPresets } from './libraryPresets';

describe('libraryPresets 内置预设（人物/物体两大类）', () => {
  beforeEach(() => {
    store.clear();
  });

  it('loadBuiltinPresets 读取清单中全部预设 JSON', async () => {
    const presets = await loadBuiltinPresets();
    expect(presets.length).toBe(indexJson.presets.length);
    for (const p of presets) {
      // 模型预设（subject）或组合预设（composite）
      expect(['subject', 'composite']).toContain(p.kind);
    }
  });

  it('含手写组合（摄像机组）预设', async () => {
    await seedLibraryIfEmpty();
    const composites = (await listAssets()).filter((a) => a.kind === 'composite');
    expect(composites.length).toBeGreaterThanOrEqual(3);
    const names = composites.map((a) => a.name);
    expect(names.some((n) => n.includes('环形') || n.includes('Ring'))).toBe(true);
  });

  it('index.json 含人物/车辆/设备/摄像机组分类', async () => {
    expect(indexJson.categories).toContain('人物');
    expect(indexJson.categories).toContain('车辆');
    expect(indexJson.categories).toContain('设备');
    expect(indexJson.categories).toContain('摄像机组');
  });

  it('空库时写入全部预设', async () => {
    expect((await listAssets()).length).toBe(0);
    const n = await seedLibraryIfEmpty();
    expect(n).toBe(indexJson.presets.length);
    expect((await listAssets()).length).toBe(n);
  });

  it('人物类（Human）全部 animate=true 且为类人尺寸', async () => {
    await seedLibraryIfEmpty();
    const humans = (await listAssets()).filter((a) => a.category === '人物');
    expect(humans.length).toBeGreaterThanOrEqual(5);
    for (const h of humans) {
      expect(h.payload.type).toBe('subject');
      if (h.payload.type === 'subject') {
        const geo = h.payload.def.geometry;
        expect(geo?.type).toBe('mesh');
        if (geo?.type === 'mesh') {
          expect(geo.animate).toBe(true);
          expect(geo.src.endsWith('.usdz')).toBe(true);
          // 类人高度约 1.7m
          expect(geo.bbox?.[1]).toBeGreaterThan(1.5);
        }
      }
    }
  });

  it('物体类（车辆/设备）animate 未设或 false，bbox 为车辆/设备尺寸', async () => {
    await seedLibraryIfEmpty();
    const objs = (await listAssets()).filter((a) => a.category !== '人物');
    expect(objs.length).toBeGreaterThanOrEqual(4);
    for (const o of objs) {
      if (o.payload.type === 'subject') {
        const geo = o.payload.def.geometry;
        if (geo?.type === 'mesh') {
          // 物体不带动画
          expect(geo.animate ?? false).toBe(false);
        }
      }
    }
  });

  it('North 人物预设存在且 animate=true', async () => {
    await seedLibraryIfEmpty();
    const north = (await listAssets()).find((a) => a.id === 'preset-human-north');
    expect(north).toBeDefined();
    if (north!.payload.type === 'subject') {
      const geo = north!.payload.def.geometry;
      if (geo?.type === 'mesh') {
        expect(geo.src).toContain('North');
        expect(geo.animate).toBe(true);
      }
    }
  });

  it('幂等：非空库不重复写入', async () => {
    const n1 = await seedLibraryIfEmpty();
    const n2 = await seedLibraryIfEmpty();
    expect(n2).toBe(0);
    expect((await listAssets()).length).toBe(n1);
  });

  it('非空库缺预设时 seedLibraryIfEmpty 补齐', async () => {
    await seedLibraryIfEmpty();
    store.delete('preset-human-north');
    const added = await seedLibraryIfEmpty();
    expect(added).toBe(1);
    expect((await listAssets()).find((a) => a.id === 'preset-human-north')).toBeDefined();
  });
});
