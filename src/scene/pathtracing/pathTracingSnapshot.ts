export interface PathTracingSnapshotRequest {
  samples: number;
  bounces: number;
}

type SnapshotListener = (request: PathTracingSnapshotRequest) => void;

let listener: SnapshotListener | null = null;
const pending: PathTracingSnapshotRequest[] = [];

export function requestPathTracingSnapshot(request: PathTracingSnapshotRequest): void {
  // #WDD-gpt  2026-06-21 - 用模块级队列把右侧设置面板请求交给 Canvas 内的 PathTracerPreview 执行
  if (listener) listener(request);
  else pending.push(request);
}

export function subscribePathTracingSnapshot(listenerFn: SnapshotListener): () => void {
  listener = listenerFn;
  while (pending.length > 0) {
    const request = pending.shift();
    if (request) listenerFn(request);
  }
  return () => {
    if (listener === listenerFn) listener = null;
  };
}
