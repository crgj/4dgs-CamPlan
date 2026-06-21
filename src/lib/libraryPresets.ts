/**
 * 内置预设库（src/lib/libraryPresets.ts）。
 *
 * 预设描述文件以 JSON 形式保存在 public/library/：
 *   - public/library/index.json        清单（列出所有预设文件 + 元信息）
 *   - public/library/presets/<id>.json 单个预设描述（LibraryAsset 结构）
 *   - public/library/models/<...>      可引用的 OBJ/纹理等模型资源
 *
 * LibraryBrowser 首次加载（IndexedDB 为空）时调用 seedLibraryIfEmpty：
 *   1. fetch /library/index.json
 *   2. 逐个 fetch 清单里的预设 JSON
 *   3. 校验后 saveAsset 写入 IndexedDB
 * 幂等：固定 id，库非空时直接返回 0，不覆盖用户资产。
 *
 * 这样模型描述与代码解耦：新增预设只需丢一个 JSON 到 public/library/presets/
 * 并登记进 index.json，无需改 TS。OBJ 等大模型资源放 public/library/models/，
 * 预设 JSON 用 geometry.src 引用（如 Juliette 人物）。
 */
import type { LibraryAsset } from './libraryAsset';
import type { SubjectDef } from '@/types';
import { listAssets, saveAsset } from './libraryAsset';
import { publicUrl } from './publicUrl';

const normalizePublicAssetUrls = (asset: LibraryAsset): LibraryAsset => {
  const patchSubjectDef = (subject: Partial<SubjectDef>) => {
    const geometry = subject.geometry;
    if (geometry?.type !== 'mesh') return;
    const src = geometry.src;
    if (src?.startsWith('/library/')) geometry.src = publicUrl(src);
  };

  if (asset.payload.type === 'subject') {
    patchSubjectDef(asset.payload.def);
  } else if (asset.payload.type === 'composite') {
    asset.payload.def.children.forEach((child) => {
      if (child.kind === 'subject') patchSubjectDef(child.def);
    });
  }
  return asset;
};

const INDEX_URL = publicUrl('/library/index.json');

/** index.json 清单结构。 */
interface PresetIndex {
  presets: string[];
}

/**
 * 从 public/library/index.json + 各预设 JSON 加载全部内置预设。
 * 失败的预设被跳过（不阻断整体 seed），返回成功加载的列表。
 */
export async function loadBuiltinPresets(): Promise<LibraryAsset[]> {
  const idxRes = await fetch(INDEX_URL);
  if (!idxRes.ok) {
    throw new Error(`Failed to load library index: ${idxRes.status}`);
  }
  const index = (await idxRes.json()) as PresetIndex;

  const results: LibraryAsset[] = [];
  await Promise.all(
    index.presets.map(async (rel) => {
      try {
        // rel 形如 "presets/preset-car.json"，拼成绝对 public 路径
        const url = rel.startsWith('/') ? publicUrl(rel) : publicUrl(`/library/${rel}`);
        const res = await fetch(url);
        if (!res.ok) return;
        const asset = normalizePublicAssetUrls((await res.json()) as LibraryAsset);
        // 补齐时间戳（JSON 里可能省略）
        if (!asset.createdAt) asset.createdAt = new Date().toISOString();
        if (!asset.updatedAt) asset.updatedAt = new Date().toISOString();
        results.push(asset);
      } catch {
        // 单个预设加载失败不阻断
      }
    }),
  );
  return results;
}

/**
 * 若 IndexedDB 库为空，则写入全部内置预设（从 public/library JSON 加载）。
 * @returns 新写入的预设数量。
 */
export async function seedLibraryIfEmpty(): Promise<number> {
  const existing = await listAssets();
  if (existing.length === 0) {
    // 空库：写入全部内置预设
    const presets = await loadBuiltinPresets();
    for (const preset of presets) {
      await saveAsset(preset);
    }
    return presets.length;
  }
  // 非空库：仍需补齐/更新内置预设（修复「用过 app 就看不到新预设」的缺陷）。
  // 内置预设用固定 id（preset- 前缀），幂等 upsert：缺则补、旧则更新，不碰用户自建资产。
  return syncBuiltinPresets();
}

/**
 * 把内置预设同步进库：缺则补、版本旧则更新。
 * 只动 preset- 前缀的内置项，用户自建资产（asset_xxx）不受影响。
 *
 * 用 _builtinVersion 比对（而非 updatedAt）：saveAsset 每次写 updatedAt=now，
 * 用时间戳会误判「总是过期」。内置 JSON 里 _builtinVersion 递增表示内容变更。
 * @returns 实际新增/更新的数量。
 */
export async function syncBuiltinPresets(): Promise<number> {
  const [existing, builtin] = await Promise.all([listAssets(), loadBuiltinPresets()]);
  const byId = new Map(existing.map((a) => [a.id, a]));
  let changed = 0;
  for (const preset of builtin) {
    const cur = byId.get(preset.id);
    const curVer = (cur as { _builtinVersion?: number } | undefined)?._builtinVersion;
    const newVer = (preset as { _builtinVersion?: number })._builtinVersion ?? 0;
    // 缺失，或内置版本号变了 → 写入
    if (!cur || curVer !== newVer) {
      await saveAsset(preset);
      changed += 1;
    }
  }
  return changed;
}
