// WDD -gemini 2026-06-19 新增符合 UE5.8 规范的通用面板包装组件，支持拖动、缩放、停靠重组以及收起折叠

import React, { useRef, useState, useEffect } from 'react';
import { usePlanner } from '@/state/store';

interface PanelWrapperProps {
  id: 'outliner' | 'inspector';
  title: string;
  children: React.ReactNode;
}

export function PanelWrapper({ id, title, children }: PanelWrapperProps) {
  const panelState = usePlanner((s) => s.layout[id]);
  const updatePanelSize = usePlanner((s) => s.updatePanelSize);
  const updatePanelPos = usePlanner((s) => s.updatePanelPos);
  const setPanelDock = usePlanner((s) => s.setPanelDock);
  const togglePanel = usePlanner((s) => s.togglePanel);
  const togglePanelCollapse = usePlanner((s) => s.togglePanelCollapse);

  const [showDockMenu, setShowDockMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭停靠菜单
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowDockMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 1. 悬浮状态下的面板拖动
  // WDD -gemini 2026-06-19 增强拖拽：在停靠模式下拖动到左/右边缘自动切换 dock，超出视口则切换为悬浮 (float)
  // #WDD-gpt  2026-06-19 - 修复重复悬空拖拽代码导致 TS1128 语法错误
  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    // 只在非悬浮状态时启用 Dock 切换逻辑
    if (panelState.dock !== 'float') {
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const screenWidth = window.innerWidth;
      const threshold = 120; // 进入边缘判定阈值(px)

      const handleMouseMove = (moveEvent: MouseEvent) => {
        // 判断是否靠左/右边缘
        if (moveEvent.clientX < threshold) {
          if (panelState.dock !== 'left') setPanelDock(id, 'left');
        } else if (moveEvent.clientX > screenWidth - threshold) {
          if (panelState.dock !== 'right') setPanelDock(id, 'right');
        } else if (panelState.dock !== 'float') {
          // 中间区域转为悬浮并继续拖动
          setPanelDock(id, 'float');
          const floatStartPos = { x: panelState.x, y: panelState.y };
          const handleFloatMove = (mv: MouseEvent) => {
            const ndx = mv.clientX - startX;
            const ndy = mv.clientY - startY;
            updatePanelPos(id, floatStartPos.x + ndx, floatStartPos.y + ndy);
          };
          const handleFloatUp = () => {
            window.removeEventListener('mousemove', handleFloatMove);
            window.removeEventListener('mouseup', handleFloatUp);
          };
          window.addEventListener('mousemove', handleFloatMove);
          window.addEventListener('mouseup', handleFloatUp);
        }
      };
      const handleMouseUp = () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return;
    }

    // 如果点在按钮上不触发拖拽
    if ((e.target as HTMLElement).closest('button')) return;

    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startPos = { x: panelState.x, y: panelState.y };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      updatePanelPos(id, startPos.x + dx, startPos.y + dy);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // 2. 面板尺寸缩放 (Resize)
  const handleResizeMouseDown = (e: React.MouseEvent, direction: 'e' | 'w' | 's' | 'se') => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = panelState.width;
    const startHeight = panelState.height;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      let newWidth = startWidth;
      let newHeight = startHeight;

      if (direction === 'e') {
        newWidth = Math.max(180, startWidth + dx);
      } else if (direction === 'w') {
        newWidth = Math.max(180, startWidth - dx);
      } else if (direction === 's') {
        newHeight = Math.max(150, startHeight + dy);
      } else if (direction === 'se') {
        newWidth = Math.max(180, startWidth + dx);
        newHeight = Math.max(150, startHeight + dy);
      }

      updatePanelSize(id, newWidth, newHeight);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  if (!panelState.show) return null;

  // 渲染停靠下拉选项
  const dockOptions = [
    { label: 'Dock Left (靠左)', val: 'left' as const },
    { label: 'Dock Right (靠右)', val: 'right' as const },
    { label: 'Float (悬浮)', val: 'float' as const },
  ];

  // 计算 CSS 样式
  const isFloat = panelState.dock === 'float';
  const isCollapsed = panelState.collapsed;

  const floatStyle: React.CSSProperties = isFloat
    ? {
        position: 'absolute',
        left: `${panelState.x}px`,
        top: `${panelState.y}px`,
        width: `${panelState.width}px`,
        height: isCollapsed ? 'auto' : `${panelState.height}px`,
        zIndex: 40,
      }
    : {
        width: `${panelState.width}px`,
      };

  return (
    <div
      style={floatStyle}
      className={`flex flex-col border border-[var(--color-panel-border)] bg-[rgba(24,24,24,0.9)] shadow-2xl backdrop-blur-md transition-all ${
        isFloat ? 'rounded-lg' : 'h-full shrink-0'
      }`}
    >
      {/* Panel Header */}
      <div
        ref={headerRef}
        onMouseDown={handleHeaderMouseDown}
        className={`flex h-8 select-none items-center justify-between border-b border-[var(--color-panel-border)] px-2 bg-[rgba(32,32,32,0.85)] ${
          isFloat ? 'cursor-move rounded-t-lg' : 'cursor-default'
        }`}
      >
        <div className="flex items-center gap-2">
          {/* 折叠/展开 箭头 */}
          <button
            onClick={() => togglePanelCollapse(id)}
            className="flex h-4 w-4 items-center justify-center text-[var(--color-text-dim)] transition-transform hover:text-white"
            style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
          >
            ▼
          </button>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text)]">
            {title}
          </span>
        </div>

        {/* 交互按钮区 */}
        <div className="flex items-center gap-1.5" ref={menuRef}>
          {/* 停靠选项按钮 */}
          <div className="relative">
            <button
              onClick={() => setShowDockMenu(!showDockMenu)}
              className="flex h-5 items-center justify-center rounded px-1 text-[10px] text-[var(--color-text-faint)] hover:bg-[rgba(255,255,255,0.06)] hover:text-white"
            >
              ⚓ {panelState.dock.toUpperCase()}
            </button>

            {showDockMenu && (
              <div className="absolute right-0 top-6 z-50 min-w-[120px] py-1 rounded border border-[var(--color-panel-border)] bg-[rgba(20,20,20,0.95)] shadow-xl">
                {dockOptions.map((opt) => (
                  <button
                    key={opt.val}
                    onClick={() => {
                      setPanelDock(id, opt.val);
                      setShowDockMenu(false);
                    }}
                    className={`flex w-full px-2.5 py-1 text-left text-[11px] hover:bg-[var(--color-accent)] hover:text-white ${
                      panelState.dock === opt.val
                        ? 'text-[var(--color-accent-cyan)] font-semibold'
                        : 'text-[var(--color-text-dim)]'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
                <div className="my-1 h-px bg-[var(--color-panel-border)]" />
                <button
                  onClick={() => {
                    togglePanel(id);
                    setShowDockMenu(false);
                  }}
                  className="flex w-full px-2.5 py-1 text-left text-[11px] text-red-400 hover:bg-red-600 hover:text-white"
                >
                  Close (关闭)
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Panel Body */}
      <div className="flex-1 min-h-0 overflow-x-hidden overflow-y-auto">{children}</div>

      {/* Resize Handle (拖拽拉伸边缘) */}
      {!isCollapsed && (
        <>
          {/* Dock Left 的右边缘缩放 */}
          {!isFloat && panelState.dock === 'left' && (
            <div
              onMouseDown={(e) => handleResizeMouseDown(e, 'e')}
              className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-[var(--color-accent)] opacity-20"
            />
          )}
          {/* Dock Right 的左边缘缩放 */}
          {!isFloat && panelState.dock === 'right' && (
            <div
              onMouseDown={(e) => handleResizeMouseDown(e, 'w')}
              className="absolute top-0 left-0 w-1.5 h-full cursor-col-resize hover:bg-[var(--color-accent)] opacity-20"
            />
          )}
          {/* Float 状态的缩放 (右、下、右下) */}
          {isFloat && (
            <>
              <div
                onMouseDown={(e) => handleResizeMouseDown(e, 'e')}
                className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize"
              />
              <div
                onMouseDown={(e) => handleResizeMouseDown(e, 's')}
                className="absolute bottom-0 left-0 w-full h-1.5 cursor-row-resize"
              />
              <div
                onMouseDown={(e) => handleResizeMouseDown(e, 'se')}
                className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize bg-[rgba(255,255,255,0.15)] rounded-br-lg hover:bg-[var(--color-accent)]"
              />
            </>
          )}
        </>
      )}
    </div>
  );
}
