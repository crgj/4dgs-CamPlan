import { beforeEach, describe, expect, it } from 'vitest';
import { resetDefaultCounters } from '@/lib/defaults';
import { usePlanner } from '@/state/store';
import { handleViewportDrop, setViewportDropPoint } from './dropTarget';

const MIME = 'application/x-planner-prototype';

function makeDropEvent(payload: object): React.DragEvent {
  const data = JSON.stringify(payload);
  return {
    preventDefault() {},
    stopPropagation() {},
    dataTransfer: {
      types: [MIME],
      getData(type: string) {
        return type === MIME ? data : '';
      },
      dropEffect: 'copy',
    },
  } as unknown as React.DragEvent;
}

beforeEach(() => {
  resetDefaultCounters();
  usePlanner.getState().resetScene();
  usePlanner.setState({ history: { past: [], future: [] } });
});

describe('dropTarget / viewport drop point', () => {
  it('鼠标与地面相交时，把拖入对象原点放在焦点位置', () => {
    setViewportDropPoint([2, 0, -3]);

    handleViewportDrop(makeDropEvent({ kind: 'subject' }));

    expect(usePlanner.getState().scene.subjects[0].transform.position).toEqual([2, 0, -3]);
  });

  it('没有地面命中时，把拖入对象创建在世界原点', () => {
    handleViewportDrop(makeDropEvent({ kind: 'subject' }));

    expect(usePlanner.getState().scene.subjects[0].transform.position).toEqual([0, 0, 0]);
  });
});
