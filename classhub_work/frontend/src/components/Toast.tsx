import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

type ToastItem = {
  id: number;
  message: string;
  type: ToastType;
  duration: number;
};

const styles: Record<ToastType, { icon: typeof Info; bg: string; bar: string }> = {
  success: { icon: CheckCircle2, bg: 'bg-emerald-50 text-emerald-600', bar: 'bg-emerald-500' },
  error: { icon: XCircle, bg: 'bg-red-50 text-red-600', bar: 'bg-red-500' },
  info: { icon: Info, bg: 'bg-violet-50 text-violet-600', bar: 'bg-violet-500' },
};

type ToastApi = {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

const ToastContext = createContext<ToastApi>({
  success: () => {},
  error: () => {},
  info: () => {},
});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (type: ToastType) => (message: string) => {
      const duration = type === 'error' ? 6000 : 4200;
      const id = Date.now() + Math.random();
      setItems((current) => [...current, { id, message, type, duration }]);
      setTimeout(() => dismiss(id), duration);
    },
    [dismiss]
  );

  const success = useMemo(() => push('success'), [push]);
  const error = useMemo(() => push('error'), [push]);
  const info = useMemo(() => push('info'), [push]);

  const value = useMemo(() => ({ success, error, info }), [success, error, info]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-20 md:bottom-4 right-4 z-[100] space-y-2 w-80 max-w-[calc(100vw-2rem)]">
        {items.map((t) => {
          const { icon: Icon, bg, bar } = styles[t.type];
          return (
            <div
              key={t.id}
              className="toast-in relative overflow-hidden bg-white dark:bg-[#14141a] shadow-lg border border-slate-200/80 dark:border-slate-700 rounded-2xl"
            >
              <div className="flex items-center gap-3 p-4 pr-10">
                <span className={`p-2 rounded-xl shrink-0 ${bg}`}>
                  <Icon size={16} />
                </span>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  {t.message}
                </p>
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="absolute top-3 right-3 p-1 rounded-lg text-slate-300 hover:text-slate-600 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                aria-label="Fechar"
              >
                <X size={14} />
              </button>
              <span
                className={`toast-progress absolute bottom-0 left-0 h-0.5 rounded-full ${bar}`}
                style={{ animationDuration: `${t.duration}ms` }}
              />
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
