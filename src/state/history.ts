/**
 * 撤销/重做的快照栈（src/state/history.ts）。
 *
 * 策略（见 planner-conventions / PLAN）：对可序列化的 SceneDef（entities + env）
 * 做**整快照**入栈。gizmo/scrub 等高频连续变化由调用方**节流**（如 pointerup 或定时）
 * 后再调 commit，避免历史爆炸。
 *
 * 本模块是纯数据结构 + 工具函数，store 组合它。
 */
import type { SceneDef } from '@/types';

/** 历史栈容量上限（防止无限增长；超出丢弃最旧）。 */
const MAX_HISTORY = 100;

export interface HistoryState {
  past: SceneDef[];
  future: SceneDef[];
}

export const emptyHistory = (): HistoryState => ({ past: [], future: [] });

/**
 * 在一次改动**前**记录快照（push 到 past，清空 future）。
 * @param prev 改动前的 SceneDef。
 * @returns 新历史状态。
 */
export function record(prev: SceneDef, h: HistoryState): HistoryState {
  const past = [...h.past, prev];
  if (past.length > MAX_HISTORY) past.shift();
  return { past, future: [] };
}

/** 撤销：把当前状态推入 future，从 past 弹出一个恢复。返回 [新历史, 恢复的Scene] 或 null。 */
export function undo(
  current: SceneDef,
  h: HistoryState,
): { history: HistoryState; scene: SceneDef } | null {
  if (h.past.length === 0) return null;
  const past = [...h.past];
  const prev = past.pop()!;
  return {
    history: { past, future: [current, ...h.future] },
    scene: prev,
  };
}

/** 重做：把当前状态推入 past，从 future 弹出一个恢复。 */
export function redo(
  current: SceneDef,
  h: HistoryState,
): { history: HistoryState; scene: SceneDef } | null {
  if (h.future.length === 0) return null;
  const future = [...h.future];
  const next = future.shift()!;
  return {
    history: { past: [...h.past, current], future },
    scene: next,
  };
}

export const canUndo = (h: HistoryState): boolean => h.past.length > 0;
export const canRedo = (h: HistoryState): boolean => h.future.length > 0;
