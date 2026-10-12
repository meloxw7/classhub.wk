import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { ConfirmProvider, useConfirm } from './ConfirmDialog';

function Trigger() {
  const confirm = useConfirm();
  return (
    <button
      onClick={async () => {
        const ok = await confirm({ title: 'Excluir item?', text: 'Esta ação não pode ser desfeita.' });
        window.dispatchEvent(new CustomEvent('confirm-result', { detail: ok }));
      }}
    >
      perguntar
    </button>
  );
}

afterEach(() => {
  cleanup();
});

function renderDialog() {
  const user = userEvent.setup();
  const results: boolean[] = [];
  window.addEventListener('confirm-result', ((e: CustomEvent) => {
    results.push(e.detail as boolean);
  }) as EventListener);
  render(
    <ConfirmProvider>
      <Trigger />
    </ConfirmProvider>
  );
  return { user, results };
}

describe('ConfirmDialog', () => {
  it('responde true ao confirmar', async () => {
    const { user, results } = renderDialog();
    await user.click(screen.getByText('perguntar'));
    expect(screen.getByText('Excluir item?')).toBeInTheDocument();
    expect(screen.getByText('Esta ação não pode ser desfeita.')).toBeInTheDocument();
    await user.click(screen.getByText('Confirmar'));
    expect(results).toEqual([true]);
  });

  it('responde false ao cancelar', async () => {
    const { user, results } = renderDialog();
    await user.click(screen.getByText('perguntar'));
    await user.click(screen.getByText('Cancelar'));
    expect(results).toEqual([false]);
  });

  it('usa rótulo personalizado e visual de perigo', async () => {
    const user = userEvent.setup();
    function DangerTrigger() {
      const confirm = useConfirm();
      return (
        <button onClick={() => confirm({ title: 'Apagar tudo?', confirmLabel: 'Apagar', danger: true })}>
          perguntar
        </button>
      );
    }
    render(
      <ConfirmProvider>
        <DangerTrigger />
      </ConfirmProvider>
    );
    await user.click(screen.getByText('perguntar'));
    expect(screen.getByText('Apagar')).toBeInTheDocument();
    expect(screen.getByText('Apagar').className).toContain('bg-red-600');
  });

  it('não abre diálogo fora do provider padrão', async () => {
    // contexto isolado: confirm padrão (fora do provider) sempre resolve true
    let resolved: boolean | undefined;
    function Bare() {
      const confirm = useConfirm();
      return (
        <button
          onClick={async () => {
            resolved = await confirm({ title: 'X' });
          }}
        >
          perguntar
        </button>
      );
    }
    render(<Bare />);
    await act(async () => {
      screen.getByText('perguntar').click();
    });
    expect(resolved).toBe(true);
  });
});
