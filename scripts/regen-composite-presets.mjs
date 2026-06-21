#!/usr/bin/env node
// 重新生成组合（摄像机组）预设（scripts/regen-composite-presets.mjs）。
//
// #WDD-gpt 2026-06-20 - 修正组合摄像机组「朝向中心」的旋转：此前用 ry=180+azimuthDeg 偏 90°，
// 相机实际朝外不朝中心；半球阵列还缺必要的负 pitch 俯视。本脚本用与 math.ts:lookAtRotation
// 等价的「相机 -Z 指向 target」旋转矩阵反解（XYZ 欧拉角），重算每个相机 rotation。
//
// 只更新 position/rotation 不变（保持阵列几何不变），_builtinVersion 1→2 触发 IndexedDB 重同步。
// 用法：node scripts/regen-composite-presets.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const PRESETS_DIR = resolve(process.cwd(), 'public/library/presets');

// —— 与 src/lib/math.ts:lookAtRotation 等价的纯函数（避免 ESM 导入 TS）——
const rad2deg = (r) => (r * 180) / Math.PI;

function lookAtRotation(from, target) {
  let fx = target[0] - from[0];
  let fy = target[1] - from[1];
  let fz = target[2] - from[2];
  const fl = Math.hypot(fx, fy, fz);
  if (fl > 1e-9) {
    fx /= fl;
    fy /= fl;
    fz /= fl;
  } else {
    fx = 0;
    fy = 0;
    fz = -1;
  }
  let ux = 0;
  const uy = 1;
  let uz = 0;
  let rx = fy * uz - fz * uy;
  let ry = fz * ux - fx * uz;
  let rz = fx * uy - fy * ux;
  let rl = Math.hypot(rx, ry, rz);
  if (rl < 1e-9) {
    ux = 0;
    uz = 1;
    rx = fy * uz - fz * uy;
    ry = fz * ux - fx * uz;
    rz = fx * uy - fy * ux;
    rl = Math.hypot(rx, ry, rz);
  }
  if (rl > 1e-9) {
    rx /= rl;
    ry /= rl;
    rz /= rl;
  }
  const upx = ry * fz - rz * fy;
  const upy = rz * fx - rx * fz;
  const upz = rx * fy - ry * fx;
  const m = [rx, ry, rz, 0, upx, upy, upz, 0, -fx, -fy, -fz, 0, 0, 0, 0, 1];
  const m11 = m[0];
  const m12 = m[4];
  const m13 = m[8];
  const m23 = m[9];
  const m33 = m[10];
  const x = Math.atan2(-m23, m33);
  const clamped = Math.max(-1, Math.min(1, m13));
  const y = Math.asin(clamped);
  const z = Math.atan2(-m12, m11);
  return [rad2deg(x), rad2deg(y), rad2deg(z)];
}

// 规范化角度到 [-180,180)，便于显示一致性（非必需，仅美化）
const wrap = (d) => {
  let r = d % 360;
  if (r < -180) r += 360;
  if (r >= 180) r -= 360;
  return Math.round(r * 1e6) / 1e6;
};

/** 保留 N 位小数（避免浮点尾巴）。 */
const q = (n) => Math.round(n * 1e6) / 1e6;
const q3 = (arr) => arr.map(q);

const files = readdirSync(PRESETS_DIR).filter(
  (f) => f.startsWith('preset-composite-cam-') && f.endsWith('.json'),
);

let total = 0;
for (const file of files) {
  const path = join(PRESETS_DIR, file);
  const preset = JSON.parse(readFileSync(path, 'utf8'));
  const children = preset.payload?.def?.children ?? [];

  // 摄像机组默认看向世界原点上方 1m（与示例场景一致，主体大致在原点）
  const target = [0, 1, 0];

  for (const child of children) {
    if (child.kind !== 'camera') continue;
    const pos = child.local.position;
    const rot = lookAtRotation(pos, target);
    const clean = [wrap(rot[0]), wrap(rot[1]), wrap(rot[2])];
    // local 与 def.transform 同步更新
    child.local.rotation = q3(clean);
    if (child.def?.transform) child.def.transform.rotation = q3(clean);
    total += 1;
  }

  // 版本号 +1 触发 IndexedDB 重同步
  const prevVer = preset._builtinVersion ?? 1;
  preset._builtinVersion = prevVer + 1;
  preset.updatedAt = new Date().toISOString();

  writeFileSync(path, JSON.stringify(preset, null, 2) + '\n', 'utf8');
  console.log(`✓ ${file}  ${children.length} cam  v${prevVer}→${preset._builtinVersion}`);
}
console.log(`✓ 共更新 ${files.length} 个组合预设，${total} 台相机朝向已修正`);
