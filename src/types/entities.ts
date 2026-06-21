/**
 * 实体类型定义（src/types/entities.ts）。
 * 跨层契约：store/scene/sim/export 全部基于这些纯数据结构，不得使用 Three 对象。
 * 角度一律用度；颜色用 hex 整数；单位用米。详见 common.ts 与 planner-conventions。
 */
import type {
  AABB,
  ColorHex,
  EntityId,
  Transform,
  Vec3,
} from './common';

// ---------------------------------------------------------------------------
// 相机（拍摄阵列的每个机位）
// ---------------------------------------------------------------------------

/** 相机投影模型。v1 仅 PINHOLE（针孔）；预留其他模型便于 v2。 */
export type CameraModel = 'PINHOLE';

/** 曝光参数（用于曝光一致性 sim/exposure 与拍摄清单）。 */
export interface Exposure {
  /** ISO 感光度。 */
  iso: number;
  /** 快门速度（秒），如 1/125 = 0.008。 */
  shutter: number;
  /** 光圈 f 值，如 2.8。 */
  aperture: number;
}

/**
 * 相机定义（CameraDef）。
 * 内参 + 外参(transform) + 采集元数据。导出 transforms.json/COLMAP 的来源。
 */
export interface CameraDef {
  id: EntityId;
  kind: 'camera';
  parentId?: EntityId;
  /** 相机名（大纲显示/导出文件名）。 */
  name: string;
  /** 外参：世界中的位姿。相机看向自身 -Z 轴（Three.js/OpenCV 约定）。 */
  transform: Transform;
  /** 投影模型。 */
  model: CameraModel;
  /** 水平视场角（度）。 */
  fov: number;
  /** 宽高比（宽/高）。 */
  aspect: number;
  /** 近裁剪面（米）。 */
  near: number;
  /** 远裁剪面（米）。 */
  far: number;
  /** 输出分辨率（像素）。用于清单与 SfM 可重建性估算。 */
  resolution: { width: number; height: number };
  /** 曝光参数。 */
  exposure: Exposure;
  /** 是否参与覆盖/清单计算（可在大纲临时禁用某机位）。 */
  enabled: boolean;
  /** 4DGS 预留：采集时刻（秒）。undefined = 静态。 */
  time?: number;
  /** T-040 真实拍摄参数：传感器物理宽（mm）。用于焦距↔FOV 换算与 GSD。 */
  sensorWidth?: number;
  /** T-040 传感器物理高（mm）。 */
  sensorHeight?: number;
  /** T-040 镜头焦距（mm）。设置后优先于 fov 用于内参计算。 */
  focalLength?: number;
  /** T-040 镜头型号/相机型号（清单与 EXIF 用）。 */
  lensModel?: string;
  /** T-040 ISO 上限（拍摄清单约束，防噪点过高）。 */
  maxIso?: number;
  /** T-040 最快快门（秒，防运动模糊）。 */
  minShutter?: number;
}

// ---------------------------------------------------------------------------
// 灯光
// ---------------------------------------------------------------------------

/** 灯光种类。 */
export type LightKind =
  | 'point' // 点光源：全向
  | 'spot' // 聚光灯：有锥角与方向
  | 'directional' // 平行光：如太阳，无位置感只有方向
  | 'area'; // 面光源：用于软阴影/摄影棚（v1 仅占位）

/** 通用灯光定义。各 kind 未必使用全部字段（无关字段保持默认）。 */
export interface LightDef {
  id: EntityId;
  kind: 'light';
  parentId?: EntityId;
  name: string;
  /** 外参：位置与朝向（directional/spot 用 rotation 定方向；spot 可有 target，v1 用 rotation 简化）。 */
  transform: Transform;
  lightKind: LightKind;
  /** 光色（hex 整数）。 */
  color: ColorHex;
  /** 强度。点/聚光用 candela，方向光用 lux 量级；UI 标注即可，sim 仅做相对一致性。 */
  intensity: number;
  /** 聚光灯半角（度），仅 lightKind='spot' 有效。 */
  spotAngle?: number;
  /** 聚光灯半影软化比例 0..1，仅 spot。 */
  spotPenumbra?: number;
  /** 衰减距离（米），点/聚光；超出则不照亮。 */
  range?: number;
  enabled: boolean;
  /** 4DGS 预留。 */
  time?: number;
}

// ---------------------------------------------------------------------------
// 被拍摄主体
// ---------------------------------------------------------------------------

