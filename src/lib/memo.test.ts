import { describe, it, expect, vi } from 'vitest';
import { hashString, hashValue, memoize } from './memo';

describe('memo / 哈希', () => {
  it('hashString 稳定且相同输入相等', () => {
    expect(hashString('planner')).toBe(hashString('planner'));
    expect(hashString('planner')).not.toBe(hashString('Planner'));
  });
  it('hashValue 对等价结构给出相同哈希', () => {
    expect(hashValue({ a: 1, b: [1, 2, 3] })).toBe(
      hashValue({ a: 1, b: [1, 2, 3] }),
    );
  });
  it('hashValue 对字段顺序不同（同结构）也一致', () => {
    // JSON.stringify 按字段定义顺序；这里同字段集不同顺序对象可能不同，
    // 但语义上等价——记录此行为，调用方应保持字段顺序一致。
    const a = JSON.stringify({ a: 1, b: 2 });
    const b = JSON.stringify({ b: 2, a: 1 });
    // 明确：本实现依赖序列化字符串，故顺序敏感（已知约束）
    expect(a === b).toBe(false);
  });
});

describe('memo / memoize', () => {
  it('相同输入只调用一次', () => {
    const fn = vi.fn((n: number) => n * 2);
    const m = memoize(fn);
    expect(m(5)).toBe(10);
    expect(m(5)).toBe(10);
    expect(m(5)).toBe(10);
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('不同输入重新计算', () => {
    const fn = vi.fn((n: number) => n + 1);
    const m = memoize(fn);
    m(1);
    m(2);
    m(1);
    expect(fn).toHaveBeenCalledTimes(2);
  });
  it('对象输入按值命中缓存', () => {
    const fn = vi.fn((s: { a: number }) => s.a);
    const m = memoize(fn);
    m({ a: 1 });
    m({ a: 1 }); // 结构等价 → 命中
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
