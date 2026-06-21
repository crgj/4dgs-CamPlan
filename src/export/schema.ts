// WDD -gemini 2026-06-19 新增 transforms.json 导出格式的 Schema 校验逻辑，消除 any 关键字以符合 strict 语法

export interface TransformsFrameData {
  file_path: string;
  camera_to_world: number[][];
  fl_x?: number;
  fl_y?: number;
  cx?: number;
  cy?: number;
  w?: number;
  h?: number;
  near?: number;
  far?: number;
  id?: string;
  name?: string;
  exposure?: {
    iso: number;
    shutter: number;
    aperture: number;
  };
  enabled?: boolean;
  time?: number;
}

export interface TransformsJsonData {
  camera_model: string;
  fl_x?: number;
  fl_y?: number;
  cx?: number;
  cy?: number;
  w?: number;
  h?: number;
  near?: number;
  far?: number;
  frames: TransformsFrameData[];
  time?: number;
}

/**
 * 校验 Nerfstudio transforms.json 的数据结构是否符合规范。
 * 遵循 Nerfstudio 的 PERSPECTIVE 模型约定。
 */
export function validateTransformsJson(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const obj = data as Record<string, unknown>;
  if (obj.camera_model !== 'PERSPECTIVE') {
    return false;
  }
  if (!Array.isArray(obj.frames)) {
    return false;
  }

  // 顶层是否有完备的内参
  const hasGlobalIntrinsics =
    typeof obj.fl_x === 'number' &&
    typeof obj.fl_y === 'number' &&
    typeof obj.cx === 'number' &&
    typeof obj.cy === 'number' &&
    typeof obj.w === 'number' &&
    typeof obj.h === 'number';

  for (const frame of obj.frames) {
    if (typeof frame !== 'object' || frame === null) {
      return false;
    }
    const fObj = frame as Record<string, unknown>;
    if (typeof fObj.file_path !== 'string') {
      return false;
    }

    // camera_to_world 必须是 4x4 的嵌套数组
    const c2w = fObj.camera_to_world;
    if (!Array.isArray(c2w) || c2w.length !== 4) {
      return false;
    }
    for (const row of c2w) {
      if (!Array.isArray(row) || row.length !== 4) {
        return false;
      }
      for (const val of row) {
        if (typeof val !== 'number') {
          return false;
        }
      }
    }

    // 如果顶层没有内参，每一帧必须具备独立的内参
    if (!hasGlobalIntrinsics) {
      const hasFrameIntrinsics =
        typeof fObj.fl_x === 'number' &&
        typeof fObj.fl_y === 'number' &&
        typeof fObj.cx === 'number' &&
        typeof fObj.cy === 'number' &&
        typeof fObj.w === 'number' &&
        typeof fObj.h === 'number';
      if (!hasFrameIntrinsics) {
        return false;
      }
    }
  }

  return true;
}
