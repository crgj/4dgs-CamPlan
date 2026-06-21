/**
 * 运行时 USDZ 缩略图渲染（src/lib/thumbnailRenderer.ts）。
 *
 * 在主 Canvas 之外用独立 WebGLRenderer 渲染一帧模型快照，toDataURL 存到
 * LibraryAsset.thumbnail，供 LibraryBrowser 卡片显示。避免引入 headless-gl/
 * puppeteer 等依赖——直接用浏览器已有的 WebGL 能力（环境有 NVIDIA 4090）。
 *
 * 设计：
 *   - 每次调用建一个临时 canvas+renderer，渲染完销毁释放内存（GL 上下文数量有限）。
 *   - 自动相机：算 Box3，定位到能框住模型的 3/4 俯视角。
 *   - 串行队列：避免并发开多个 GL 上下文（9 个模型逐个渲染）。
 *   - 失败返回 null，调用方降级为 IconFrame。
 *
 * #WDD-gpt 2026-06-21 - 改为「无光照」渲染：把每个 mesh 的材质换成 MeshBasicMaterial，
 * 直接显示纹理/基础颜色，不依赖任何光源。这样缩略图颜色最接近模型本身的贴图原色，
 * 不受光照角度/暗部/IBL 影响。无灯光、无 environment、无 tone mapping。
 */
import * as THREE from 'three';
import { USDLoader } from 'three/examples/jsm/loaders/USDLoader.js';

const SIZE = 160; // 缩略图边长（px）

/** 单个模型缩略图渲染缓存（src → dataURL），进程内避免重复渲染。 */
const cache = new Map<string, string | null>();

/** 串行队列：同一时刻只渲染一个，避免并发 GL 上下文。 */
let chain: Promise<unknown> = Promise.resolve();

/**
 * 渲染一个 USDZ 模型的缩略图。
 * @returns dataURL（PNG）；失败或无 WebGL 返回 null。
 */
export function renderUsdzThumbnail(src: string): Promise<string | null> {
  // 已缓存（含失败 null）直接返回
  if (cache.has(src)) return Promise.resolve(cache.get(src) ?? null);
  // 入串行队列
  const p = chain.then(() => renderOnce(src)).then(
    (url) => {
      cache.set(src, url);
      return url;
    },
    () => {
      cache.set(src, null);
      return null;
    },
  );
  chain = p;
  return p;
}

/**
 * 把 mesh 的材质替换为不受光照的 MeshBasicMaterial，直接显示纹理/基础颜色。
 *
 * 处理两类常见 USD 材质问题，确保缩略图鲜艳清晰：
 *   1. 有漫反射贴图但偏暗（游戏美术常把 albedo 调暗以便配合光照）→ 用 BRIGHTEN 倍率
 *      把 color 设为 >1（MeshBasicMaterial 最终色 = map × color），把暗纹理提亮。
 *   2. 无贴图且 color 为黑（mask/辅助面/USDComposer 未解析的着色器）→ 退化为浅灰，
 *      避免缩略图被黑块遮挡（纯白会过曝发灰，浅灰 #c8c8c8 更中性）。
 *
 * #WDD-gpt 2026-06-21 - 用户要求「直接显示纹理颜色、不用光照」；纯 unlit 会把暗 albedo
 * 原样显示（偏黑），故加适度提亮让缩略图鲜艳可辨。
 */
function applyUnlitMaterial(root: THREE.Object3D): void {
  // 提亮倍率：暗 albedo × BRIGHTEN（>1）→ 鲜艳。MeshBasicMaterial 输出 = map * color，clamp 到 [0,1]。
  // 取 3.0：游戏美术常把 albedo 做得偏暗（配合光照），3× 能让暗纹理（如 North texAvg 22）提到 ~66 仍可辨。
  const BRIGHTEN = 3.0;
  const FALLBACK = new THREE.Color(0xb8b8b8); // 无贴图黑面的中性兜底色
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const src = child.material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[] | undefined;
    const toBasic = (m: THREE.MeshStandardMaterial): THREE.MeshBasicMaterial => {
      const srcColor = (m.color ?? new THREE.Color(0xffffff)).clone();
      const dark = srcColor.r < 0.02 && srcColor.g < 0.02 && srcColor.b < 0.02;
      let color: THREE.Color;
      if (m.map) {
        // 有贴图：用 >1 倍率提亮（color × map）。源 color 若是白则纯放大；非白则各自放大。
        color = srcColor.clone().multiplyScalar(BRIGHTEN);
      } else if (dark) {
        // 无贴图 + 黑：中性浅灰兜底
        color = FALLBACK.clone();
      } else {
        // 无贴图但有色：提亮显示
        color = srcColor.clone().multiplyScalar(BRIGHTEN);
      }
      // 纹理在缩略图的独立 WebGLRenderer 里需要重新上传；标记 needsUpdate 触发上传。
      if (m.map) m.map.needsUpdate = true;
      return new THREE.MeshBasicMaterial({
        map: m.map ?? null,
        color,
        transparent: m.transparent,
        opacity: m.opacity,
      });
    };
    child.material = Array.isArray(src)
      ? src.map(toBasic)
      : toBasic((src as THREE.MeshStandardMaterial) ?? new THREE.MeshStandardMaterial({ color: 0xffffff }));
  });
}

