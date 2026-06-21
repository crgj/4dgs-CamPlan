/**
 * T-033 Message Log / Output Log（src/panels/MessageLog.tsx）。
 * 参考 UE5.8 Output Log：底部非阻塞日志面板，info/warn/error 分级着色。
 * 取代 MenuBar 里的 alert/confirm（BUG-011）。
 *
 * 日志来源：store.logs（由各操作 log() 写入）。本组件只读 + 清空。
 */
import { useEffect, useRef } from 'react';
import { usePlanner, type LogLevel } from '@/state/store';
import { useTranslation } from '@/lib/i18n';

const levelStyles: Record<LogLevel, string> = {
  info: 'text-[var(--color-text-dim)]',
  warn: 'text-[#e0a030]',
  error: 'text-[#e05050]',
};

const levelPrefix: Record<LogLevel, string> = {
  info: 'INFO',
  warn: 'WARN',
  error: 'ERROR',
};

export function MessageLog() {
  const { locale } = useTranslation();
  const logs = usePlanner((s) => s.logs);
  const clearLogs = usePlanner((s) => s.clearLogs);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 新日志时自动滚到底
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs]);

  const counts = logs.reduce(
    (acc, l) => {
      acc[l.level] += 1;
      return acc;
    },
    { info: 0, warn: 0, error: 0 } as Record<LogLevel, number>,
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--color-panel)] text-[var(--color-text)]">
      <div className="flex h-7 shrink-0 items-center justify-between border-b border-[var(--color-panel-border)] bg-[var(--color-panel-header)] px-2">
        <div className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-dim)]">
          <span>{locale === 'zh' ? '输出日志' : 'Output Log'}</span>
          {counts.error > 0 && (
            <span className="text-[#e05050]">{counts.error} {locale === 'zh' ? '错误' : 'err'}</span>
          )}
          {counts.warn > 0 && (
            <span className="text-[#e0a030]">{counts.warn} {locale === 'zh' ? '警告' : 'warn'}</span>
          )}
        </div>
        <button
          type="button"
          onClick={clearLogs}
          className="rounded-[var(--radius-sm)] border border-[var(--color-panel-border)] bg-[var(--color-recessed)] px-2 py-0.5 text-[10px] text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
        >
          {locale === 'zh' ? '清空' : 'Clear'}
        </button>
      </div>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-2 py-1 font-mono text-[11px] leading-relaxed">
        {logs.length === 0 ? (
          <div className="py-4 text-center text-[var(--color-text-faint)]">
            {locale === 'zh' ? '暂无日志' : 'No messages'}
          </div>
        ) : (
          logs.map((l) => {
            const time = l.at.slice(11, 19);
            return (
              <div key={l.id} className={`whitespace-pre-wrap break-words ${levelStyles[l.level]}`}>
                <span className="text-[var(--color-text-faint)]">[{time}]</span>{' '}
                <span className="font-bold">{levelPrefix[l.level]}</span> {l.message}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
