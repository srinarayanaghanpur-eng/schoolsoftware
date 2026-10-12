"use client";

export default function RootError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4 py-10">
      <div className="card w-full max-w-md p-8 text-center">
        <h2 className="text-lg font-extrabold text-[#1f2136]">Something went wrong</h2>
        <p className="mt-2 text-sm font-medium text-[#7d86a8]">
          An unexpected error occurred while loading this page.
        </p>
        {error?.digest ? (
          <p className="mt-3 break-all rounded-xl bg-[#f3f4fb] px-3 py-2 font-mono text-xs text-[#7d86a8]">
            Ref: {error.digest}
          </p>
        ) : null}
        <button
          type="button"
          onClick={reset}
          className="btn-primary mt-5 w-full"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
