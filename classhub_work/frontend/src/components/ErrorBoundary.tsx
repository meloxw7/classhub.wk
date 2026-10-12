import { Component, ReactNode } from 'react';

type Props = { children: ReactNode };

type State = { error: Error | null };

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('Erro capturado pelo ErrorBoundary:', error);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen grid place-items-center bg-slate-50 p-6">
          <div className="card p-10 max-w-md w-full text-center">
            <p className="text-5xl">:(</p>

            <h2 className="section-title mt-4">Algo deu errado</h2>

            <p className="muted mt-2">Ocorreu um erro inesperado nesta tela.</p>

            <pre className="mt-4 p-3 rounded-xl bg-slate-100 text-xs text-left text-red-700 whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
              {this.state.error.message}
            </pre>

            <div className="flex gap-2 justify-center mt-6">
              <button className="btn-secondary" onClick={this.reset}>
                Tentar novamente
              </button>

              <button className="btn-primary" onClick={() => window.location.reload()}>
                Recarregar página
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
