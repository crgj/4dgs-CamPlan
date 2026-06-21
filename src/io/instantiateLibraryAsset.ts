/**
 * T-059 把库资产实例化进场景（src/io/instantiateLibraryAsset.ts）。
 *
 * 纯逻辑：不直接操作 store（避免循环依赖），而是返回“待创建”描述，
 * 由调用方（dropTarget / 面板）用 store.addCamera/addLight/addSubject/addGroup/reparent 落地。
 *
 * 设计：组合资产实例化 = 建一个新 group（落点为 origin）→ 每个子项按 local transform
 * 建实体并 reparent 到该 group（keepWorld=false，直接采用 local 作为局部）。
 * 所有 id 用 uid(prefix, usedIds) 重新生成，避免与场景已有 id 冲突。
 */
import type { CameraDef, LightDef, SubjectDef, Transform, Vec3 } from '@/types';
import type { CompositeChild, CompositePayload, LibraryAsset } from '@/lib/libraryAsset';
import { uid } from '@/lib/id';

/** 实例化产物：新建的组合 id + 全部子实体 id（供调用方选中/聚焦）。 */
export interface InstantiateResult {
  groupId: string;
  entityIds: string[];
}

/** 给每个子项分配无冲突 id（与场景已有 id 比对）。 */
export function allocateIds(
  children: CompositeChild[],
  used: ReadonlySet<string>,
): { groupId: string; childIds: string[] } {
  const groupId = uid('group', used);
  // 用过的 id 集合扩入 group id，保证子 id 也唯一
  const taken = new Set(used);
  taken.add(groupId);
  const childIds = children.map((c) => {
    const prefix = c.kind === 'camera' ? 'cam' : c.kind === 'light' ? 'light' : 'subj';
    const id = uid(prefix, taken);
    taken.add(id);
    return id;
  });
  return { groupId, childIds };
}

/**
 * 把组合资产在 dropPoint 处实例化为一组 create 指令。
 * 返回每个子项的 {kind, id, def（含最终 transform 与 parentId）}。
 * 调用方据此调用 store 的 addX 并 reparent。
 */
export function planCompositeInstantiation(
  payload: CompositePayload,
  dropPoint: Vec3,
  used: ReadonlySet<string>,
): {
  groupId: string;
  groupTransform: Transform;
  items: Array<
    | { kind: 'camera'; id: string; def: Partial<CameraDef> & { parentId: string } }
    | { kind: 'light'; id: string; def: Partial<LightDef> & { parentId: string }; lightKind: LightDef['lightKind'] }
    | { kind: 'subject'; id: string; def: Partial<SubjectDef> & { parentId: string } }
  >;
} {
  const { groupId, childIds } = allocateIds(payload.children, used);
  const groupTransform: Transform = {
    position: [dropPoint[0], dropPoint[1], dropPoint[2]],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  };

  const items = payload.children.map((child, i): InstantiateItem => {
    const id = childIds[i];
    const local = child.local ?? (child.def.transform ?? { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] });
    if (child.kind === 'light') {
      return {
        kind: 'light',
        id,
        lightKind: child.lightKind ?? 'point',
        def: { ...child.def, transform: local, parentId: groupId } as Partial<LightDef> & { parentId: string },
      };
    }
    if (child.kind === 'camera') {
      return {
        kind: 'camera',
        id,
        def: { ...child.def, transform: local, parentId: groupId } as Partial<CameraDef> & { parentId: string },
      };
    }
    return {
      kind: 'subject',
      id,
      def: { ...child.def, transform: local, parentId: groupId } as Partial<SubjectDef> & { parentId: string },
    };
  });

  return { groupId, groupTransform, items };
}

type InstantiateItem =
  | { kind: 'camera'; id: string; def: Partial<CameraDef> & { parentId: string } }
  | { kind: 'light'; id: string; def: Partial<LightDef> & { parentId: string }; lightKind: LightDef['lightKind'] }
  | { kind: 'subject'; id: string; def: Partial<SubjectDef> & { parentId: string } };

/** 判断资产是否为组合（UI 用，决定拖放走组合实例化路径）。 */
export function isCompositeAsset(asset: LibraryAsset): boolean {
  return asset.kind === 'composite' && asset.payload.type === 'composite';
}
