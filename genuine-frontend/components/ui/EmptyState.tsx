import type { ReactNode } from 'react';
import { Frown } from 'lucide-react';

export function EmptyState({
  title,
  description,
  action,
  compact = false,
  className = '',
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center justify-center rounded-xl border border-rose-200 bg-rose-50/90 text-center dark:border-rose-950/70 dark:bg-[#21191b] ${compact ? 'px-3 py-4' : 'px-5 py-7'} ${className}`}>
      <span aria-hidden="true" className="mb-2 grid h-11 w-11 place-items-center rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-100 via-emerald-50 to-white text-emerald-700 shadow-inner shadow-emerald-900/10 dark:border-emerald-900/70 dark:from-emerald-950/80 dark:via-[#142019] dark:to-[#21191b] dark:text-emerald-300">
        <Frown size={23} strokeWidth={1.8} />
      </span>
      <p className="text-sm font-semibold text-[#313a31] dark:text-white">{title}</p>
      {description ? <p className="mt-1 max-w-xl text-xs leading-5 text-[#687368] dark:text-white/60">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