/** 主体几何来源。 */
export type SubjectGeometry =
  | { type: 'box'; size: Vec3 } // 长方体（半边长或全尺寸在 lib/aabb 统一解释，见默认值）
  | { type: 'sphere'; radius: number }
  | { type: 'plane'; size: Vec3 }
  // mesh：引用 OBJ/glTF/USD 模型文件。bbox 为可选的声明式包围盒（缩放后的全尺寸，
  // 单位米），用于覆盖度/采样计算——OBJ 原始坐标（如厘米级）与缩放后视觉尺寸不一致，
  // 必须显式声明。省略时回退 1m 立方体占位（仅供低保真预览，覆盖计算会不准）。
  // animate：USD 等带骨骼动画的模型，true 时用 AnimationMixer 循环播放首个 clip。
  // animationClip：当前播放的动画 clip 名称；undefined 时播放首个 clip。
  | { type: 'mesh'; src: string; bbox?: Vec3; animate?: boolean; animationClip?: string };

/**
 * 被拍摄主体（SubjectDef）。
 * 覆盖/重叠/baseline 计算围绕它的表面采样进行。
 */
export interface SubjectDef {
  id: EntityId;
  kind: 'subject';
  parentId?: EntityId;
  name: string;
  transform: Transform;
  geometry: SubjectGeometry;
  /** 世界空间 AABB（由 lib/aabb 据 transform+geometry 计算，缓存于此避免重复算）。 */
  bounds: AABB;
  /** 表面采样密度（每米采样点数），用于覆盖栅格化。 */
  sampleDensity: number;
  enabled: boolean;
  /** 4DGS 预留：动态主体可按时刻有不同形态（v2 扩展为形态序列）。 */
  time?: number;
}

// ---------------------------------------------------------------------------
// 组合 / 组（Group）
// ---------------------------------------------------------------------------

/**
 * 组合定义（GroupDef）—— 纯 transform 节点。
 *
 * 设计：组合用「总父物体 + 子物体」的现有 parentId 层级表达。Group 是一个
 * 只持有 transform 的容器节点：把多个相机/灯光/主体 reparent 到一个 group 下，
 * 即可整体平移/旋转/缩放、整体选中、整体保存为库资产、整体进入隔离编辑。
 *
 * 与现有三类的区别：group 不渲染几何、不参与 sim 覆盖度/重叠/曝光计算、
 * 也不作为相机导出，但它的 transform **必须**进入 getWorldTransform 的变换链
 * （见 export/transforms.ts、export/colmap.ts 的 allEntities 拼接），
 * 否则挂在 group 下的相机会导出错位。
 */
export interface GroupDef {
  id: EntityId;
  kind: 'group';
  parentId?: EntityId;
  name: string;
  /** 外参：世界中的位姿（子实体继承此变换）。 */
  transform: Transform;
  enabled: boolean;
}

// ---------------------------------------------------------------------------
// 场景环境
// ---------------------------------------------------------------------------

/** 地面/背景环境。 */
export interface EnvGround {
  /** 是否启用地面网格碰撞（拖放落点用）。 */
  enabled: boolean;
  /** 地面 y 坐标（米），通常 0。 */
  y: number;
  /** 地面颜色（hex），用于视口渲染底色。 */
  color: ColorHex;
}

/** 雾效（可选）。 */
export interface EnvFog {
  color: ColorHex;
  /** 近距（米），开始起雾。 */
  near: number;
  /** 远距（米），完全雾化。 */
  far: number;
}

/** 场景环境（EnvDef）。单场景一份。 */
export interface EnvDef {
  kind: 'environment';
  /** HDRI 环境贴图来源（文件路径或预设名）；undefined = 无 HDRI。 */
  hdri?: string;
  /** 环境光强度（环境补光，0..N）。 */
  ambientIntensity: number;
  ground: EnvGround;
  fog?: EnvFog;
}

// ---------------------------------------------------------------------------
// 场景聚合
// ---------------------------------------------------------------------------

/**
 * 场景定义（SceneDef）—— 单一可序列化数据源。
 * store 持有它；sim/export 读它；序列化存它。
 * 注意：env 是单数（一个场景一套环境）。
 */
export interface SceneDef {
  /** schema 版本，用于 .planner.json 向前兼容（见 io/serialize）。 */
  version: number;
  cameras: CameraDef[];
  lights: LightDef[];
  subjects: SubjectDef[];
  /** 组合/组（纯 transform 节点）。可选以兼容旧文件；运行时由 store/defaults 填 []。 */
  groups?: GroupDef[];
  env: EnvDef;
}

/** 联合类型：任意实体（用于大纲/store 通用处理）。 */
export type AnyEntity = CameraDef | LightDef | SubjectDef | GroupDef;

/** 阈值配置（覆盖/重叠/曝光告警用）。UI 可调，默认值见 lib/defaults。 */
export interface EvalThresholds {
  /** 最小可接受覆盖数（每个表面采样点）。低于 = 欠覆盖。 */
  minCoverage: number;
  /** 相邻相机最小可接受重叠率 0..1。 */
  minOverlap: number;
  /** 相邻相机 baseline 区间（米）：[min, max]。 */
  baselineRange: [number, number];
  /** 曝光一致性：阵列内曝光值最大允许极差（EV）。 */
  maxExposureSpread: number;
}
