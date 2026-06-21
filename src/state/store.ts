/**
 * Zustand 单一 store（src/state/store.ts）。
 *
 * 切片：entities(cameras/lights/subjects) + env + selection + history + view。
 * 所有跨组件业务状态经此；面板与 3D 对象都订阅 store。
 *
 * 不可变更新：用结构化克隆做快照（撤销），用展开运算符做增量更新。
 * 拖拽/gizmo 连续变化：调用方先调 beginTransient（暂停入栈），结束后 commitTransient
 * 入栈一次；或直接对低频改动调带 history 的 set。
 *
 * 角度/单位：store 存“度”与“米”，换算只在 lib/math。
 */
import { create } from 'zustand';
import type {
  AnyEntity,
  CameraDef,
  EnvDef,
  EntityId,
  GroupDef,
  LightDef,
  SceneDef,
  SubjectDef,
  Transform,
  Vec3,
} from '@/types';
import {
  defaultCamera,
  defaultGroup,
  defaultLight,
  defaultScene,
  defaultSubject,
  defaultThresholds,
  SCHEMA_VERSION,
} from '@/lib/defaults';
import { buildExampleScene } from '@/lib/exampleScene';
import type { EvalThresholds } from '@/types';
import { aabbCenter, aabbOfSubject, aabbSize } from '@/lib/aabb';
import { uid } from '@/lib/id';
import { readPrefs, readThresholds, writePrefs, writeThresholds } from '@/io/sceneFiles';
import {
  composeMatrix,
  getWorldTransform,
  invert4,
  multiply4,
  type HierarchicalEntity,
} from '@/lib/math';
import {
  type HistoryState,
  canRedo,
  canUndo,
  emptyHistory,
  record,
  redo,
  undo,
} from './history';

/** 日志条目级别。 */
export type LogLevel = 'info' | 'warn' | 'error';
/** 单条日志。 */
export interface LogEntry {
  id: number;
  level: LogLevel;
  message: string;
  /** UTC ISO 时间戳。 */
  at: string;
}

/** 视口书签（保存的相机位姿快照）。 */
export interface ViewportBookmark {
  position: Vec3;
  target: Vec3;
}

/** 渲染设置切片（T-085/T-086/T-088）。 */
export type RenderSettingsPatch = {
  toneMapping?: 'aces' | 'agx' | 'filmic' | 'linear';
  bloom?: boolean;
  bloomIntensity?: number;
  ssao?: boolean;
  taa?: boolean;
  quality?: 'draft' | 'standard' | 'high' | 'ultra';
  pathTracing?: boolean;
  ptSamples?: number;
  ptBounces?: number;
};

/** Editor Preferences（持久化到 localStorage）。 */
export interface EditorPreferences {
  /** 鼠标灵敏度倍率。 */
  mouseSensitivity: number;
  /** 反转滚轮缩放。 */
  invertZoom: boolean;
  /** 默认视图模式。 */
  defaultProjection: ViewState['projection'];
  /** 高对比主题（占位，v2 接入）。 */
  highContrast: boolean;
  /** 字体缩放比例。 */
  fontScale: number;
  /** 地面网格大格间距（米）。 */
  gridSectionSize: number;
  /** 地面网格主线宽度。 */
  gridSectionThickness: number;
  /** 地面网格辅助线颜色（hex 字符串）。 */
  gridCellColor: string;
  /** 地面网格主线颜色（hex 字符串）。 */
  gridSectionColor: string;
  /** 辅助圆环带半径（米）：地面原点处的参考圆环，标示默认拍摄半径。 */
  guideRingRadius: number;
  /** 辅助圆环带宽度（米）：圆环带的管径/厚度。 */
  guideRingTube: number;
  /** 视锥可视化长度（米）：相机视锥线框绘制的远端距离，独立于相机真实 far 裁剪面。
   *  真实 far 常为 1000（避免裁剪），直接画会得到超长锥体；此值限制视觉长度。 */
  frustumDrawDistance: number;
}

/** 视图状态（不入历史）。 */
export interface ViewState {
  /** gizmo 模式。 */
  transformMode: 'translate' | 'rotate' | 'scale';
  /** 视口投影视图。 */
  projection: 'perspective' | 'top' | 'front' | 'side';
  /** 是否显示覆盖热图 overlay。 */
  showCoverageHeatmap: boolean;
  /** 是否显示所有相机视锥线框。 */
  showFrustums: boolean;
  /** 网格捕捉开关。 */
  snapToGrid: boolean;
  /** 网格捕捉步长（米）。 */
  snapStep: number;
  /** 旋转捕捉步长（度）。 #WDD-gpt 2026-06-21 - 与位置步长区分。 */
  rotationSnapStep: number;
  /** 摄像机飞行移动速度 (m/s)。 */
  cameraSpeed: number;
  /** 视口相机命令。由快捷键/菜单写入，由 UnrealControls 消费。 */
  viewportCommand: ViewportCommand | null;
  /** TransformControls 正在拖动，视口导航应暂停。 */
  isTransforming: boolean;
  /** RMB 视口飞行导航中；此时键盘输入只交给相机控制，不触发编辑快捷键。 */
  isCameraNavigating: boolean;
  /** 辅助线与尺寸标注是否显示（T-075 GuidesOverlay）。 */
  showGuides: boolean;
  /** 是否显示视口右上状态 HUD。 */
  showViewportHud: boolean;
}

export type ViewportCommand =
  | {
      id: number;
      kind: 'focus';
      target: Vec3;
      distance: number;
    }
  | {
      id: number;
      kind: 'reset';
    }
  | {
      id: number;
      kind: 'viewCamera';
      cameraId: EntityId;
    }
  | {
      id: number;
      kind: 'setCameraFromViewport';
      cameraId: EntityId;
    }
  | {
      id: number;
      kind: 'setView';
      position: Vec3;
      target: Vec3;
    };

export interface PlannerState {
  // —— 数据 ——
  scene: SceneDef;
  selection: EntityId[];
  // #WDD-gpt 2026-06-21 - Shift+click 范围选择的锚点：记录上次单击选中的实体 id，
  // 下次 Shift+click 时从锚点到当前 id 之间的实体全部选中（按场景扁平顺序）。
  lastSelectAnchor: EntityId | null;
  // #WDD-gpt 2026-06-21 - 剪贴板：Ctrl+C 复制的选中实体（深拷贝，不持久化）。Ctrl+V 粘贴时生成新 id。
  clipboard: AnyEntity[];
  history: HistoryState;
  view: ViewState;

  // —— 派生只读 ——
  selectedEntity: () => AnyEntity | null;

