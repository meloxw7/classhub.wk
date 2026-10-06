import { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-200 rounded-xl ${className}`} />;
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
    <div className="card p-10 col-span-full flex flex-col items-center text-center">
      <div className="p-4 bg-slate-100 text-slate-400 rounded-full">
        <Icon size={28} />
      </div>
      <h3 className="font-bold mt-4">{title}</h3>
      {text && <p className="muted mt-1">{text}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
