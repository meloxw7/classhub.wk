import { createContext, useCallback, useContext, useMemo, useState, ReactNode } from 'react';
import { CheckCircle2, Info, XCircle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

type ToastItem = {
  id: number;
  message: string;
  type: ToastType;
};

const styles: Record<ToastType, { icon: typeof Info; accent: string; text: string }> = {
  success: { icon: CheckCircle2, accent: 'border-l-emerald-500', text: 'text-emerald-700' },
  error: { icon: XCircle, accent: 'border-l-red-500', text: 'text-red-700' },
  info: { icon: Info, accent: 'border-l-blue-500', text: 'text-blue-700' },
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

  const push = useCallback(
    (type: ToastType) => (message: string) => {
      const id = Date.now() + Math.random();
      setItems((current) => [...current, { id, message, type }]);
      setTimeout(() => {
        setItems((current) => current.filter((t) => t.id !== id));
      }, 4200);
    },
    []
  );

  const success = useMemo(() => push('success'), [push]);
  const error = useMemo(() => push('error'), [push]);
  const info = useMemo(() => push('info'), [push]);

  const value = useMemo(() => ({ success, error, info }), [success, error, info]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] space-y-2 w-80 max-w-[calc(100vw-2rem)]">
        {items.map((t) => {
          const { icon: Icon, accent, text } = styles[t.type];
          return (
            <div
              key={t.id}
              className={`toast-in card shadow-lg p-4 flex items-center gap-3 border-l-4 ${accent}`}
            >
              <Icon size={20} className={`shrink-0 ${text}`} />
              <p className={`text-sm font-medium ${text}`}>{t.message}</p>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