  // —— 历史 ——
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  /** 把当前 scene 快照入栈（不改变 scene）。用于“开始一段连续编辑”前打点，
   * 配合后续 withHistory=false 的更新，实现“一次拖拽=一个撤销步”。 */
  commitHistory: () => void;

  // —— 实体增删 ——
  addCamera: (overrides?: Partial<CameraDef>) => CameraDef;
  addLight: (kind: LightDef['lightKind'], overrides?: Partial<LightDef>) => LightDef;
  addSubject: (overrides?: Partial<SubjectDef>) => SubjectDef;
  /** 新增组合/组（纯 transform 容器节点）。 */
  addGroup: (overrides?: Partial<GroupDef>) => GroupDef;
  removeEntity: (id: EntityId) => void;
  removeEntities: (ids: readonly EntityId[]) => void;
  duplicateEntity: (id: EntityId) => EntityId | null;
  /**
   * 复制当前选中实体到剪贴板（深拷贝，保留原 id 供粘贴时维持父子关系）。
   * Ctrl+C。#WDD-gpt 2026-06-21
   */
  copySelection: () => void;
  /**
   * 粘贴剪贴板内容：为每个实体生成新 id，位置整体偏移 +1m，维持剪贴板内的父子关系
   * （旧 id→新 id 重映射）；返回新实体的 id 列表。Ctrl+V。
   */
  pasteSelection: () => EntityId[];
  /** T-028：改父级，默认保持世界变换（BUG-007），防成环。 */
  reparent: (id: EntityId, newParentId: EntityId | null, keepWorld?: boolean) => void;
  /**
   * 批量改父级（多选拖拽 / 细节面板多选设置父物体）。
   * 把 ids 中每个实体 reparent 到 newParentId（跳过 newParentId 自身、防成环）。
   * #WDD-gpt 2026-06-21
   */
  reparentMany: (ids: EntityId[], newParentId: EntityId | null, keepWorld?: boolean) => void;

  // —— 选择 ——
  select: (id: EntityId | null, additive?: boolean) => void;
  selectMany: (ids: EntityId[]) => void;
  clearSelection: () => void;
  /** 选中 id 及其全部子代（整组选择）。 */
  selectSubtree: (id: EntityId) => void;
  /**
   * Shift+click 范围选择：从上次单击锚点（lastSelectAnchor）到当前 id 之间的全部实体选中。
   * 没有锚点时退化为单击选中。锚点随后更新为当前 id。
   * #WDD-gpt 2026-06-21
   */
  selectRange: (id: EntityId) => void;

  // —— 更新（带历史）——
  updateCamera: (id: EntityId, patch: Partial<CameraDef>, withHistory?: boolean) => void;
  updateLight: (id: EntityId, patch: Partial<LightDef>, withHistory?: boolean) => void;
  updateSubject: (id: EntityId, patch: Partial<SubjectDef>, withHistory?: boolean) => void;
  /** 更新组合/组（属性 patch）。 */
  updateGroup: (id: EntityId, patch: Partial<GroupDef>, withHistory?: boolean) => void;
  updateTransform: (id: EntityId, t: Transform, withHistory?: boolean) => void;
  updateEnv: (patch: Partial<EnvDef>, withHistory?: boolean) => void;
  renameEntity: (id: EntityId, name: string) => void;

  // —— 场景级 ——
  loadScene: (scene: SceneDef) => void;
  resetScene: () => void;
  /** T-022：加载示例场景。 */
  loadExampleScene: () => void;

  // —— 视图（不入历史）——
  setTransformMode: (m: ViewState['transformMode']) => void;
  setProjection: (p: ViewState['projection']) => void;
  toggleCoverageHeatmap: () => void;
  toggleFrustums: () => void;
  toggleSnap: () => void;
  /** T-075：切换辅助线/尺寸标注显示。 */
  toggleGuides: () => void;
  toggleViewportHud: () => void;
  setSnapStep: (step: number) => void;
  /** #WDD-gpt 2026-06-21 - 旋转捕捉步长（度）设置。 */
  setRotationSnapStep: (step: number) => void;
  /** Preferences 侧用：避免与现有 setSnapStep 命名冲突的别名。 */
  setViewSnapStep: (step: number) => void;
  /** gizmo 坐标系：世界/局部（T-027）。 */
  gizmoSpace: 'world' | 'local';
  setGizmoSpace: (space: 'world' | 'local') => void;
  /** 视图模式（T-025）：lit/wireframe/bounds/coverage/frustums。 */
  viewMode: 'lit' | 'wireframe' | 'bounds';
  setViewMode: (mode: 'lit' | 'wireframe' | 'bounds') => void;
  setCameraSpeed: (speed: number) => void;
  focusSelectedViewport: () => void;
  viewSelectedCameraViewport: () => void;
  setSelectedCameraFromViewport: () => void;
  resetViewportCamera: () => void;
  setIsTransforming: (isTransforming: boolean) => void;
  setIsCameraNavigating: (isCameraNavigating: boolean) => void;

  // —— 语言 (i18n) ——
  locale: 'zh' | 'en';
  setLocale: (locale: 'zh' | 'en') => void;

  // —— Message Log（T-033）——
  logs: LogEntry[];
  showLogs: boolean;
  log: (level: LogLevel, message: string) => void;
  clearLogs: () => void;
  toggleLogs: () => void;

  // —— Editor Preferences（T-032）——
  preferences: EditorPreferences;
  setPreferences: (patch: Partial<EditorPreferences>) => void;

  // —— Camera Bookmarks（T-026）——
  bookmarks: (ViewportBookmark | null)[];
  setBookmark: (slot: number, bookmark: ViewportBookmark | null) => void;

  // —— 评估阈值（T-034 World Settings）——
  thresholds: EvalThresholds;
  setThresholds: (patch: Partial<EvalThresholds>, withHistory?: boolean) => void;

  // —— 场景文件状态（T-035 Save/Load）——
  /** 当前文件名（null=未保存过）。 */
  currentFileName: string | null;
  /** 场景是否有未保存修改。 */
  dirty: boolean;
  setCurrentFileName: (name: string | null) => void;
  markDirty: () => void;
  markClean: () => void;

  // —— 模态/覆盖层（T-032/T-034 Preferences/WorldSettings）——
  /** 当前打开的覆盖面板（null=无）。 */
  activeOverlay: 'preferences' | 'worldSettings' | 'shortcuts' | null;
  setActiveOverlay: (overlay: 'preferences' | 'worldSettings' | 'shortcuts' | null) => void;

