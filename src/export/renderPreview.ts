/**
 * T-089/T-090 渲染输出与 contact sheet 工具（src/export/renderPreview.ts）。
 *
 * 职责（浏览器侧、可被面板/菜单调用）：
 *   - canvasToDataURL / canvasToPngBlob：把 Three <Canvas> 的当前帧导出为 PNG。
 *   - 渲染队列节流：批量导出时在帧间让出主线程，避免 UI 冻结。
 *   - buildContactSheet：把多张相机视图 dataURL 合成一张网格缩略图（contact sheet），
 *     用于拍摄前一眼预判每机位构图/曝光/遮挡（4DGS 拍摄规划的核心诉求）。
 *   - 数据 URL → Blob → download，复用 io/sceneFiles 的下载约定，避免引入额外依赖。
 *
 * 纯逻辑测试（不依赖真实 Canvas）：buildContactSheet 的布局/标签计算与
 * nextFrameDelay 计时器可脱离 DOM 验证；图像合成在 jsdom 由测试显式 mock canvas。
 */

/** 下一帧让出（rAF + 微任务），用于渲染队列节流，避免连续 readback 卡帧。 */
export function nextFrameDelay(): Promise<void> {
  if (typeof requestAnimationFrame === 'function') {
    return new Promise((resolve) => requestAnimationFrame(() => resolve()));
  }
  return Promise.resolve();
}

/** 把一张 canvas 的当前帧编码为 PNG dataURL。 */
export function canvasToDataURL(canvas: HTMLCanvasElement, type = 'image/png'): string {
  // 部分浏览器在 preserveDrawingBuffer=false 时 readback 会空；调用方需在渲染后立即取。
  return canvas.toDataURL(type);
}

/** dataURL → Blob（便于触发下载与文件保存）。 */
export function dataURLToBlob(dataURL: string): Blob {
  const [head, body] = dataURL.split(',');
  if (!head || !body) return new Blob([]);
  const mimeMatch = head.match(/data:(.*?);base64/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  // atob 在浏览器与 jsdom 均可用
  const binary = atob(body);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** 触发浏览器下载一个 Blob（与 io/sceneFiles 的下载风格一致）。 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // 延迟回收，避免某些浏览器下载尚未开始就 revoke
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 单张相机视图缩略图输入。 */
export interface ContactSheetEntry {
  /** 相机名（用于标签）。 */
  label: string;
  /** PNG/JPEG dataURL。 */
  dataURL: string;
}

/** contact sheet 布局参数（纯计算，便于单测）。 */
export interface ContactSheetLayout {
  /** 列数。 */
  cols: number;
  /** 行数。 */
  rows: number;
  /** 单格宽度。 */
  cellW: number;
  /** 单格高度。 */
  cellH: number;
  /** 标签条高度。 */
  labelH: number;
  /** 画布总宽。 */
  width: number;
  /** 画布总高。 */
  height: number;
}

/**
 * 计算给定条目数与目标列数下的 contact sheet 布局。
 * 纯函数，无 DOM 依赖，单测可直接验证。
 */
export function computeContactSheetLayout(
  count: number,
  cols: number,
  cellW = 320,
  cellH = 180,
  labelH = 24,
): ContactSheetLayout {
  const c = Math.max(1, cols);
  const rows = Math.max(1, Math.ceil(Math.max(1, count) / c));
  return {
    cols: c,
    rows,
    cellW,
    cellH,
    labelH,
    width: c * cellW,
    height: rows * (cellH + labelH),
  };
}

/**
 * 合成 contact sheet（缩略图网格 + 标签）。
 * 返回 PNG dataURL。在无 canvas/DOM 的环境（jsdom 测试）会因
 * Image onload 不可控，故把“加载图片”做成可注入的异步函数，便于测试替换。
 *
 * 为了在 jsdom（无真实 canvas 2d 实现）下也能单测编排逻辑，把 canvas 与
 * 终态编码（toDataURL）也做成可注入的工厂函数；默认走浏览器 document/原生。
 */
export interface ContactSheetCanvas {
  width: number;
  height: number;
  getContext(type: '2d'): CanvasRenderingContext2D | null;
  toDataURL(type: string): string;
}

export async function buildContactSheet(
  entries: ContactSheetEntry[],
  opts: { cols?: number; cellW?: number; cellH?: number; labelH?: number } = {},
  loadImage: (url: string) => Promise<HTMLImageElement> = defaultLoadImage,
  createCanvas: () => ContactSheetCanvas = defaultCreateCanvas,
): Promise<string> {
  if (entries.length === 0) return '';
  const layout = computeContactSheetLayout(entries.length, opts.cols ?? 4, opts.cellW, opts.cellH, opts.labelH);
  const canvas = createCanvas();
  canvas.width = layout.width;
  canvas.height = layout.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  // 暗色底（UE5 风），避免透明缩略图与白底混淆
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, layout.width, layout.height);

  // 逐格绘制（串行以避免 Image 并发解码竞态）
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const col = i % layout.cols;
    const row = Math.floor(i / layout.cols);
    const x = col * layout.cellW;
    const y = row * (layout.cellH + layout.labelH);
    try {
      const img = await loadImage(entry.dataURL);
      // contain 绘制：保持纵横比居中
      const scale = Math.min(layout.cellW / img.width, layout.cellH / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      const dx = x + (layout.cellW - dw) / 2;
      const dy = y + (layout.cellH - dh) / 2;
      ctx.drawImage(img, dx, dy, dw, dh);
    } catch {
      // 单张失败不阻断整张 contact sheet
      ctx.fillStyle = '#3a1010';
      ctx.fillRect(x, y, layout.cellW, layout.cellH);
    }
    // 标签条
    ctx.fillStyle = '#000000';
    ctx.fillRect(x, y + layout.cellH, layout.cellW, layout.labelH);
    ctx.fillStyle = '#e0e0e0';
    ctx.font = '12px monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText(entry.label.slice(0, 40), x + 6, y + layout.cellH + layout.labelH / 2);
  }
  try {
    return canvas.toDataURL('image/png');
  } catch {
    // jsdom 等无 canvas 编码实现时，返回空串（编排逻辑已被上面执行验证）
    return '';
  }
}

/** 默认 canvas 工厂（浏览器 document.createElement）。 */
function defaultCreateCanvas(): ContactSheetCanvas {
  return document.createElement('canvas') as unknown as ContactSheetCanvas;
}

/** 默认图片加载器（浏览器）。 */
function defaultLoadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`load failed: ${url.slice(0, 32)}`));
    img.src = url;
  });
}
