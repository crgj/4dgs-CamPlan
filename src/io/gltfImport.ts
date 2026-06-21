/**
 * T-081 PBR 资产导入（src/io/gltfImport.ts）。
 * glTF/GLB 加载 + KTX2 纹理解码 + 色彩空间归一化（线性工作流）。
 * 浏览器端用 three GLTFLoader + KTX2Loader；返回 THREE.Group。
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

let loader: GLTFLoader | null = null;

/** 懒初始化带 KTX2/DRACO 解码器的 GLTFLoader。 */
function getLoader(renderer?: THREE.WebGLRenderer): GLTFLoader {
  if (loader) return loader;
  loader = new GLTFLoader();
  const ktx2 = new KTX2Loader();
  if (renderer) ktx2.detectSupport(renderer);
  loader.setKTX2Loader(ktx2);
  loader.setDRACOLoader(new DRACOLoader());
  return loader;
}

export interface ImportedModel {
  /** 根 Group，可直接加入场景。 */
  scene: THREE.Group;
  /** 三角面数。 */
  triangles: number;
  /** 纹理依赖列表。 */
  textures: string[];
}

/**
 * 从 URL 加载 glTF/GLB 模型，归一化色彩空间与材质。
 * @param url 模型地址。
 * @param renderer 用于 KTX2 能力检测（可选）。
 */
export function loadGltfModel(url: string, renderer?: THREE.WebGLRenderer): Promise<ImportedModel> {
  return new Promise((resolve, reject) => {
    const l = getLoader(renderer);
    l.load(
      url,
      (gltf) => {
        const scene = gltf.scene;
        // 归一化：所有纹理设为 sRGB 色彩空间（color maps），材质用默认线性
        let triangles = 0;
        const textures: string[] = [];
        scene.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (mesh.isMesh) {
            const geom = mesh.geometry;
            if (geom.index) triangles += geom.index.count / 3;
            else if (geom.attributes.position) triangles += geom.attributes.position.count / 3;
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            for (const m of mats) {
              const pbr = m as THREE.MeshStandardMaterial;
              for (const tex of [pbr.map, pbr.normalMap, pbr.roughnessMap, pbr.metalnessMap, pbr.aoMap, pbr.emissiveMap]) {
                if (tex) {
                  if (tex === pbr.map || tex === pbr.emissiveMap) tex.colorSpace = THREE.SRGBColorSpace;
                  const src = (tex.image as { src?: string } | undefined)?.src;
                  if (src && !textures.includes(src)) textures.push(src);
                }
              }
            }
          }
        });
        resolve({ scene, triangles: Math.round(triangles), textures });
      },
      undefined,
      (err) => reject(err),
    );
  });
}
