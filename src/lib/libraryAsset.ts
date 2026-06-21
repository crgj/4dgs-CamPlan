/**
 * T-056 资产库 schema + IndexedDB 持久化（src/lib/libraryAsset.ts）。
 * 用户可保存自定义相机/灯光/主体/相机阵列为可复用资产，跨会话复用。
 * IndexedDB 存储，异步 API；无 React 依赖。
 */
import type { CameraDef, LightDef, SubjectDef, Transform, AABB } from '@/types';
import type { ArrayParams } from './cameraArray';

const DB_NAME = 'planner-library';
const DB_VERSION = 1;
const STORE = 'assets';

/** 资产类型。 */
export type AssetKind = 'camera' | 'light' | 'subject' | 'cameraArray' | 'composite';

/** 组合子项：一个实体定义（去掉运行时 id/parentId）+ 相对组合根的局部 transform。 */
export interface CompositeChild {
  /** 实体种类标签（决定实例化时调哪个 addX）。 */
  kind: 'camera' | 'light' | 'subject';
  /** 实体定义（不含 id/parentId；实例化时重新生成 id 并 reparent 到新 group）。 */
  def: Omit<Partial<CameraDef>, 'id' | 'parentId'> &
    Partial<Omit<LightDef, 'id' | 'parentId'>> &
    Partial<Omit<SubjectDef, 'id' | 'parentId' | 'bounds'>>;
  /** light 子项的 lightKind（仅 kind='light' 时有意义）。 */
  lightKind?: LightDef['lightKind'];
  /** 相对组合根的局部 transform；省略时用 def.transform。 */
  local?: Transform;
}

/** 组合载荷：多个子实体 + 组合局部包围盒（用于放置预览/落点偏移）。 */
export interface CompositePayload {
  children: CompositeChild[];
  /** 组合根坐标系下的包围盒（可选，辅助放置）。 */
  localBounds?: AABB;
}

/** 库资产定义。 */
export interface LibraryAsset {
  id: string;
  kind: AssetKind;
  name: string;
  /** 分类标签（用户自定义）。 */
  category: string;
  /** 缩略图 dataURL（可选）。 */
  thumbnail?: string;
  /** 创建时间 ISO。 */
  createdAt: string;
  /** 更新时间 ISO。 */
  updatedAt: string;
  /** 资产载荷：实体定义或阵列参数。 */
  payload:
    | { type: 'camera'; def: Partial<CameraDef> }
    | { type: 'light'; def: Partial<LightDef> }
    | { type: 'subject'; def: Partial<SubjectDef> }
    | { type: 'cameraArray'; params: ArrayParams }
    | { type: 'composite'; def: CompositePayload };
}

let dbPromise: Promise<IDBDatabase> | null = null;

/** 打开/升级数据库。 */
function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('kind', 'kind', { unique: false });
        store.createIndex('category', 'category', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

/** 生成资产 id。 */
function assetId(): string {
  return `asset_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** 列出全部资产（可按 kind 过滤）。 */
export async function listAssets(kind?: AssetKind): Promise<LibraryAsset[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const store = tx.objectStore(STORE);
    const req = store.getAll();
    req.onsuccess = () => {
      const all = req.result as LibraryAsset[];
      resolve(kind ? all.filter((a) => a.kind === kind) : all);
    };
    req.onerror = () => reject(req.error);
  });
}

/** 保存（新增或更新）资产。 */
export async function saveAsset(
  input: Omit<LibraryAsset, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
): Promise<LibraryAsset> {
  const db = await openDb();
  const now = new Date().toISOString();
  const existing = input.id ? await getAsset(input.id) : null;
  const asset: LibraryAsset = {
    id: input.id ?? assetId(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    ...input,
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(asset);
    tx.oncomplete = () => resolve(asset);
    tx.onerror = () => reject(tx.error);
  });
}

/** 按 id 获取单个资产。 */
export async function getAsset(id: string): Promise<LibraryAsset | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve((req.result as LibraryAsset) ?? null);
    req.onerror = () => reject(req.error);
  });
}

/** 删除资产。 */
export async function deleteAsset(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
