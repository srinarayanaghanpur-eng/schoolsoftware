"use client";

import { useEffect, useState } from "react";

export default function AppLoader({ message = "Loading your dashboard..." }: { message?: string }) {
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowFallback(true), 8000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-slate-900 text-lg font-extrabold text-white">
          N
        </div>

        <h1 className="text-xl font-bold text-slate-900">
          NarayanaOS
        </h1>
        <p className="mt-1 text-xs font-semibold text-slate-500">
          Sri Narayana High School
        </p>

        <p className="mt-2 text-sm font-medium text-slate-500">
          {message}
        </p>

        <div className="mt-6 flex items-center justify-center gap-2">
          <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-blue-600"></span>
          <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-blue-600 [animation-delay:150ms]"></span>
          <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-blue-600 [animation-delay:300ms]"></span>
        </div>

        {showFallback && (
          <p className="mt-6 text-xs text-amber-600">
            Still loading? Please check your internet or refresh.
          </p>
        )}

        {!showFallback && (
          <p className="mt-6 text-xs text-slate-400">
            Please wait, we are preparing your workspace.
          </p>
        )}
      </div>
    </div>
  );
}
