/**
 * 基于输入哈希的记忆化（src/lib/memo.ts）。
 * 用于覆盖/重叠等重计算的缓存：依赖 SceneDef（或其派生）的稳定哈希，
 * 哈希不变即命中缓存，避免每帧重算（planner-conventions 性能要求）。
 *
 * 注意：这是“值缓存”，不是 React 的 useMemo——给 sim/ 纯函数用，与渲染解耦。
 */

/** 简单稳定的字符串哈希（djb2 变体），返回无符号 32 位整数 hex 字符串。 */
export const hashString = (s: string): string => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  // 转无符号 32 位，再 hex
  return (h >>> 0).toString(16).padStart(8, '0');
};

/**
 * 对任意可 JSON 序列化的值计算稳定哈希。
 * 适用于 SceneDef 等“纯数据”结构。
 */
export const hashValue = (value: unknown): string =>
  hashString(JSON.stringify(value));

/**
 * 按“单参数 + 哈希键”做记忆化（完整缓存，不限最近一次）。
 * @param fn 待缓存的纯函数（输入须可 JSON 序列化）。
 * @param max 最大缓存条目数（默认 64，LRU 淘汰），防止无限增长。
 * @returns (input) => result，相同 input（按值哈希）返回缓存结果。
 *
 * 典型：const evalCoverage = memoize((scene) => computeCoverage(scene));
 */
export function memoize<A, R>(fn: (a: A) => R, max = 64): (a: A) => R {
  const cache = new Map<string, R>();
  return (a: A) => {
    const key = hashValue(a);
    const hit = cache.get(key);
    if (hit !== undefined) {
      // LRU：命中时移到最新（先删再插，保持插入序=最近使用序）
      cache.delete(key);
      cache.set(key, hit);
      return hit;
    }
    const result = fn(a);
    cache.set(key, result);
    if (cache.size > max) {
      // 淘汰最旧（最早插入、最久未用）
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }
    return result;
  };
}
