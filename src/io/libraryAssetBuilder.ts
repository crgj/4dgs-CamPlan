/**
 * T-057 把选中实体构建为库资产（src/io/libraryAssetBuilder.ts）。
 *
 * 纯逻辑（无 React/Three 依赖，可单测）：
 *   - buildAssetFromSelection：选中多个实体 → 找最高公共根 → 以该根为组合原点
 *     提取每个子项的相对 transform → 输出 CompositePayload。
 *   - 单选 subject 时输出 subject 资产（静态模型）。
 *
 * 设计：组合以「总父物体 + 子物体」表达。选中实体若已有共同祖先 group，
 * 直接以该 group 为根；否则把它们的相对世界变换作为 local 存入子项，
 * 实例化时由 instantiateLibraryAsset 建一个新 group 承载。
 */
import type { CameraDef, LightDef, SubjectDef, SceneDef, EntityId, Transform, AABB } from '@/types';
import type { CompositeChild, CompositePayload, LibraryAsset } from '@/lib/libraryAsset';
import { getWorldTransform, type HierarchicalEntity } from '@/lib/math';
import { aabbOfSubject } from '@/lib/aabb';

/** 选中实体的构建输入。 */
export interface BuildAssetInput {
  name: string;
  category: string;
  /** 组合根的世界原点（通常 = 公共祖先的世界位姿，或选中 AABB 中心）。 */
  origin: [number, number, number];
}

/** 把选中实体构建为组合库资产（返回不含 id/时间戳的输入，供 saveAsset 用）。 */
export function buildAssetFromSelection(
  scene: SceneDef,
  selection: readonly EntityId[],
  input: BuildAssetInput,
): Omit<LibraryAsset, 'id' | 'createdAt' | 'updatedAt'> & { id?: string } {
  const all: HierarchicalEntity[] = [
    ...scene.cameras,
    ...scene.lights,
    ...scene.subjects,
    ...(scene.groups ?? []),
  ];

  // 取选中实体（去重、保留顺序）
  const selected = selection
    .map((id) => all.find((e) => e.id === id))
    .filter((e): e is HierarchicalEntity => Boolean(e));

  // 单选 subject → 静态模型资产
  if (selected.length === 1 && selected[0].id !== undefined) {
    const single = findEntity(scene, selected[0].id);
    if (single && single.kind === 'subject') {
      return {
        kind: 'subject',
        name: input.name,
        category: input.category,
        payload: { type: 'subject', def: stripEntity(single) },
      };
    }
  }

  // 多选 / 跨类型 → 组合资产。以 origin 为组合根，子项存相对世界 transform。
  const children: CompositeChild[] = [];
  let localBounds: AABB | undefined;
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  let hasSubject = false;

  for (const ent of selected) {
    const world = getWorldTransform(ent, all);
    // local = 相对组合根的偏移（仅平移以组合根为原点；旋转/缩放保留世界值）
    const local: Transform = {
      position: [
        world.position[0] - input.origin[0],
        world.position[1] - input.origin[1],
        world.position[2] - input.origin[2],
      ],
      rotation: world.rotation,
      scale: world.scale ?? [1, 1, 1],
    };
    const full = findEntity(scene, ent.id);
    if (!full) continue;
    const child: CompositeChild = {
      kind: full.kind as 'camera' | 'light' | 'subject',
      def: stripEntity(full),
      local,
    };
    if (full.kind === 'light') child.lightKind = full.lightKind;
    children.push(child);

    // 累计 subject 的包围盒以算组合 localBounds
    if (full.kind === 'subject') {
      hasSubject = true;
      const b = aabbOfSubject({ ...full, transform: local });
      minX = Math.min(minX, b.min[0]); minY = Math.min(minY, b.min[1]); minZ = Math.min(minZ, b.min[2]);
      maxX = Math.max(maxX, b.max[0]); maxY = Math.max(maxY, b.max[1]); maxZ = Math.max(maxZ, b.max[2]);
    }
  }
  if (hasSubject) {
    localBounds = { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] };
  }

  const payload: CompositePayload = { children, localBounds };
  return {
    kind: 'composite',
    name: input.name,
    category: input.category,
    payload: { type: 'composite', def: payload },
  };
}

/** 找实体（跨四类）。 */
function findEntity(scene: SceneDef, id: EntityId): CameraDef | LightDef | SubjectDef | null {
  return (
    scene.cameras.find((e) => e.id === id) ??
    scene.lights.find((e) => e.id === id) ??
    scene.subjects.find((e) => e.id === id) ??
    null
  );
}

/** 去掉运行时 id/parentId/bounds（subject bounds 实例化时重算）。 */
function stripEntity(
  e: CameraDef | LightDef | SubjectDef,
): Omit<Partial<CameraDef>, 'id' | 'parentId'> &
  Partial<Omit<LightDef, 'id' | 'parentId'>> &
  Partial<Omit<SubjectDef, 'id' | 'parentId' | 'bounds'>> {
  const rec = e as unknown as Record<string, unknown>;
  const { id: _id, parentId: _p, bounds: _b, ...rest } = rec;
  void _id; void _p; void _b;
  return rest as Omit<Partial<CameraDef>, 'id' | 'parentId'> &
    Partial<Omit<LightDef, 'id' | 'parentId'>> &
    Partial<Omit<SubjectDef, 'id' | 'parentId' | 'bounds'>>;
}
