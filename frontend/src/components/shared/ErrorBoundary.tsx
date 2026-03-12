import React from "react";
import { useGameStore } from "../../stores/gameStore";
import Logo from "./Logo";

type State = { error: Error | null; info: React.ErrorInfo | null };

export default class ErrorBoundary extends React.Component<
  React.PropsWithChildren,
  State
> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): State {
    return { error, info: null };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ info });
    try {
      localStorage.setItem(
        "topquizz_last_error",
        JSON.stringify({
          message: error.message,
          stack: error.stack,
          componentStack: info.componentStack,
          at: Date.now(),
        })
      );
    } catch {}
  }

  render() {
    if (!this.state.error) return this.props.children;

    const reset = () => {
      try {
        localStorage.removeItem("topquizz_last_error");
      } catch {}
      useGameStore.getState().reset();
      window.location.reload();
    };

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <Logo size="md" />
        <div className="card max-w-3xl w-full mt-6">
          <div className="text-red-400 font-black text-xl mb-2">
            Erreur côté frontend
          </div>
          <div className="text-neutral-300 font-semibold mb-3">
            {this.state.error.message}
          </div>
          <pre className="text-xs bg-black/40 border border-neutral-800 rounded-xl p-4 overflow-auto whitespace-pre-wrap text-neutral-300 max-h-[40vh]">
            {(this.state.error.stack || "").trim()}
            {"\n"}
            {(this.state.info?.componentStack || "").trim()}
          </pre>
          <div className="mt-4 flex gap-3">
            <button className="btn-primary" onClick={reset}>
              Réinitialiser
            </button>
            <button
              className="btn-secondary"
              onClick={() => navigator.clipboard.writeText(JSON.stringify({
                message: this.state.error?.message,
                stack: this.state.error?.stack,
                componentStack: this.state.info?.componentStack,
              }, null, 2))}
            >
              Copier l'erreur
            </button>
          </div>
        </div>
      </div>
    );
  }
}