  // —— 组合隔离编辑（GroupDef）——
  /** 正在隔离编辑的组合 id；null=主场景模式。不入历史栈。 */
  editingGroupId: EntityId | null;
  /** 进入某组合的隔离编辑：视口/大纲只显示该组合子树。 */
  enterGroupEdit: (id: EntityId) => void;
  /** 退出组合隔离编辑，回到主场景。 */
  exitGroupEdit: () => void;

  // —— 渲染设置（T-085/T-086/T-088 P7 高质量渲染）——
  renderSettings: {
    toneMapping: 'aces' | 'agx' | 'filmic' | 'linear';
    bloom: boolean;
    bloomIntensity: number;
    ssao: boolean;
    taa: boolean;
    quality: 'draft' | 'standard' | 'high' | 'ultra';
    pathTracing: boolean;
    ptSamples: number;
    ptBounces: number;
  };
  setRenderSettings: (patch: Partial<RenderSettingsPatch>) => void;

  // —— 布局 (Layout) ——
  layout: {
    outliner: { show: boolean; dock: 'left' | 'right' | 'float'; width: number; height: number; x: number; y: number; collapsed: boolean };
    inspector: { show: boolean; dock: 'left' | 'right' | 'float'; width: number; height: number; x: number; y: number; collapsed: boolean };
    statsBar: { show: boolean; dock: 'bottom' | 'float'; height: number; collapsed: boolean };
  };
  togglePanel: (panel: 'outliner' | 'inspector' | 'statsBar') => void;
  setPanelDock: (panel: 'outliner' | 'inspector', dock: 'left' | 'right' | 'float') => void;
  updatePanelSize: (panel: 'outliner' | 'inspector', width: number, height: number) => void;
  updatePanelPos: (panel: 'outliner' | 'inspector', x: number, y: number) => void;
  togglePanelCollapse: (panel: 'outliner' | 'inspector' | 'statsBar') => void;
  resetLayout: () => void;
}

/** 找实体（跨四类）。 */
function findEntity(scene: SceneDef, id: EntityId): AnyEntity | null {
  return (
    scene.cameras.find((e) => e.id === id) ??
    scene.lights.find((e) => e.id === id) ??
    scene.subjects.find((e) => e.id === id) ??
    (scene.groups ?? []).find((e) => e.id === id) ??
    null
  );
}

/** 已用 id 集合（防 uid 冲突）。 */
function usedIds(scene: SceneDef): Set<string> {
  const s = new Set<string>();
  for (const c of scene.cameras) s.add(c.id);
  for (const l of scene.lights) s.add(l.id);
  for (const m of scene.subjects) s.add(m.id);
  for (const g of scene.groups ?? []) s.add(g.id);
  return s;
}

/** T-028：判断 candidateId 是否是 ancestorId 的后代（向上查 parentId 链）。防成环。 */
function isDescendant(scene: SceneDef, candidateId: EntityId, ancestorId: EntityId): boolean {
  const all = [...scene.cameras, ...scene.lights, ...scene.subjects, ...(scene.groups ?? [])];
  const byId = new Map(all.map((e) => [e.id, e]));
  let curr = byId.get(candidateId);
  const visited = new Set<string>();
  while (curr && curr.parentId && !visited.has(curr.id)) {
    visited.add(curr.id);
    if (curr.parentId === ancestorId) return true;
    curr = byId.get(curr.parentId);
  }
  return false;
}

/** 收集 id 及其所有传递子代（按 parentId 向下遍历）。用于整组选择/删除。 */
function collectSubtreeIds(scene: SceneDef, id: EntityId): EntityId[] {
  const all = [...scene.cameras, ...scene.lights, ...scene.subjects, ...(scene.groups ?? [])];
  const childrenOf = new Map<EntityId, EntityId[]>();
  for (const e of all) {
    if (e.parentId) {
      const arr = childrenOf.get(e.parentId) ?? [];
      arr.push(e.id);
      childrenOf.set(e.parentId, arr);
    }
  }
  const result: EntityId[] = [];
  const stack: EntityId[] = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    result.push(cur);
    const kids = childrenOf.get(cur);
    if (kids) for (const k of kids) stack.push(k);
  }
  return result;
}

/**
 * 按 Outline 面板的**显示顺序**扁平化所有实体 id（深度优先：根→子→孙）。
 *
 * #WDD-gpt 2026-06-21 - Shift+click 范围选择必须按显示顺序，而非场景数组的扁平顺序
 * （cameras→lights→subjects→groups）。后者会导致「cam7 作为父物体后，选 cam1~cam8 仍错误
 * 选中 cam7」——因为数组顺序与树形显示顺序不一致。这里复刻 Outline 的渲染序：
 *   - 根实体（无 parentId 或 parentId 不存在）按场景数组顺序
 *   - 每个实体之后紧跟其子代（递归，子代按各自在数组中的顺序）
 */
function flattenTreeDisplayOrder(scene: SceneDef): EntityId[] {
  const all = [...scene.cameras, ...scene.lights, ...scene.subjects, ...(scene.groups ?? [])];
  const byId = new Map(all.map((e) => [e.id, e]));
  // childrenOf[id] = 该 id 的直接子代（保持各类型数组内顺序）
  const childrenOf = new Map<EntityId, EntityId[]>();
  for (const e of all) {
    if (e.parentId) {
      const arr = childrenOf.get(e.parentId) ?? [];
      arr.push(e.id);
      childrenOf.set(e.parentId, arr);
    }
  }
  const order: EntityId[] = [];
  const visit = (id: EntityId) => {
    order.push(id);
    const kids = childrenOf.get(id);
    if (kids) for (const k of kids) visit(k);
  };
  // 根实体：无 parentId 或 parentId 不指向任何现存实体。按场景数组顺序遍历。
  for (const e of all) {
    if (!e.parentId || !byId.has(e.parentId)) visit(e.id);
  }
  return order;
}

