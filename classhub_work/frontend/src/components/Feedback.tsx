import { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse shimmer bg-slate-100 rounded-xl ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="card p-5 space-y-3">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  text,
  children,
}: {
  icon?: typeof Inbox;
  title: string;
  text?: string;
  children?: ReactNode;
}) {
  return (
    <div className="card p-10 col-span-full flex flex-col items-center text-center group">
      <div className="relative">
        <div className="float-soft absolute -inset-3 bg-gradient-to-br from-violet-100/70 to-fuchsia-100/50 dark:from-violet-900/40 dark:to-fuchsia-900/30 rounded-full blur-lg" />
        <div className="relative p-4 bg-violet-50 text-violet-500 dark:bg-violet-950 dark:text-violet-400 rounded-full transition-transform duration-300 group-hover:scale-110">
          <Icon size={28} />
        </div>
      </div>
      <h3 className="font-bold mt-5">{title}</h3>
      {text && <p className="muted mt-1">{text}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
