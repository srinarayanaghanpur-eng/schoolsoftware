import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f7f3] p-6">
      <div className="card max-w-md p-6 text-center">
        <h1 className="text-2xl font-semibold">Unauthorized</h1>
        <p className="mt-2 text-sm text-stone-500">Your account does not have access to this area.</p>
        <Link href="/login" className="btn-primary mt-4">
          Back to login
        </Link>
      </div>
    </main>
  );
}
