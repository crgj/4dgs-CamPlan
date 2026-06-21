// T-089/T-090 renderPreview 纯逻辑单测：布局计算 + blob/dataURL 转换 + contact sheet 编排。
import { describe, it, expect } from 'vitest';
import {
  computeContactSheetLayout,
  dataURLToBlob,
  buildContactSheet,
  type ContactSheetCanvas,
} from './renderPreview';

// 构造一个 1x1 透明 PNG dataURL（真实 base64），用于 blob/contactSheet 测试
const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC';

describe('renderPreview layout (T-089)', () => {
  it('computeContactSheetLayout 给定条目数与列数算出网格', () => {
    const l = computeContactSheetLayout(9, 4);
    expect(l.cols).toBe(4);
    expect(l.rows).toBe(3); // ceil(9/4)
    expect(l.width).toBe(4 * 320);
    expect(l.height).toBe(3 * (180 + 24));
  });

  it('computeContactSheetLayout 不足一列时行数为 1', () => {
    const l = computeContactSheetLayout(2, 4);
    expect(l.rows).toBe(1);
  });

  it('computeContactSheetLayout 自定义单元格尺寸生效', () => {
    const l = computeContactSheetLayout(4, 2, 200, 100, 16);
    expect(l.cellW).toBe(200);
    expect(l.cellH).toBe(100);
    expect(l.labelH).toBe(16);
    expect(l.width).toBe(400);
    expect(l.height).toBe(2 * (100 + 16));
  });

  it('computeContactSheetLayout 列数至少为 1', () => {
    const l = computeContactSheetLayout(3, 0);
    expect(l.cols).toBe(1);
    expect(l.rows).toBe(3);
  });
});

describe('renderPreview blob conversion (T-090)', () => {
  it('dataURLToBlob 解析为 PNG Blob', () => {
    const blob = dataURLToBlob(TINY_PNG);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('image/png');
    expect(blob.size).toBeGreaterThan(0);
  });

  it('dataURLToBlob 对非法输入返回空 Blob', () => {
    const blob = dataURLToBlob('not-a-data-url');
    expect(blob.size).toBe(0);
  });
});

describe('buildContactSheet (T-089)', () => {
  it('空条目返回空字符串', async () => {
    const r = await buildContactSheet([]);
    expect(r).toBe('');
  });

  /** mock canvas：记录绘制操作并返回可辨识的 dataURL，不依赖真实 canvas 实现。 */
  function makeMockCanvas(encodeFails = false): { canvas: ContactSheetCanvas; ops: string[] } {
    const ops: string[] = [];
    const ctx = {
      fillRect: (x: number, y: number, w: number, h: number) => {
        ops.push(`rect:${x},${y},${w},${h}`);
      },
      drawImage: () => {
        ops.push('img');
      },
      fillText: (t: string) => {
        ops.push(`text:${t}`);
      },
      // 其余属性按需赋值（fillStyle/font/textBaseline 都是可写属性）
      fillStyle: '',
      font: '',
      textBaseline: '',
    };
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ctx,
      toDataURL: () => {
        if (encodeFails) throw new Error('not implemented');
        return 'data:image/png;base64,MOCK';
      },
    };
    return { canvas: canvas as unknown as ContactSheetCanvas, ops };
  }

  it('注入 mock canvas 后合成 contact sheet 返回 dataURL 并绘制每格', async () => {
    const fakeImg = { width: 640, height: 360 } as unknown as HTMLImageElement;
    const loadImage = () => Promise.resolve(fakeImg);
    const { canvas, ops } = makeMockCanvas();
    const entries = [
      { label: 'cam-01', dataURL: TINY_PNG },
      { label: 'cam-02', dataURL: TINY_PNG },
      { label: 'cam-03', dataURL: TINY_PNG },
    ];
    const r = await buildContactSheet(entries, { cols: 2, cellW: 100, cellH: 50, labelH: 10 }, loadImage, () => canvas);
    expect(r.startsWith('data:image/png')).toBe(true);
    // 每个条目应绘制了一张图片 + 一条标签文字
    expect(ops.filter((o) => o === 'img').length).toBe(3);
    expect(ops.filter((o) => o.startsWith('text:')).length).toBe(3);
    expect(ops).toContain('text:cam-01');
  });

  it('单张加载失败不阻断整体合成（落回错误底色）', async () => {
    const ok = { width: 100, height: 100 } as unknown as HTMLImageElement;
    let call = 0;
    const loadImage = () => {
      call++;
      return call === 2 ? Promise.reject(new Error('bad')) : Promise.resolve(ok);
    };
    const { canvas } = makeMockCanvas();
    const entries = [
      { label: 'a', dataURL: TINY_PNG },
      { label: 'b', dataURL: TINY_PNG },
    ];
    const r = await buildContactSheet(entries, { cols: 2 }, loadImage, () => canvas);
    expect(r.startsWith('data:image/png')).toBe(true);
  });

  it('toDataURL 编码失败时优雅返回空串（jsdom 兼容）', async () => {
    const fakeImg = { width: 100, height: 100 } as unknown as HTMLImageElement;
    const loadImage = () => Promise.resolve(fakeImg);
    const { canvas } = makeMockCanvas(true);
    const r = await buildContactSheet([{ label: 'a', dataURL: TINY_PNG }], { cols: 1 }, loadImage, () => canvas);
    expect(r).toBe('');
  });
});
