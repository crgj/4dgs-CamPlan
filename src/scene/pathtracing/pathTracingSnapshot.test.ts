import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import {
  emitPathTracingSnapshotStatus,
  requestPathTracingSnapshot,
  subscribePathTracingSnapshot,
  subscribePathTracingSnapshotStatus,
} from './pathTracingSnapshot';
import { createPathTracingSceneSnapshot, disposePathTracingSceneSnapshot } from './pathTracingSceneSnapshot';

function waitForSnapshotDispatch(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

describe('pathTracingSnapshot request bridge', () => {
  it('queues requests until PathTracerPreview subscribes', async () => {
    const listener = vi.fn();
    const id = requestPathTracingSnapshot({ samples: 4, bounces: 2 });
    const unsubscribe = subscribePathTracingSnapshot(listener);
    await waitForSnapshotDispatch();
    expect(listener).toHaveBeenCalledWith({ id, samples: 4, bounces: 2 });
    unsubscribe();
  });

  it('forwards requests directly while subscribed', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribePathTracingSnapshot(listener);
    const id = requestPathTracingSnapshot({ samples: 8, bounces: 3 });
    await waitForSnapshotDispatch();
    expect(listener).toHaveBeenCalledWith({ id, samples: 8, bounces: 3 });
    unsubscribe();
  });

  it('broadcasts status updates', () => {
    const listener = vi.fn();
    const unsubscribe = subscribePathTracingSnapshotStatus(listener);
    emitPathTracingSnapshotStatus({ id: 999, state: 'error', message: 'failed' });
    expect(listener).toHaveBeenCalledWith({ id: 999, state: 'error', message: 'failed' });
    unsubscribe();
  });
});

describe('createPathTracingSceneSnapshot', () => {
  it('converts unsupported viewport objects and materials before path tracing', () => {
    const scene = new THREE.Scene();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.ShadowMaterial() as THREE.Material,
    );
    const line = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({ color: 0x00ff00 }),
    );
    scene.add(mesh);
    scene.add(line);
    scene.add(new THREE.PerspectiveCamera());

    const snapshot = createPathTracingSceneSnapshot(scene);
    const snapshotMeshes: THREE.Mesh[] = [];
    const snapshotLines: THREE.Line[] = [];
    snapshot.traverse((object) => {
      const maybeMesh = object as THREE.Mesh;
      if (maybeMesh.isMesh) snapshotMeshes.push(maybeMesh);
      const maybeLine = object as THREE.Line;
      if (maybeLine.isLine) snapshotLines.push(maybeLine);
    });

    expect(snapshotMeshes).toHaveLength(1);
    expect(snapshotMeshes[0].material).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect(snapshotLines).toHaveLength(0);
    disposePathTracingSceneSnapshot(snapshot);
  });

  it('replaces malformed mesh materials with real THREE.Material instances', () => {
    const scene = new THREE.Scene();
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
    (mesh as THREE.Mesh<THREE.BufferGeometry, THREE.Material>).material = {
      color: new THREE.Color(0xff0000),
    } as unknown as THREE.Material;
    scene.add(mesh);

    const snapshot = createPathTracingSceneSnapshot(scene);
    const snapshotMesh = snapshot.children.find((object) => (object as THREE.Mesh).isMesh) as THREE.Mesh;

    expect(snapshotMesh.material).toBeInstanceOf(THREE.MeshStandardMaterial);
    expect((snapshotMesh.material as THREE.Material).addEventListener).toBeTypeOf('function');
    disposePathTracingSceneSnapshot(snapshot);
  });
});
