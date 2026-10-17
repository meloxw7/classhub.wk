import { createContext, useCallback, useContext, useRef, useState, ReactNode } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

type ConfirmOptions = {
  title: string;
  text?: string;
  confirmLabel?: string;
  danger?: boolean;
};

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(async () => true);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [loading, setLoading] = useState(false);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((next) => {
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
      setOptions(next);
    });
  }, []);

  function finish(value: boolean) {
    if (resolver.current) {
      resolver.current(value);
      resolver.current = null;
    }
    setLoading(false);
    setOptions(null);
  }

  async function onConfirm() {
    setLoading(true);
    finish(true);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      {options && (
        <div className="backdrop-in fixed inset-0 z-[110] grid place-items-center bg-slate-950/50 p-4">
          <div className="pop-in origin-in-center card p-6 w-full max-w-sm">
            <div className="flex items-start gap-3">
              <div
                className={`p-2 rounded-xl ${
                  options.danger ? 'bg-red-50 text-red-600' : 'bg-violet-50 text-violet-600'
                }`}
              >
                <AlertTriangle size={20} />
              </div>

              <div>
                <h3 className="font-bold">{options.title}</h3>

                {options.text && <p className="muted mt-1">{options.text}</p>}
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-6">
              <button className="btn-secondary" onClick={() => finish(false)} disabled={loading}>
                Cancelar
              </button>

              <button
                className={
                  options.danger ? 'btn bg-red-600 text-white hover:bg-red-700' : 'btn-primary'
                }
                onClick={onConfirm}
                disabled={loading}
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                {options.confirmLabel || 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);
