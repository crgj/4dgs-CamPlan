/**
 * 场景文件 IO 辅助（src/io/sceneFiles.ts）。
 * T-035 Save/Load/Autosave：集中处理 .planner.json 的文件读写、下载、自动保存与崩溃恢复。
 * 纯浏览器 API 封装，不含 React；UI（MenuBar）调用这些函数 + store.log 反馈。
 */
import type { SceneDef } from '@/types';
import { serializeScene, deserializeScene, validateScene } from './serialize';

const AUTOSAVE_KEY = 'planner.autosave';
const PREFS_KEY = 'planner.preferences';

/** 触发浏览器下载一个文本文件。 */
export function downloadTextFile(content: string, filename: string, mime = 'application/json'): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** 打开文件选择器并读取单个文本文件。resolve 为文件内容字符串；取消则 reject。 */
export function pickAndReadTextFile(accept = '.planner.json,application/json'): Promise<{ name: string; content: string }> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        reject(new Error('cancelled'));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve({ name: file.name, content: String(reader.result) });
      reader.onerror = () => reject(reader.error ?? new Error('read error'));
      reader.readAsText(file);
    };
    input.click();
  });
}

/** 把场景保存到浏览器下载（用户手动 Save）。返回 true 成功。 */
export function saveSceneToFile(scene: SceneDef, filename: string): { ok: boolean; error?: string } {
  try {
    downloadTextFile(serializeScene(scene), filename);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** 从文件内容加载并校验场景。返回 { scene } 或 { error }。 */
export function loadSceneFromText(content: string): { scene?: SceneDef; error?: string } {
  try {
    const scene = deserializeScene(content);
    const errs = validateScene(scene);
    if (errs.length > 0) {
      return { error: errs.join('; ') };
    }
    return { scene };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

// —— Autosave（写 localStorage）——

/** 写入自动保存（覆盖式）。失败静默——best effort。 */
export function writeAutosave(scene: SceneDef): boolean {
  try {
    localStorage.setItem(AUTOSAVE_KEY, serializeScene(scene));
    return true;
  } catch {
    return false;
  }
}

/** 读取自动保存；无则返回 null。 */
export function readAutosave(): SceneDef | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    const { scene } = loadSceneFromText(raw);
    return scene ?? null;
  } catch {
    return null;
  }
}

/** 清除自动保存（成功保存/加载后调用）。 */
export function clearAutosave(): void {
  try {
    localStorage.removeItem(AUTOSAVE_KEY);
  } catch {
    /* ignore */
  }
}

/** 是否存在自动保存（用于启动恢复提示）。 */
export function hasAutosave(): boolean {
  try {
    return Boolean(localStorage.getItem(AUTOSAVE_KEY));
  } catch {
    return false;
  }
}

// —— Preferences 持久化（T-032）——

export function readPrefs<T>(fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as T) };
  } catch {
    return fallback;
  }
}

export function writePrefs(prefs: unknown): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

// —— 世界面板阈值持久化（T-034，#WDD-gpt 2026-06-21）——
// 世界设置面板的评估阈值是全局、非场景数据，原仅存内存（刷新即丢）。这里持久化到
// localStorage，让用户调整的阈值在重载后保留（与 preferences 同模式）。

const THRESHOLDS_KEY = 'planner.thresholds';

export function readThresholds<T>(fallback: T): T {
  try {
    const raw = localStorage.getItem(THRESHOLDS_KEY);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as T) };
  } catch {
    return fallback;
  }
}

export function writeThresholds(thresholds: unknown): void {
  try {
    localStorage.setItem(THRESHOLDS_KEY, JSON.stringify(thresholds));
  } catch {
    /* ignore */
  }
}
