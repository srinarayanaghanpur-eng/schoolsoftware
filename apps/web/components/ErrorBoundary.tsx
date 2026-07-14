"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertCircle } from "lucide-react";

type Props = {
  children: ReactNode;
  resetKey?: string;
  fallback?: ReactNode;
};

type State = {
  hasError: boolean;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Dashboard widget error:", error, info);
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <section className="p-4 md:p-7">
        <div className="card flex max-w-2xl items-start gap-4 p-5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#ffebed] text-[#d84d5b]">
            <AlertCircle size={22} />
          </span>
          <div className="flex-1">
            <h2 className="text-lg font-extrabold text-[#1f2136]">This section could not load</h2>
            <p className="mt-1 text-sm font-medium text-[#7d86a8]">
              The rest of the ERP is still available.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-3 rounded-lg bg-[#eef0ff] px-4 py-2 text-xs font-extrabold text-[#3033a1] transition hover:bg-[#e0e3ff]"
            >
              Retry
            </button>
          </div>
        </div>
      </section>
    );
  }
}
