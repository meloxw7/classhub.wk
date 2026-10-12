import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ToastProvider, useToast } from './Toast';

function Trigger({ message }: { message: string }) {
  const toast = useToast();
  return <button onClick={() => toast.success(message)}>disparar</button>;
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ToastProvider', () => {
  it('exibe toast de sucesso e remove após 4,2s', () => {
    vi.useFakeTimers();
    render(
      <ToastProvider>
        <Trigger message="Salvo com sucesso!" />
      </ToastProvider>
    );
    act(() => {
      screen.getByText('disparar').click();
    });
    expect(screen.getByText('Salvo com sucesso!')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(4300);
    });
    expect(screen.queryByText('Salvo com sucesso!')).not.toBeInTheDocument();
  });

  it('exibe múltiplos toasts simultâneos', () => {
    vi.useFakeTimers();
    function DoubleTrigger() {
      const toast = useToast();
      return (
        <button
          onClick={() => {
            toast.error('Erro!');
            toast.info('Info!');
          }}
        >
          disparar
        </button>
      );
    }
    render(
      <ToastProvider>
        <DoubleTrigger />
      </ToastProvider>
    );
    act(() => {
      screen.getByText('disparar').click();
    });
    expect(screen.getByText('Erro!')).toBeInTheDocument();
    expect(screen.getByText('Info!')).toBeInTheDocument();
  });
});