/** T-028：从列主序 4×4 矩阵分解出 TRS（平移/欧拉角/缩放）。用于 keep-world reparent。 */
function decomposeTRS(m: number[], fallbackScale: Vec3): Transform {
  const position: Vec3 = [m[12], m[13], m[14]];
  const sx = Math.hypot(m[0], m[1], m[2]);
  const sy = Math.hypot(m[4], m[5], m[6]);
  const sz = Math.hypot(m[8], m[9], m[10]);
  const scale = [sx || fallbackScale[0], sy || fallbackScale[1], sz || fallbackScale[2]] as Vec3;
  // 提取旋转（XYZ 欧拉角，度）
  const r02_n = sz ? m[8] / sz : 0;
  const r00_n = sx ? m[0] / sx : 1;
  const r01_n = sy ? m[4] / sy : 0;
  const r10_n = sx ? m[1] / sx : 0;
  const r11_n = sy ? m[5] / sy : 1;
  const r12_n = sz ? m[9] / sz : 0;
  const r22_n = sz ? m[10] / sz : 1;
  const syVal = Math.max(-1, Math.min(1, r02_n));
  const ry = Math.asin(syVal);
  let rx: number;
  let rz: number;
  if (Math.abs(syVal) < 0.999999) {
    rx = Math.atan2(-r12_n, r22_n);
    rz = Math.atan2(-r01_n, r00_n);
  } else {
    rx = 0;
    rz = Math.atan2(r10_n, r11_n);
  }
  return {
    position,
    rotation: [rx * 180 / Math.PI, ry * 180 / Math.PI, rz * 180 / Math.PI],
    scale,
  };
}

/** 深拷贝（快照用）。结构化克隆对纯数据 SceneDef 安全且快。 */
const clone = <T,>(x: T): T =>
  typeof structuredClone === 'function'
    ? structuredClone(x)
    : (JSON.parse(JSON.stringify(x)) as T);

const defaultView = (): ViewState => ({
  transformMode: 'translate',
  projection: 'perspective',
  showCoverageHeatmap: false,
  showFrustums: false,
  snapToGrid: false,
  snapStep: 0.25,
  rotationSnapStep: 15,
  cameraSpeed: 3.0,
  viewportCommand: null,
  isTransforming: false,
  isCameraNavigating: false,
  showGuides: true,
  showViewportHud: true,
});

let viewportCommandId = 0;
let logIdCounter = 1;

/** 默认编辑器偏好（T-032）。 */
function defaultPreferences(): EditorPreferences {
  return {
    mouseSensitivity: 1,
    invertZoom: false,
    defaultProjection: 'perspective',
    highContrast: false,
    fontScale: 1,
    gridSectionSize: 1,
    gridSectionThickness: 0.5,
    gridCellColor: '#484d54',
    gridSectionColor: '#28a8ff',
    guideRingRadius: 1,
    guideRingTube: 0.1,
    // #WDD-gpt 2026-06-21 - 视锥绘制远端：默认 10m，避免用 cam.far(默认 1000) 画出超长锥
    frustumDrawDistance: 10,
  };
}

function initialPreferences(): EditorPreferences {
  return readPrefs(defaultPreferences());
}

/** 阈值初始值：从 localStorage 恢复，回退默认（世界面板数据持久化）。 */
function initialThresholds(): EvalThresholds {
  return readThresholds(defaultThresholds());
}

function focusTargetForEntity(entity: AnyEntity): { target: Vec3; distance: number } {
  if (entity.kind === 'subject') {
    const target = aabbCenter(entity.bounds);
    const size = aabbSize(entity.bounds);
    const radius = Math.max(1, Math.hypot(size[0], size[1], size[2]) * 0.5);
    return { target, distance: radius * 2.8 };
  }
  return {
    target: entity.transform.position,
    distance: entity.kind === 'camera' ? 3.5 : 2.5,
  };
}

