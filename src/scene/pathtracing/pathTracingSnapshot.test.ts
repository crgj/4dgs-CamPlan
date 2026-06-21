import { describe, expect, it, vi } from 'vitest';
import {
  requestPathTracingSnapshot,
  subscribePathTracingSnapshot,
} from './pathTracingSnapshot';

describe('pathTracingSnapshot request bridge', () => {
  it('queues requests until PathTracerPreview subscribes', () => {
    const listener = vi.fn();
    requestPathTracingSnapshot({ samples: 4, bounces: 2 });
    const unsubscribe = subscribePathTracingSnapshot(listener);
    expect(listener).toHaveBeenCalledWith({ samples: 4, bounces: 2 });
    unsubscribe();
  });

  it('forwards requests directly while subscribed', () => {
    const listener = vi.fn();
    const unsubscribe = subscribePathTracingSnapshot(listener);
    requestPathTracingSnapshot({ samples: 8, bounces: 3 });
    expect(listener).toHaveBeenCalledWith({ samples: 8, bounces: 3 });
    unsubscribe();
  });
});
