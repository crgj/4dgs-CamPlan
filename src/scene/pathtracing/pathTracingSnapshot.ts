export interface PathTracingSnapshotRequest {
  id: number;
  samples: number;
  bounces: number;
}

export type PathTracingSnapshotStatus =
  | { id: number; state: 'queued' | 'rendering'; message: string }
  | { id: number; state: 'complete'; message: string; dataURL: string; filename: string }
  | { id: number; state: 'error'; message: string };

type SnapshotListener = (request: PathTracingSnapshotRequest) => void;
type StatusListener = (status: PathTracingSnapshotStatus) => void;

let listener: SnapshotListener | null = null;
const pending: PathTracingSnapshotRequest[] = [];
const statusListeners = new Set<StatusListener>();
let nextId = 1;

export function requestPathTracingSnapshot(request: Omit<PathTracingSnapshotRequest, 'id'>): number {
  const fullRequest = { ...request, id: nextId++ };
  // #WDD-gpt  2026-06-21 - 用模块级队列把右侧设置面板请求交给 Canvas 内的 PathTracerPreview 执行
  emitPathTracingSnapshotStatus({
    id: fullRequest.id,
    state: listener ? 'rendering' : 'queued',
    message: listener ? 'PT snapshot request sent' : 'Waiting for viewport renderer',
  });
  if (listener) listener(fullRequest);
  else pending.push(fullRequest);
  return fullRequest.id;
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

export function subscribePathTracingSnapshotStatus(listenerFn: StatusListener): () => void {
  statusListeners.add(listenerFn);
  return () => statusListeners.delete(listenerFn);
}

export function emitPathTracingSnapshotStatus(status: PathTracingSnapshotStatus): void {
  statusListeners.forEach((listenerFn) => listenerFn(status));
}
