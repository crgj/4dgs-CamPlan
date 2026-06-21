import type { LightDef } from '@/types';

export type PanelIconKind =
  | 'camera'
  | 'pointLight'
  | 'spotLight'
  | 'directionalLight'
  | 'subject'
  | 'calibration'
  | 'composite';

export function iconKindForLight(lightKind: LightDef['lightKind']): PanelIconKind {
  if (lightKind === 'spot') return 'spotLight';
  if (lightKind === 'directional') return 'directionalLight';
  return 'pointLight';
}

function dragIconMarkup(kind: PanelIconKind): string {
  const elementByKind: Record<PanelIconKind, string> = {
    camera:
      '<path d="M4 7.5h3l1.35-2h4.3l1.35 2h6a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 20 19H4a1.5 1.5 0 0 1-1.5-1.5V9A1.5 1.5 0 0 1 4 7.5Z"/><circle cx="12" cy="13" r="3.3"/><path d="M18.5 10.2h.01"/>',
    pointLight:
      '<circle cx="12" cy="12" r="3.3"/><path d="M12 2.8v2.1M12 19.1v2.1M2.8 12h2.1M19.1 12h2.1M5.5 5.5 7 7M17 17l1.5 1.5M18.5 5.5 17 7M7 17l-1.5 1.5"/>',
    spotLight:
      '<path d="M5.5 7.2 12 4l6.5 3.2-3.2 4.1H8.7L5.5 7.2Z"/><path d="m9 11.3-2.3 8M15 11.3l2.3 8M8.5 16.5h7"/><path d="M9.2 7.4h5.6"/>',
    directionalLight:
      '<circle cx="7" cy="7" r="2.8"/><path d="M12.5 6.5h7M15.8 3.2l3.7 3.3-3.7 3.3M10.5 13h7M13.8 9.7l3.7 3.3-3.7 3.3M8.5 19.5h7M11.8 16.2l3.7 3.3-3.7 3.3"/>',
    subject:
      '<path d="M12 3.5 20 8l-8 4.5L4 8l8-4.5Z"/><path d="M4 8v8l8 4.5 8-4.5V8M12 12.5v8"/>',
    calibration:
      '<rect x="4" y="4" width="16" height="16" rx="1.5"/><path d="M4 9.3h16M4 14.7h16M9.3 4v16M14.7 4v16"/>',
    composite:
      '<rect x="3.5" y="5" width="7" height="7" rx="1"/><rect x="13.5" y="5" width="7" height="7" rx="1"/><rect x="8.5" y="14" width="7" height="7" rx="1"/>',
  };
  return elementByKind[kind];
}

export function setIconDragImage(dataTransfer: DataTransfer, kind: PanelIconKind): void {
  if (typeof document === 'undefined' || !dataTransfer.setDragImage) return;

  const ghost = document.createElement('div');
  ghost.style.position = 'fixed';
  ghost.style.left = '-1000px';
  ghost.style.top = '-1000px';
  ghost.style.width = '34px';
  ghost.style.height = '34px';
  ghost.style.display = 'flex';
  ghost.style.alignItems = 'center';
  ghost.style.justifyContent = 'center';
  ghost.style.border = '1px solid #0a8fef';
  ghost.style.borderRadius = '3px';
  ghost.style.background = '#1c1c1c';
  ghost.style.color = '#0a8fef';
  ghost.style.boxShadow = '0 2px 8px rgba(0,0,0,0.35)';
  ghost.innerHTML = `<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${dragIconMarkup(kind)}</svg>`;

  document.body.appendChild(ghost);
  dataTransfer.setDragImage(ghost, 17, 17);
  window.setTimeout(() => ghost.remove(), 0);
}