export const usePlanner = create<PlannerState>((set, get) => ({
  // T-022：首次启动加载环形相机阵列示例场景，方便直接演示与冒烟
  scene: buildExampleScene(),
  selection: [],
  lastSelectAnchor: null,
  clipboard: [],
  history: emptyHistory(),
  view: defaultView(),
  locale: 'zh',
  setLocale: (locale) => set({ locale }),

  // —— Message Log（T-033）——
  logs: [],
  showLogs: false,
  log: (level, message) =>
    set((st) => ({
      logs: [
        ...st.logs.slice(-199), // 最多保留 200 条
        { id: logIdCounter++, level, message, at: new Date().toISOString() },
      ],
    })),
  clearLogs: () => set({ logs: [] }),
  toggleLogs: () => set((st) => ({ showLogs: !st.showLogs })),

  // —— Editor Preferences（T-032）——
  preferences: initialPreferences(),
  // #WDD-gpt 2026-06-21 - preferences 写入即落盘：无论从 Preferences 面板还是世界面板
  // （frustumDrawDistance 等编辑器偏好）修改都持久化到 localStorage。
  setPreferences: (patch) =>
    set((st) => {
      const preferences = { ...st.preferences, ...patch };
      writePrefs(preferences);
      return { preferences };
    }),

  // —— Camera Bookmarks（T-026）——
  bookmarks: new Array(9).fill(null),
  setBookmark: (slot, bookmark) =>
    set((st) => {
      if (slot < 0 || slot > 8) return st;
      const next = [...st.bookmarks];
      next[slot] = bookmark;
      return { bookmarks: next };
    }),

  // —— 评估阈值（T-034）——
  // #WDD-gpt 2026-06-21 - 世界面板数据持久化：初始从 localStorage 恢复，写入时落盘。
  thresholds: initialThresholds(),
  setThresholds: (patch, withHistory = true) =>
    set((st) => {
      const thresholds = { ...st.thresholds, ...patch };
      writeThresholds(thresholds);
      return {
        thresholds,
        history: withHistory ? record(st.scene, st.history) : st.history,
      };
    }),

  // —— 场景文件状态（T-035）——
  currentFileName: null,
  dirty: false,
  setCurrentFileName: (name) => set({ currentFileName: name }),
  markDirty: () => set({ dirty: true }),
  markClean: () => set({ dirty: false }),

  // —— 模态/覆盖层 ——
  activeOverlay: null,
  setActiveOverlay: (overlay) => set({ activeOverlay: overlay }),

  // —— 组合隔离编辑（不入历史）——
  editingGroupId: null,
  enterGroupEdit: (id) => set({ editingGroupId: id, selection: [] }),
  exitGroupEdit: () => set({ editingGroupId: null, selection: [] }),

  // —— 渲染设置（T-088）——
  renderSettings: {
    toneMapping: 'aces',
    bloom: true,
    bloomIntensity: 0.6,
    ssao: true,
    taa: false,
    quality: 'standard',
    pathTracing: false,
    ptSamples: 64,
    ptBounces: 3,
  },
  setRenderSettings: (patch) => set((st) => ({ renderSettings: { ...st.renderSettings, ...patch } })),

  selectedEntity: () => {
    const { scene, selection } = get();
    if (selection.length === 0) return null;
    return findEntity(scene, selection[selection.length - 1]);
  },

  // —— 历史 ——
  undo: () =>
    set((st) => {
      const r = undo(st.scene, st.history);
      if (!r) return st;
      return { scene: r.scene, history: r.history };
    }),
  redo: () =>
    set((st) => {
      const r = redo(st.scene, st.history);
      if (!r) return st;
      return { scene: r.scene, history: r.history };
    }),
  canUndo: () => canUndo(get().history),
  canRedo: () => canRedo(get().history),
  commitHistory: () =>
    set((st) => ({ history: record(st.scene, st.history) })),

  // —— 增 ——
  addCamera: (overrides) => {
    const st = get();
    const cam = defaultCamera(usedIds(st.scene), overrides);
    set({
      scene: {
        ...st.scene,
        cameras: [...st.scene.cameras, cam],
      },
      history: record(st.scene, st.history),
      selection: [cam.id],
      dirty: true,
    });
    return cam;
  },
  addLight: (kind, overrides) => {
    const st = get();
    const light = defaultLight(kind, usedIds(st.scene), overrides);
    set({
      scene: { ...st.scene, lights: [...st.scene.lights, light] },
      history: record(st.scene, st.history),
      selection: [light.id],
      dirty: true,
    });
    return light;
  },
  addSubject: (overrides) => {
    const st = get();
    const subj = defaultSubject(usedIds(st.scene), overrides);
    // bounds 已在 defaultSubject 算；若 overrides 改了 transform/geometry，重算
    if (overrides && (overrides.transform || overrides.geometry)) {
      subj.bounds = aabbOfSubject(subj);
    }
    set({
      scene: { ...st.scene, subjects: [...st.scene.subjects, subj] },
      history: record(st.scene, st.history),
      selection: [subj.id],
      dirty: true,
    });
    return subj;
  },
  addGroup: (overrides) => {
    const st = get();
    const group = defaultGroup(usedIds(st.scene), overrides);
    set({
      scene: { ...st.scene, groups: [...(st.scene.groups ?? []), group] },
      history: record(st.scene, st.history),
      selection: [group.id],
      dirty: true,
    });
    return group;
  },
  // #WDD-gpt 2026-06-21 - 删除一个实体时级联删除其全部子代（collectSubtreeIds 含 id 自身），
  // 避免留下 parentId 指向已删实体的孤儿。这与大纲树形视图一致：删父即删整棵子树。
  removeEntity: (id) =>
    set((st) => {
      const removeSet = new Set(collectSubtreeIds(st.scene, id));
      if (removeSet.size === 0) return st;
      const before = st.scene;
      const scene: SceneDef = {
        ...before,
        cameras: before.cameras.filter((e) => !removeSet.has(e.id)),
        lights: before.lights.filter((e) => !removeSet.has(e.id)),
        subjects: before.subjects.filter((e) => !removeSet.has(e.id)),
        groups: (before.groups ?? []).filter((e) => !removeSet.has(e.id)),
      };
      return {
        scene,
        history: record(before, st.history),
        selection: st.selection.filter((s) => !removeSet.has(s)),
        dirty: true,
      };
    }),
  // #WDD-gpt  2026-06-19 - 支持多选删除并合并为一个撤销步骤，匹配编辑器批量操作预期。
  // #WDD-gpt 2026-06-21 - 同样级联删除每个选中实体的全部子代。
  removeEntities: (ids) =>
    set((st) => {
      const removeSet = new Set<string>();
      for (const id of ids) for (const sub of collectSubtreeIds(st.scene, id)) removeSet.add(sub);
      if (removeSet.size === 0) return st;
      const before = st.scene;
      const scene: SceneDef = {
        ...before,
        cameras: before.cameras.filter((e) => !removeSet.has(e.id)),
        lights: before.lights.filter((e) => !removeSet.has(e.id)),
        subjects: before.subjects.filter((e) => !removeSet.has(e.id)),
        groups: (before.groups ?? []).filter((e) => !removeSet.has(e.id)),
      };
      return {
        scene,
        history: record(before, st.history),
        selection: st.selection.filter((s) => !removeSet.has(s)),
        dirty: true,
      };
    }),
  duplicateEntity: (id) => {
    const st = get();
    const src = findEntity(st.scene, id);
    if (!src) return null;
    const used = usedIds(st.scene);
    if (src.kind === 'camera') {
      const copy: CameraDef = {
        ...clone(src),
        id: uid('cam', used),
        name: `${src.name} copy`,
        transform: {
          ...src.transform,
          position: [src.transform.position[0] + 1, src.transform.position[1], src.transform.position[2] + 1],
        },
      };
      set({
        scene: { ...st.scene, cameras: [...st.scene.cameras, copy] },
        history: record(st.scene, st.history),
        selection: [copy.id],
      });
      return copy.id;
    }
    if (src.kind === 'light') {
      const copy: LightDef = {
        ...clone(src),
        id: uid('light', used),
        name: `${src.name} copy`,
        transform: {
          ...src.transform,
          position: [src.transform.position[0] + 1, src.transform.position[1], src.transform.position[2] + 1],
        },
      };
      set({
        scene: { ...st.scene, lights: [...st.scene.lights, copy] },
        history: record(st.scene, st.history),
        selection: [copy.id],
      });
      return copy.id;
    }
    if (src.kind === 'group') {
      const copy: GroupDef = {
        ...clone(src),
        id: uid('group', used),
        name: `${src.name} copy`,
        transform: {
          ...src.transform,
          position: [src.transform.position[0] + 1, src.transform.position[1], src.transform.position[2] + 1],
        },
      };
      set({
        scene: { ...st.scene, groups: [...(st.scene.groups ?? []), copy] },
        history: record(st.scene, st.history),
        selection: [copy.id],
        dirty: true,
      });
      return copy.id;
    }
    // subject
    const copy: SubjectDef = {
      ...clone(src),
      id: uid('subj', used),
      name: `${src.name} copy`,
      transform: {
        ...src.transform,
        position: [src.transform.position[0] + 1, src.transform.position[1], src.transform.position[2] + 1],
      },
      bounds: { min: [0, 0, 0], max: [0, 0, 0] },
    };
    copy.bounds = aabbOfSubject(copy);
    set({
      scene: { ...st.scene, subjects: [...st.scene.subjects, copy] },
      history: record(st.scene, st.history),
      selection: [copy.id],
      dirty: true,
    });
    return copy.id;
  },
  // #WDD-gpt 2026-06-21 - Ctrl+C：深拷贝当前选中实体到剪贴板（保留原 id 以维持父子关系）。
  copySelection: () => {
    const st = get();
    const all = [
      ...st.scene.cameras,
      ...st.scene.lights,
      ...st.scene.subjects,
      ...(st.scene.groups ?? []),
    ];
    const entities = st.selection
      .map((id) => all.find((e) => e.id === id) ?? null)
      .filter((e): e is AnyEntity => e !== null);
    if (entities.length === 0) return;
    set({ clipboard: entities.map((e) => clone(e)) });
  },
  // #WDD-gpt 2026-06-21 - Ctrl+V：粘贴剪贴板——每个实体生成新 id，位置整体偏移 +1m，
  // 维持剪贴板内的父子关系（旧 id→新 id 重映射）。返回新实体 id 列表并选中。
  pasteSelection: () => {
    const st = get();
    const clip = st.clipboard;
    if (clip.length === 0) return [];
    const used = usedIds(st.scene);
    // 旧 id → 新 id 映射（按类型生成前缀）
    const idMap = new Map<EntityId, EntityId>();
    for (const e of clip) {
      const prefix =
        e.kind === 'camera' ? 'cam' : e.kind === 'light' ? 'light' : e.kind === 'group' ? 'group' : 'subj';
      idMap.set(e.id, uid(prefix, used));
      used.add(idMap.get(e.id)!);
    }
    const OFFSET = 1; // 粘贴偏移 1m（XZ），避免与原件重叠
    const remap = (e: AnyEntity): AnyEntity => {
      const newId = idMap.get(e.id)!;
      // parentId 若在剪贴板内则重映射，否则丢弃（不引用外部实体）
      const newParent = e.parentId ? (idMap.get(e.parentId) ?? undefined) : undefined;
      const pos = e.transform.position;
      const transformed: AnyEntity = {
        ...clone(e),
        id: newId,
        parentId: newParent,
        name: `${e.name} copy`,
        transform: {
          ...e.transform,
          position: [pos[0] + OFFSET, pos[1], pos[2] + OFFSET],
        },
      };
      return transformed;
    };
    const copies = clip.map(remap);
    const newCameras = copies.filter((c): c is CameraDef => c.kind === 'camera');
    const newLights = copies.filter((c): c is LightDef => c.kind === 'light');
    const newGroups = copies.filter((c): c is GroupDef => c.kind === 'group');
    const newSubjects = copies.filter((c): c is SubjectDef => c.kind === 'subject');
    // subject 需重算 bounds
    const fixedSubjects = newSubjects.map((s) => ({ ...s, bounds: aabbOfSubject(s) }));
    const newIds = copies.map((c) => c.id);
    set({
      scene: {
        ...st.scene,
        cameras: [...st.scene.cameras, ...newCameras],
        lights: [...st.scene.lights, ...newLights],
        subjects: [...st.scene.subjects, ...fixedSubjects],
        groups: [...(st.scene.groups ?? []), ...newGroups],
      },
      history: record(st.scene, st.history),
      selection: newIds,
      lastSelectAnchor: newIds[newIds.length - 1] ?? null,
      dirty: true,
    });
    return newIds;
  },
  // T-028：改父级。默认 keepWorld=true 保持世界变换（BUG-007）；防成环与自引用。
  reparent: (id, newParentId, keepWorld = true) =>
    set((st) => {
      if (id === newParentId) return st; // 不能做自己父级
      // 防成环：newParentId 不能是 id 的后代
      if (newParentId !== null && isDescendant(st.scene, newParentId, id)) return st;

      const allEntities: HierarchicalEntity[] = [
        ...st.scene.cameras,
        ...st.scene.lights,
        ...st.scene.subjects,
        ...(st.scene.groups ?? []),
      ];
      const target = allEntities.find((e) => e.id === id);
      if (!target) return st;

      // 计算 keep-world 后的新局部 transform
      let newTransform = target.transform;
      if (keepWorld) {
        const world = getWorldTransform(target, allEntities);
        if (newParentId === null) {
          // 提到根：局部=世界
          newTransform = {
            position: world.position,
            rotation: world.rotation,
            scale: target.transform.scale ?? [1, 1, 1],
          };
        } else {
          const parent = allEntities.find((e) => e.id === newParentId);
          if (parent) {
            const parentWorld = getWorldTransform(parent, allEntities);
            const parentMat = composeMatrix(
              parentWorld.position,
              parentWorld.rotation,
              parentWorld.scale,
            );
            const worldMat = composeMatrix(world.position, world.rotation, world.scale ?? [1, 1, 1]);
            // localMat = inverse(parentMat) * worldMat
            const localMat = multiply4(invert4(parentMat), worldMat);
            newTransform = decomposeTRS(localMat, target.transform.scale ?? [1, 1, 1]);
          }
        }
      }

      const patchParent = <T extends { id: EntityId; parentId?: EntityId; transform: Transform }>(
        arr: T[],
      ): T[] =>
        arr.map((e) => (e.id === id ? { ...e, parentId: newParentId ?? undefined, transform: newTransform } : e));

      const scene: SceneDef = {
        ...st.scene,
        cameras: patchParent(st.scene.cameras),
        lights: patchParent(st.scene.lights),
        groups: patchParent(st.scene.groups ?? []),
        // subject 需重算 bounds
        subjects: st.scene.subjects.map((s) =>
          s.id === id
            ? { ...s, parentId: newParentId ?? undefined, transform: newTransform, bounds: aabbOfSubject({ ...s, transform: newTransform }) }
            : s,
        ),
      };
      return { scene, history: record(st.scene, st.history), dirty: true };
    }),
  // #WDD-gpt 2026-06-21 - 批量改父级：逐个应用 reparent 逻辑（复用其防成环与 keep-world），
  // 整批只记录一次历史 → 撤销时一次性回滚。
  reparentMany: (ids, newParentId, keepWorld = true) => {
    const unique = Array.from(new Set(ids)).filter((id) => id !== newParentId);
    set((st) => {
      let scene = st.scene;
      for (const id of unique) {
        if (newParentId !== null && isDescendant(scene, newParentId, id)) continue;
        if (id === newParentId) continue;
        const allEntities: HierarchicalEntity[] = [
          ...scene.cameras,
          ...scene.lights,
          ...scene.subjects,
          ...(scene.groups ?? []),
        ];
        const target = allEntities.find((e) => e.id === id);
        if (!target) continue;
        // keep-world：以当前世界变换反算到新父级下的局部变换
        let newTransform = target.transform;
        if (keepWorld) {
          const world = getWorldTransform(target, allEntities);
          if (newParentId === null) {
            newTransform = {
              position: world.position,
              rotation: world.rotation,
              scale: target.transform.scale ?? [1, 1, 1],
            };
          } else {
            const parent = allEntities.find((e) => e.id === newParentId);
            if (parent) {
              const parentWorld = getWorldTransform(parent, allEntities);
              const parentMat = composeMatrix(parentWorld.position, parentWorld.rotation, parentWorld.scale);
              const worldMat = composeMatrix(world.position, world.rotation, world.scale ?? [1, 1, 1]);
              const localMat = multiply4(invert4(parentMat), worldMat);
              newTransform = decomposeTRS(localMat, target.transform.scale ?? [1, 1, 1]);
            }
          }
        }
        const patchParent = <T extends { id: EntityId; parentId?: EntityId; transform: Transform }>(
          arr: T[],
        ): T[] =>
          arr.map((e) =>
            e.id === id ? { ...e, parentId: newParentId ?? undefined, transform: newTransform } : e,
          );
        scene = {
          ...scene,
          cameras: patchParent(scene.cameras),
          lights: patchParent(scene.lights),
          groups: patchParent(scene.groups ?? []),
          subjects: scene.subjects.map((s) =>
            s.id === id
              ? { ...s, parentId: newParentId ?? undefined, transform: newTransform, bounds: aabbOfSubject({ ...s, transform: newTransform }) }
              : s,
          ),
        };
      }
      return { scene, history: record(st.scene, st.history), dirty: true };
    });
  },

  // —— 选择 ——
  // #WDD-gpt 2026-06-21 - select 记录锚点 lastSelectAnchor，供 Shift+click 范围选择使用。
  select: (id, additive = false) =>
    set((st) => {
      if (id === null) return { selection: [], lastSelectAnchor: null };
      if (additive) {
        const has = st.selection.includes(id);
        return {
          selection: has ? st.selection.filter((s) => s !== id) : [...st.selection, id],
          lastSelectAnchor: id,
        };
      }
      return { selection: [id], lastSelectAnchor: id };
    }),
  selectMany: (ids) => set({ selection: ids }),
  clearSelection: () => set({ selection: [] }),
  selectSubtree: (id) =>
    set((st) => ({ selection: collectSubtreeIds(st.scene, id) })),
  // #WDD-gpt 2026-06-21 - Shift+click 范围选择：按 Outline 显示顺序（树形深度优先），
  // 选中锚点到当前 id 之间的所有可见实体。修复「cam7 作父后选 cam1~cam8 仍误选 cam7」
  // 的 bug——旧实现用场景数组扁平顺序，与树形显示顺序不一致。
  selectRange: (id) =>
    set((st) => {
      const ids = flattenTreeDisplayOrder(st.scene);
      const anchor = st.lastSelectAnchor;
      if (!anchor || !ids.includes(anchor) || !ids.includes(id)) {
        return { selection: [id], lastSelectAnchor: id };
      }
      const a = ids.indexOf(anchor);
      const b = ids.indexOf(id);
      const [lo, hi] = a < b ? [a, b] : [b, a];
      return { selection: ids.slice(lo, hi + 1), lastSelectAnchor: anchor };
    }),

  // —— 更新 ——
  updateCamera: (id, patch, withHistory = true) =>
    set((st) => ({
      scene: {
        ...st.scene,
        cameras: st.scene.cameras.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      },
      history: withHistory ? record(st.scene, st.history) : st.history,
      dirty: true,
    })),
  updateLight: (id, patch, withHistory = true) =>
    set((st) => ({
      scene: {
        ...st.scene,
        lights: st.scene.lights.map((l) => (l.id === id ? { ...l, ...patch } : l)),
      },
      history: withHistory ? record(st.scene, st.history) : st.history,
      dirty: true,
    })),
  updateSubject: (id, patch, withHistory = true) =>
    set((st) => ({
      scene: {
        ...st.scene,
        subjects: st.scene.subjects.map((s) => {
          if (s.id !== id) return s;
          const next = { ...s, ...patch };
          // 几何/变换变了需重算 bounds
          if (patch.transform || patch.geometry) next.bounds = aabbOfSubject(next);
          return next;
        }),
      },
      history: withHistory ? record(st.scene, st.history) : st.history,
      dirty: true,
    })),
  updateGroup: (id, patch, withHistory = true) =>
    set((st) => ({
      scene: {
        ...st.scene,
        groups: (st.scene.groups ?? []).map((g) => (g.id === id ? { ...g, ...patch } : g)),
      },
      history: withHistory ? record(st.scene, st.history) : st.history,
      dirty: true,
    })),
  updateTransform: (id, t, withHistory = true) =>
    set((st) => {
      const map = <T extends { id: EntityId; transform: Transform }>(arr: T[]): T[] =>
        arr.map((e) => (e.id === id ? { ...e, transform: t } : e));
      return {
        scene: {
          ...st.scene,
          cameras: map(st.scene.cameras),
          lights: map(st.scene.lights),
          groups: map(st.scene.groups ?? []),
          subjects: st.scene.subjects.map((s) =>
            s.id === id ? { ...s, transform: t, bounds: aabbOfSubject({ ...s, transform: t }) } : s,
          ),
        },
        history: withHistory ? record(st.scene, st.history) : st.history,
        dirty: true,
      };
    }),
  updateEnv: (patch, withHistory = true) =>
    set((st) => ({
      scene: { ...st.scene, env: { ...st.scene.env, ...patch } },
      history: withHistory ? record(st.scene, st.history) : st.history,
      dirty: true,
    })),
  renameEntity: (id, name) =>
    set((st) => {
      const mapName = <T extends { id: EntityId; name: string }>(arr: T[]): T[] =>
        arr.map((e) => (e.id === id ? { ...e, name } : e));
      return {
        scene: {
          ...st.scene,
          cameras: mapName(st.scene.cameras),
          lights: mapName(st.scene.lights),
          subjects: mapName(st.scene.subjects),
          groups: mapName(st.scene.groups ?? []),
        },
        history: record(st.scene, st.history),
        dirty: true,
      };
    }),

  // —— 场景级 ——
  loadScene: (scene) =>
    set(() => ({
      // 旧文件可能无 groups 字段，补 [] 兼容
      scene: { ...scene, groups: scene.groups ?? [], version: SCHEMA_VERSION },
      selection: [],
      editingGroupId: null,
      history: emptyHistory(),
      dirty: false,
    })),
  resetScene: () =>
    set(() => ({
      scene: defaultScene(),
      selection: [],
      history: emptyHistory(),
      currentFileName: null,
      dirty: false,
    })),
  /** T-022：加载内置示例场景（环形相机阵列）。 */
  loadExampleScene: () =>
    set(() => ({
      scene: buildExampleScene(),
      selection: [],
      history: emptyHistory(),
      currentFileName: null,
      dirty: false,
    })),

  // —— 视图 ——
  setTransformMode: (m) => set((st) => ({ view: { ...st.view, transformMode: m } })),
  setProjection: (p) =>
    set((st) => {
      const pos: Vec3 =
        p === 'top'
          ? [0, 20, 0.001]
          : p === 'front'
            ? [0, 0.5, 20]
            : p === 'side'
              ? [20, 0.5, 0]
              : [6, 5, 8];
      const target: Vec3 = p === 'top' ? [0, 0, 0] : [0, 0.5, 0];
      return {
        view: {
          ...st.view,
          projection: p,
          viewportCommand: {
            id: ++viewportCommandId,
            kind: 'setView',
            position: pos,
            target,
          },
        },
      };
    }),
  toggleCoverageHeatmap: () =>
    set((st) => ({ view: { ...st.view, showCoverageHeatmap: !st.view.showCoverageHeatmap } })),
  toggleFrustums: () => set((st) => ({ view: { ...st.view, showFrustums: !st.view.showFrustums } })),
  toggleSnap: () => set((st) => ({ view: { ...st.view, snapToGrid: !st.view.snapToGrid } })),
  toggleGuides: () => set((st) => ({ view: { ...st.view, showGuides: !st.view.showGuides } })),
  toggleViewportHud: () => set((st) => ({ view: { ...st.view, showViewportHud: !st.view.showViewportHud } })),
  setSnapStep: (step) => set((st) => ({ view: { ...st.view, snapStep: step } })),
  setRotationSnapStep: (step) => set((st) => ({ view: { ...st.view, rotationSnapStep: step } })),
  setViewSnapStep: (step) => set((st) => ({ view: { ...st.view, snapStep: step } })),
  // T-027 世界/局部坐标系
  gizmoSpace: 'world',
  setGizmoSpace: (space) => set({ gizmoSpace: space }),
  // T-025 视图模式
  viewMode: 'lit',
  setViewMode: (mode) => set({ viewMode: mode }),
  setCameraSpeed: (speed) => set((st) => ({ view: { ...st.view, cameraSpeed: speed } })),
  setIsTransforming: (isTransforming) =>
    set((st) => ({ view: { ...st.view, isTransforming } })),
  setIsCameraNavigating: (isCameraNavigating) =>
    set((st) => ({ view: { ...st.view, isCameraNavigating } })),
  // #WDD-gpt  2026-06-19 - 通过 store 分发 F 聚焦请求，由 UnrealControls 消费并移动 Three 相机
  focusSelectedViewport: () =>
    set((st) => {
      const id = st.selection[st.selection.length - 1];
      if (!id) return st;
      const entity = findEntity(st.scene, id);
      if (!entity) return st;
      const focus = focusTargetForEntity(entity);
      return {
        view: {
          ...st.view,
          viewportCommand: {
            id: ++viewportCommandId,
            kind: 'focus',
            target: focus.target,
            distance: focus.distance,
          },
        },
      };
    }),
  viewSelectedCameraViewport: () =>
    set((st) => {
      const id = st.selection[st.selection.length - 1];
      if (!id || !st.scene.cameras.some((cam) => cam.id === id)) return st;
      return {
        view: {
          ...st.view,
          // #WDD-gpt  2026-06-21 - 选中摄像机时让主视口捕捉到该摄像机位姿，供 Details 按钮与 F 快捷键共用
          viewportCommand: {
            id: ++viewportCommandId,
            kind: 'viewCamera',
            cameraId: id,
          },
        },
      };
    }),
  setSelectedCameraFromViewport: () =>
    set((st) => {
      const id = st.selection[st.selection.length - 1];
      if (!id || !st.scene.cameras.some((cam) => cam.id === id)) return st;
      return {
        view: {
          ...st.view,
          // #WDD-gpt  2026-06-21 - 把选中摄像机设置为当前主视口位姿，实际 Three 相机读数由 UnrealControls 消费命令后写回
          viewportCommand: {
            id: ++viewportCommandId,
            kind: 'setCameraFromViewport',
            cameraId: id,
          },
        },
      };
    }),
  resetViewportCamera: () =>
    set((st) => ({
      view: {
        ...st.view,
        viewportCommand: {
          id: ++viewportCommandId,
          kind: 'reset',
        },
      },
    })),

  // WDD -gemini 2026-06-19 加入布局面板的多状态管理（Dock/Float/Resize/Collapse）
  // —— 布局 (Layout) ——
  layout: {
    outliner: { show: true, dock: 'left', width: 260, height: 400, x: 80, y: 120, collapsed: false },
    inspector: { show: true, dock: 'right', width: 300, height: 400, x: 500, y: 120, collapsed: false },
    statsBar: { show: true, dock: 'bottom', height: 24, collapsed: false },
  },
  togglePanel: (panel) =>
    set((st) => ({
      layout: {
        ...st.layout,
        [panel]: { ...st.layout[panel], show: !st.layout[panel].show },
      },
    })),
  setPanelDock: (panel, dock) =>
    set((st) => ({
      layout: {
        ...st.layout,
        [panel]: { ...st.layout[panel], dock },
      },
    })),
  updatePanelSize: (panel, width, height) =>
    set((st) => ({
      layout: {
        ...st.layout,
        [panel]: { ...st.layout[panel], width, height },
      },
    })),
  updatePanelPos: (panel, x, y) =>
    set((st) => ({
      layout: {
        ...st.layout,
        [panel]: { ...st.layout[panel], x, y },
      },
    })),
  togglePanelCollapse: (panel) =>
    set((st) => ({
      layout: {
        ...st.layout,
        [panel]: { ...st.layout[panel], collapsed: !st.layout[panel].collapsed },
      },
    })),
  resetLayout: () =>
    set(() => ({
      layout: {
        outliner: { show: true, dock: 'left', width: 260, height: 400, x: 80, y: 120, collapsed: false },
        inspector: { show: true, dock: 'right', width: 300, height: 400, x: 500, y: 120, collapsed: false },
        statsBar: { show: true, dock: 'bottom', height: 24, collapsed: false },
      },
    })),
}));

/** 网格捕捉工具（供 gizmo/drag 使用）。 */
export const snap = (v: number, step: number, enabled: boolean): number =>
  enabled ? Math.round(v / step) * step : v;

/** 便于测试/外部重置（避免默认计数器跨用例污染）。 */
export const __resetForTest = (): void => {
  /* placeholder: 计数器在 defaults 模块，store 无独立可变状态需重置 */
};
