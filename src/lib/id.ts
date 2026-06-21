/**
 * 唯一 id 生成（src/lib/id.ts）。
 * 生成带前缀的短 id：`cam_3f2a`、`light_b91c`、`subj_7d04`。
 * 前缀让日志/大纲一眼区分类别；不要用数组下标当 key。
 */

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const LEN = 4; // 4 字符 ≈ 36^4 ≈ 167 万组合，单场景足够；冲突时重试

const cryptoRand = (): number => {
  // 优先用 Web Crypto（浏览器/Node 18+），否则退化到 Math.random
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    const buf = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buf);
    return buf[0] / 0x100000000;
  }
  return Math.random();
};

/** 生成一个随机短串（默认 4 字符）。 */
export const randomTag = (len = LEN): string => {
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHABET[Math.floor(cryptoRand() * ALPHABET.length)];
  return s;
};

/**
 * 生成带前缀的 id。可选传入“已用 id 集合”避免冲突。
 * @param prefix 类别前缀，如 'cam'、'light'、'subj'。
 * @param existing 已存在的 id 集合（可选），冲突时重试。
 */
export const uid = (prefix: string, existing?: ReadonlySet<string>): string => {
  for (let attempt = 0; attempt < 8; attempt++) {
    const id = `${prefix}_${randomTag()}`;
    if (!existing || !existing.has(id)) return id;
  }
  // 极端冲突：加长
  return `${prefix}_${randomTag(8)}`;
};
