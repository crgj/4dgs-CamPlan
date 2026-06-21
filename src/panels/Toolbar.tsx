// WDD -gemini 2026-06-19 工具栏组件重构：全面支持 i18n 双语翻译与实体快速创建

import { usePlanner } from '@/state/store';
import { useTranslation } from '@/lib/i18n';
import type { LightDef } from '@/types';
import { PanelIcon } from './panelIcons';
import { iconKindForLight, setIconDragImage, type PanelIconKind } from './panelIconUtils';

type Prototype =
  | { kind: 'camera' }
  | { kind: 'light'; lightKind: LightDef['lightKind'] }
  | { kind: 'subject' };

export function Toolbar() {
  const { locale } = useTranslation();
  const addCamera = usePlanner((s) => s.addCamera);
  const addLight = usePlanner((s) => s.addLight);
  const addSubject = usePlanner((s) => s.addSubject);

  const add = (p: Prototype) => {
    if (p.kind === 'camera') addCamera();
    else if (p.kind === 'light') addLight(p.lightKind);
    else addSubject();
  };

  const prototypes = [
    {
      label: locale === 'zh' ? '摄像机' : 'Camera',
      proto: { kind: 'camera' as const },
      icon: 'camera' as const,
      hint: locale === 'zh' ? '拖拽或点击添加相机 (Camera)' : 'Drag or click to add camera',
    },
    {
      label: locale === 'zh' ? '点光源' : 'Point Light',
      proto: { kind: 'light' as const, lightKind: 'point' as const },
      icon: iconKindForLight('point'),
      hint: locale === 'zh' ? '拖拽或点击添加点光源 (Point Light)' : 'Drag or click to add point light',
    },
    {
      label: locale === 'zh' ? '聚光灯' : 'Spot Light',
      proto: { kind: 'light' as const, lightKind: 'spot' as const },
      icon: iconKindForLight('spot'),
      hint: locale === 'zh' ? '拖拽或点击添加聚光灯 (Spot Light)' : 'Drag or click to add spot light',
    },
    {
      label: locale === 'zh' ? '平行光' : 'Directional Light',
      proto: { kind: 'light' as const, lightKind: 'directional' as const },
      icon: iconKindForLight('directional'),
      hint: locale === 'zh' ? '拖拽或点击添加平行光 (Directional Light)' : 'Drag or click to add directional light',
    },
    {
      label: locale === 'zh' ? '主体' : 'Subject',
      proto: { kind: 'subject' as const },
      icon: 'subject' as const,
      hint: locale === 'zh' ? '拖拽或点击添加采样主体 (Subject)' : 'Drag or click to add subject',
    },
  ] satisfies Array<{ label: string; proto: Prototype; icon: PanelIconKind; hint: string }>;

  return (
    <div className="flex items-center gap-1.5">
      {prototypes.map(({ label, proto, icon, hint }) => (
        <button
          key={label}
          title={hint}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('application/x-planner-prototype', JSON.stringify(proto));
            e.dataTransfer.effectAllowed = 'copy';
            setIconDragImage(e.dataTransfer, icon);
          }}
          onClick={() => add(proto)}
          className="flex h-7 items-center gap-1.5 rounded-[var(--radius-sm)] border border-[rgba(255,255,255,0.05)] bg-[rgba(255,255,255,0.02)] px-2.5 text-[11px] font-medium text-[var(--color-text-dim)] hover:border-[var(--color-panel-border)] hover:bg-[var(--color-panel-raised)] hover:text-[var(--color-text)] active:border-[var(--color-accent)] transition-all"
        >
          <span className="text-[var(--color-accent)]">
            <PanelIcon kind={icon} className="h-3.5 w-3.5" />
          </span>
          {label}
        </button>
      ))}
    </div>
  );
}
