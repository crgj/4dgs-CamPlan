/**
 * 拖放落点处理（src/io/dropTarget.ts）。
 * 工具栏原型拖到视口 → 解析 dataTransfer → store.addXxx。
 * 库资产（composite/subject）拖到视口 → 实例化（建 group + reparent 子项）。
 */
import type { DragEvent } from 'react';
import type { LightDef, Vec3 } from '@/types';
import { usePlanner } from '@/state/store';
import { getAsset } from '@/lib/libraryAsset';
import { planCompositeInstantiation, isCompositeAsset } from '@/io/instantiateLibraryAsset';
import { lookAtRotation } from '@/lib/math';
import { aabbCenter, emptyAABB, unionAABB } from '@/lib/aabb';

type Prototype =
  | { kind: 'camera' }
  | { kind: 'light'; lightKind: LightDef['lightKind'] }
  | { kind: 'subject' };

const MIME = 'application/x-planner-prototype';
const ASSET_MIME = 'application/x-planner-asset';
let lastViewportGroundHit: { point: Vec3; at: number } | null = null;
const DROP_HIT_TTL_MS = 250;

function hasPlannerPayload(e: React.DragEvent): boolean {
  const types = Array.from(e.dataTransfer.types);
  return types.includes(MIME) || types.includes(ASSET_MIME);
}

// #WDD-gpt  2026-06-20 - 记录鼠标射线与地面平面的交点，拖放落点不依赖场景物体 raycast
export function setViewportDropPoint(point: Vec3): void {
  lastViewportGroundHit = { point, at: performance.now() };
}

export function clearViewportDropPoint(): void {
  lastViewportGroundHit = null;
}

function consumeDropPointOrOrigin(): Vec3 {
  const hit = lastViewportGroundHit;
  lastViewportGroundHit = null;
  // #WDD-gpt  2026-06-20 - 拖入对象时只接受当前鼠标附近的地面命中；无命中则创建在世界原点
  if (!hit || performance.now() - hit.at > DROP_HIT_TTL_MS) return [0, 0, 0];
  return hit.point;
}

function transformAtDropPoint(drop: Vec3) {
  const [x, y, z] = drop;
  return { position: [x, y, z] as Vec3, rotation: [0, 0, 0] as Vec3, scale: [1, 1, 1] as Vec3 };
}

/**
 * 计算场景中所有主体的联合 AABB 中心；无主体时回落到世界原点上方 1m。
 * 用于让拖入的相机朝向「中心对象」。
 *
 * #WDD-gpt 2026-06-20 - 需求：创建的摄像机都应指向中心对象。
 */
function sceneFocusTarget(s: ReturnType<typeof usePlanner.getState>): Vec3 {
  const subjects = s.scene.subjects;
  if (subjects.length === 0) return [0, 1, 0];
  const box = subjects.reduce(
    (acc, subj) => unionAABB(acc, subj.bounds ?? emptyAABB()),
    emptyAABB(),
  );
  if (!isFinite(box.min[0]) || box.min[0] === Infinity) return [0, 1, 0];
  return aabbCenter(box);
}

/** 视口 onDrop 处理：解析原型或库资产并创建实体。 */
export function handleViewportDrop(e: React.DragEvent) {
  if (!hasPlannerPayload(e)) return;
  e.preventDefault();
  e.stopPropagation();
  const s = usePlanner.getState();
  const drop = consumeDropPointOrOrigin();

  // —— 库资产拖放（异步取 IndexedDB）——
  const assetId = e.dataTransfer.getData(ASSET_MIME);
  if (assetId) {
    void instantiateAsset(assetId, s, drop);
    return;
  }

  // —— Place Actors 原型拖放 ——
  const raw = e.dataTransfer.getData(MIME);
  if (!raw) return;
  let proto: Prototype;
  try {
    proto = JSON.parse(raw) as Prototype;
  } catch {
    return;
  }
  const transform = transformAtDropPoint(drop);
  if (proto.kind === 'camera') {
    // 相机朝向场景中心对象（无主体则朝原点），而非默认 -Z。
    const target = sceneFocusTarget(s);
    const rotation = lookAtRotation(drop, target);
    s.addCamera({ transform: { ...transform, rotation } });
  } else if (proto.kind === 'light') s.addLight(proto.lightKind, { transform });
  else s.addSubject({ transform });
}

/** 实例化库资产：composite 建 group + 子项；subject 直接 addSubject。 */
async function instantiateAsset(assetId: string, s: ReturnType<typeof usePlanner.getState>, drop: Vec3) {
  const asset = await getAsset(assetId);
  if (!asset) {
    s.log('error', 'Library asset not found');
    return;
  }
  if (isCompositeAsset(asset)) {
    const payload = asset.payload;
    if (payload.type !== 'composite') return;
    const plan = planCompositeInstantiation(payload.def, drop, new Set());
    // 建 group 承载
    const group = s.addGroup({ transform: plan.groupTransform });
    // 建子项并 reparent（keepWorld=false 直接采用 local 作为局部）
    const ids: string[] = [];
    for (const item of plan.items) {
      if (item.kind === 'camera') {
        const c = s.addCamera({ ...item.def, parentId: group.id });
        ids.push(c.id);
      } else if (item.kind === 'light') {
        const l = s.addLight(item.lightKind, { ...item.def, parentId: group.id });
        ids.push(l.id);
      } else {
        const m = s.addSubject({ ...item.def, parentId: group.id });
        ids.push(m.id);
      }
    }
    s.log('info', `Instantiated composite "${asset.name}" (${ids.length} entities)`);
    s.selectMany([group.id]);
  } else if (asset.kind === 'subject' && asset.payload.type === 'subject') {
    const baseTransform = asset.payload.def.transform ?? { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] };
    s.addSubject({
      ...asset.payload.def,
      // #WDD-gpt  2026-06-20 - 保留库模型自带 rotation/scale，把对象原点落到当前拖拽焦点
      transform: {
        ...baseTransform,
        position: [drop[0], drop[1], drop[2]],
      },
    });
    s.log('info', `Instantiated model "${asset.name}"`);
  }
}

/** 视口 onDragOver：允许 copy（否则浏览器不让 drop）。 */
export function allowDrop(e: React.DragEvent) {
  // #WDD-gpt  2026-06-19 - 只拦截 Planner 拖放，避免阻断 Dockview tab 向下/向侧边 dock
  if (!hasPlannerPayload(e)) return;
  e.preventDefault();
  e.stopPropagation();
  e.dataTransfer.dropEffect = 'copy';
}

export type { DragEvent };
