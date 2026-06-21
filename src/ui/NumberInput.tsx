/**
 * #WDD -gemini 2026-06-19 新建数值调节控件 NumberInput.tsx
 * Unreal Editor 5.8 风格的高阶数值控制框：
 * - 支持按住标签或边框左右拖动 (Scrub-drag) 快速调节数值
 * - 拖动时：Shift 键 10 倍增量，Ctrl/Meta 键 0.1 倍增量
 * - 拖动开始时自动 commitHistory() 建立撤销快照，拖动中 withHistory=false 实时刷新，实现一次拖拽计一个撤销步
 * - 双击切换为文本输入模式，支持键盘 Enter (确认) 和 Escape (还原撤销)
 * - 支持指定 X/Y/Z 轴线装饰线，贴合 DCC 软件色彩规范
 */
import React, { useState, useRef } from 'react';

interface NumberInputProps {
  label?: string; // 比如 "X", "Y", "Z"
  value: number;
  /** 多选 Mixed Value：true 时显示 “—” 占位，编辑时清空混合值并写入所有选中实体。 */
  mixed?: boolean;
  onChange: (val: number, withHistory?: boolean) => void;
  onCommitHistory?: () => void;
  min?: number;
  max?: number;
  step?: number; // 默认步长，例如 0.1 或 1
  precision?: number; // 保留小数位数
  axisColorClass?: string; // 轴线颜色样式类
  suffix?: string; // 后缀如 "m" 或 "°"
  className?: string;
}

export function NumberInput({
  label,
  value,
  mixed = false,
  onChange,
  onCommitHistory,
  min = -Infinity,
  max = Infinity,
  step = 0.05,
  precision = 2,
  axisColorClass,
  suffix,
  className = '',
}: NumberInputProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const startXRef = useRef(0);
  const startValRef = useRef(0);
  const isMovedRef = useRef(false);
  // BUG-008 修复：进入编辑时记录“编辑前的原始值”，Esc 用它还原（而非已被实时回写污染的 value prop）。
  const preEditValueRef = useRef(0);

  // 格式化输出
  const getFormattedValue = (val: number) => {
    if (isNaN(val) || !isFinite(val)) return '0.00';
    return val.toFixed(precision);
  };

  // 双击变编辑框
  const handleDoubleClick = () => {
    preEditValueRef.current = value; // 记录编辑前的原始值，供 Esc 还原
    setIsEditing(true);
    setInputValue(value.toString());
  };

  // 处理文本框修改
  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    const parsed = parseFloat(e.target.value);
    if (!isNaN(parsed)) {
      const clamped = Math.min(max, Math.max(min, parsed));
      onChange(clamped, false); // 输入中实时回写但不添加撤销步
    }
  };

  // 确认修改（回车或失焦）
  const handleConfirm = () => {
    const parsed = parseFloat(inputValue);
    if (!isNaN(parsed)) {
      const clamped = Math.min(max, Math.max(min, parsed));
      onChange(clamped, true); // 最终确认，记入历史撤销步
    }
    setIsEditing(false);
  };

  // 键盘事件（Enter 确认，Esc 还原到编辑前的值）
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleConfirm();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      // BUG-008：用编辑前的原始值还原，而非可能已被 handleTextChange 实时回写污染的 value prop。
      onChange(preEditValueRef.current, false);
    }
  };

  // 鼠标按下，开始拖动 (Scrub)
  const handleMouseDown = (e: React.MouseEvent) => {
    // 排除右键和已在编辑状态的点击
    if (e.button !== 0 || isEditing) return;
    e.preventDefault();

    startXRef.current = e.clientX;
    startValRef.current = value;
    isMovedRef.current = false;
    setIsDragging(true);

    // 拖拽前先打点记录撤销状态
    if (onCommitHistory) {
      onCommitHistory();
    }

    const handleMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      const dx = moveEvent.clientX - startXRef.current;
      if (Math.abs(dx) > 2) {
        isMovedRef.current = true;
      }

      // 根据修饰键微调步长
      let multiplier = 1;
      if (moveEvent.shiftKey) multiplier = 10;
      if (moveEvent.ctrlKey || moveEvent.metaKey) multiplier = 0.1;

      const delta = dx * step * multiplier;
      const nextVal = startValRef.current + delta;
      const clamped = Math.min(max, Math.max(min, nextVal));
      onChange(clamped, false); // 拖动中实时改变但暂不记历史
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      setIsDragging(false);
      document.body.style.cursor = '';

      // 拖拽结束后也确认最终值（Zustand 仅在 mousedown 时记录了初始快照，
      // 现在的最终修改结果会形成唯一的撤销历史点）
      if (isMovedRef.current) {
        onChange(value, false); // 最终值在拖动过程中已被实时写入
      } else {
        // 没有发生拖拽，只是一次普通点击
        handleDoubleClick();
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
  };

  return (
    <div
      className={`relative flex h-[var(--control-h)] items-center select-none rounded-[var(--radius-sm)] border border-[var(--color-panel-border)] bg-[var(--color-recessed)] text-[var(--text-base)] ${
        axisColorClass ? `pl-1.5 ${axisColorClass}` : 'px-1'
      } ${isDragging ? 'border-[var(--color-accent)]' : ''} ${className}`}
      onMouseDown={handleMouseDown}
      style={{
        cursor: isEditing ? 'text' : 'col-resize',
      }}
    >
      {/* 轴向标签 (X/Y/Z) */}
      {label && !isEditing && (
        <span className="mr-1.5 font-bold opacity-60 text-[var(--color-text-dim)]">
          {label}
        </span>
      )}

      {/* 数值展现 */}
      {isEditing ? (
        <input
          type="number"
          className="w-full h-full bg-transparent text-[var(--color-text)] border-none outline-none focus:ring-0 p-0 text-left font-mono"
          value={inputValue}
          onChange={handleTextChange}
          onBlur={handleConfirm}
          onKeyDown={handleKeyDown}
          autoFocus
        />
      ) : (
        <div className="flex flex-1 items-center justify-between font-mono">
          <span className={`text-[var(--color-text)] ${mixed ? 'opacity-50 italic' : ''}`}>
            {mixed ? '—' : getFormattedValue(value)}
          </span>
          {suffix && (
            <span className="text-[var(--text-label)] text-[var(--color-text-faint)] select-none ml-1">
              {suffix}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