/**
 * 等待模型所有纹理贴图解码完成。
 * USDLoader（USDComposer）的纹理用 `new Image()` + `image.onload` 异步赋值 `texture.image`，
 * 而 `loader.loadAsync` 的 Promise 在 onload 之前就 resolve——直接渲染会得到无图的黑色。
 * 这里轮询直到所有 map.image 存在（带超时兜底）。
 */
async function waitForTextures(root: THREE.Object3D, timeoutMs = 1500): Promise<void> {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() <= deadline) {
    let pending = 0;
    root.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const m of mats) {
        const map = (m as THREE.MeshStandardMaterial)?.map;
        if (map && !map.image) pending += 1;
      }
    });
    if (pending === 0) return;
    if (performance.now() > deadline) return;
    await new Promise((r) => setTimeout(r, 16));
  }
}

/** 单次渲染（建临时 renderer）。 */
async function renderOnce(src: string): Promise<string | null> {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  let renderer: THREE.WebGLRenderer | null = null;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    renderer.setSize(SIZE, SIZE);
    renderer.setClearColor(0x222428, 1); // 中性暗底，比纯黑更亮便于辨识
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    // 无 tone mapping：缩略图直接显示纹理原色，不被 ACES 压暗
    renderer.toneMapping = THREE.NoToneMapping;

    // 无光照场景：不放任何光源、不放 environment。MeshBasicMaterial 不需要光即可显示颜色。
    const scene = new THREE.Scene();

    // 加载 USD
    const loader = new USDLoader();
    const group = await loader.loadAsync(src);
    // #WDD-gpt 2026-06-21 - USDLoader 的纹理是异步加载（image.onload 在 loadAsync resolve 之后），
    // 必须等 map.image 就绪再渲染，否则 MeshBasicMaterial 取不到图 → 缩略图全黑。
    await waitForTextures(group);
    // 无光照化：所有 mesh 换 MeshBasicMaterial，直接显示纹理颜色
    applyUnlitMaterial(group);
    scene.add(group);

    // 自动相机：算包围盒，确保缩略图包含整个模型
    // #WDD-gpt 2026-06-21 - 精确计算 AABB：显式遍历所有 mesh 的 world-space boundingBox 来累加，
    // 避免 SkinnedMesh 的 boundingSphere 不准确导致模型被裁剪。
    const preciseBox = new THREE.Box3();
    group.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        if (!child.geometry.boundingBox) {
          child.geometry.computeBoundingBox();
        }
        if (child.geometry.boundingBox) {
          // expandByObject 会自动应用 mesh 的 world matrix，得到 world-space AABB
          preciseBox.expandByObject(child);
        }
      }
    });
    // 如果遍历失败（如没有任何 mesh 有 boundingBox），回退到 setFromObject
    const finalBox = preciseBox.isEmpty() ? new THREE.Box3().setFromObject(group) : preciseBox;
    const center = finalBox.getCenter(new THREE.Vector3());

    // 计算包围球半径，确保相机距离能框住整个模型（最保守的估算）
    const sphere = finalBox.getBoundingSphere(new THREE.Sphere());
    const fov = 35;
    const fovRad = (fov * Math.PI) / 180;
    const tanHalfFov = Math.tan(fovRad / 2);
    // 相机距离 = 包围球半径 / tan(fov/2) * 边距系数
    // 1.4 倍边距：确保模型完整入框，不留白边但也不截断
    const dist = (sphere.radius / tanHalfFov) * 1.4;
    const camera = new THREE.PerspectiveCamera(fov, 1, dist * 0.01, dist * 10);
    // 3/4 俯视角度（从前右上方看）
    const dir = new THREE.Vector3(0.6, 0.45, 0.6).normalize();
    camera.position.copy(center).sub(dir.clone().multiplyScalar(dist));
    camera.lookAt(center);

    renderer.render(scene, camera);
    return canvas.toDataURL('image/png');
  } catch (err) {
    console.warn('[thumbnail] 渲染失败', src, err);
    return null;
  } finally {
    // 释放 GL 上下文
    if (renderer) {
      renderer.dispose();
      // 强制释放：某些浏览器需要 loseContext
      const lose = renderer.getContext().getExtension('WEBGL_lose_context');
      lose?.loseContext();
    }
    // 移除 canvas 引用
    canvas.remove();
  }
}

/** 清空缓存（强制重渲染，调试用）。 */
export function clearThumbnailCache(): void {
  cache.clear();
}
