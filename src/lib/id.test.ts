import { describe, it, expect } from 'vitest';
import { uid, randomTag } from './id';

describe('id / uid', () => {
  it('带前缀且含分隔符', () => {
    const id = uid('cam');
    expect(id).toMatch(/^cam_[a-z0-9]{4}$/);
  });
  it('不同前缀生成不同 id', () => {
    expect(uid('cam')).not.toBe(uid('light'));
  });
  it('默认长度可生成大量不重复', () => {
    const set = new Set<string>();
    for (let i = 0; i < 2000; i++) set.add(uid('x'));
    // 允许极少数碰撞，但绝大多数唯一
    expect(set.size).toBeGreaterThan(1990);
  });
  it('传入 existing 集合时避免冲突', () => {
    const existing = new Set<string>(['cam_aaaa']);
    // 强制生成直到不冲突（多次抽样必有一个不等于 cam_aaaa）
    const id = uid('cam', existing);
    expect(existing.has(id)).toBe(false);
  });
  it('randomTag 默认 4 字符', () => {
    expect(randomTag()).toHaveLength(4);
    expect(randomTag(8)).toHaveLength(8);
  });
});
