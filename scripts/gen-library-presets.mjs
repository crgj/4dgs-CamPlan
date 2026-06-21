#!/usr/bin/env node
// 库预设生成脚本（scripts/gen-library-presets.mjs）。
//
// 扫描 public/library/models/Human 与 public/library/models/Object 下各子目录的 .usdz，
// 为每个模型生成一个 preset JSON，重新生成 public/library/index.json。废弃旧预设
// （基元模型 + 摄像机组），库重建为 Human（人物）/Object（物体）两大类。
//
// 用法：node scripts/gen-library-presets.mjs   或   npm run gen-library
//
// 约定（已勘察确认）：
//   - 所有 9 个 USDZ 均为 metersPerUnit=0.01（厘米制）、Y-up。
//   - USDLoader 已按 metersPerUnit 内部缩放 group.scale，故预设 scale=1（再乘 0.01 会双重缩放）。
//   - bbox 按米声明（用于覆盖度/采样 AABB），人物 ~1.7m，车辆 ~4.5m，设备按型。
//   - Human 类 animate=true（人物 USD 通常带骨骼动画），Object 类 false。
import { readdirSync, statSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';

const ROOT = resolve(process.cwd(), 'public/library');
const MODELS_DIR = join(ROOT, 'models');
const PRESETS_DIR = join(ROOT, 'presets');
const NOW = '2026-06-20T00:00:00.000Z';
const VERSION = 1;

/** 目录名 → 友好显示名。 */
const DIR_DISPLAY = {
  Boxer: '泰拳女拳手 Boxer',
  Brooke: 'Brooke',
  Lucie: 'Lucie 吸血鬼女郎',
  North: 'North (Detroit)',
  Runner: 'Runner 跑步者',
  jeep: 'Jeep 越野车',
  Jeep2007: '2007 Jeep Wrangler Rubicon',
  'Aston Martin': 'Aston Martin DB11',
  CNC_Meachine: 'CNC 机床',
};

/** Object 子目录 → 细分 category。 */
const OBJECT_CATEGORY = {
  jeep: '车辆',
  Jeep2007: '车辆',
  'Aston Martin': '车辆',
  CNC_Meachine: '设备',
};

/** Object category → 默认 bbox（米）。 */
const OBJECT_BBOX = {
  车辆: [4.5, 1.5, 1.9],
  设备: [2.0, 1.5, 1.5],
};

const HUMAN_BBOX = [0.5, 1.7, 0.3];

/** 列出某目录下第一个 .usdz 文件。 */
function findUsdz(dir) {
  const entries = readdirSync(dir);
  const usdz = entries.find((f) => f.toLowerCase().endsWith('.usdz'));
  return usdz ?? null;
}

/** 递归列 models/{cat} 下所有子目录。 */
function listSubDirs(catDir) {
  return readdirSync(catDir)
    .map((name) => join(catDir, name))
    .filter((p) => statSync(p).isDirectory());
}

/** 生成单个 preset 对象。 */
function buildPreset(cat, dirName, fileName) {
  const isHuman = cat === 'Human';
  const display = DIR_DISPLAY[dirName] ?? dirName;
  const category = isHuman ? '人物' : OBJECT_CATEGORY[dirName] ?? '物体';
  const bbox = isHuman ? HUMAN_BBOX : OBJECT_BBOX[category] ?? [1.0, 1.0, 1.0];
  const id = `preset-${isHuman ? 'human' : 'object'}-${dirName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  // public URL 路径（保留空格，浏览器会编码）
  const src = `/library/models/${cat}/${dirName}/${fileName}`;
  return {
    id,
    kind: 'subject',
    name: display,
    category,
    _builtinVersion: VERSION,
    createdAt: NOW,
    updatedAt: NOW,
    payload: {
      type: 'subject',
      def: {
        name: display,
        geometry: { type: 'mesh', src, bbox, animate: isHuman },
        sampleDensity: 50,
        enabled: true,
        // scale=1：USDLoader 已按 metersPerUnit(0.01) 内部缩放 group.scale，
        // 这里若再 ×0.01 会双重缩放（0.01×0.01）导致模型极小。bbox 按米声明。
        transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
      },
    },
  };
}

// —— 主流程 ——
const allCats = ['Human', 'Object'];
const presets = [];
for (const cat of allCats) {
  const catDir = join(MODELS_DIR, cat);
  if (!existsSync(catDir)) {
    console.warn(`[skip] 目录不存在: ${catDir}`);
    continue;
  }
  for (const sub of listSubDirs(catDir)) {
    const dirName = basename(sub);
    const usdz = findUsdz(sub);
    if (!usdz) {
      console.warn(`[skip] 无 USDZ: ${sub}`);
      continue;
    }
    presets.push(buildPreset(cat, dirName, usdz));
  }
}

// 清理：只删本脚本管理的 Human/Object 预设（preset-human-*/preset-object-*）。
// 手写的组合预设（preset-composite-*，如摄像机组）不在 models 目录扫描范围，
// 由人维护，脚本不得删除——避免重跑脚本丢失组合类。
if (existsSync(PRESETS_DIR)) {
  for (const f of readdirSync(PRESETS_DIR).filter((f) => f.endsWith('.json'))) {
    if (f.startsWith('preset-human-') || f.startsWith('preset-object-')) {
      unlinkSync(join(PRESETS_DIR, f));
    }
  }
}

// 收集已存在的手写组合预设（preset-composite-*），并入清单
const compositeFiles = existsSync(PRESETS_DIR)
  ? readdirSync(PRESETS_DIR)
      .filter((f) => f.startsWith('preset-composite-') && f.endsWith('.json'))
      .map((f) => `presets/${f}`)
  : [];

// 写入新 Human/Object 预设
const presetFiles = [];
for (const p of presets) {
  const rel = `presets/${p.id}.json`;
  writeFileSync(join(ROOT, rel), JSON.stringify(p, null, 2) + '\n', 'utf8');
  presetFiles.push(rel);
}

// 三大类：人物 / 物体(车辆、设备) / 组合(摄像机组)。组合类为手写 preset-composite-*。
const allPresetFiles = [...presetFiles, ...compositeFiles];
const categories = ['人物', '车辆', '设备', '摄像机组'];
const indexJson = {
  $schema: './schema.json',
  name: 'Planner 内置模型库',
  description: '随应用分发。人物/物体由 gen-library-presets.mjs 扫描 public/library/models 生成；组合(摄像机组等)为手写 preset-composite-*，脚本不覆盖。三大类：人物 / 物体 / 组合。',
  version: VERSION,
  categories,
  presets: allPresetFiles,
};
writeFileSync(join(ROOT, 'index.json'), JSON.stringify(indexJson, null, 2) + '\n', 'utf8');

console.log(`✓ 生成 ${presets.length} 个模型预设 + ${compositeFiles.length} 个手写组合预设：`);
for (const p of presets) {
  console.log(`  ${p.id}  [${p.category}]  ${p.name}  → ${p.payload.def.geometry.src}`);
}
for (const c of compositeFiles) console.log(`  ${c}  [组合]  (手写)`);
console.log(`✓ 更新 index.json（${categories.length} 分类）`);
