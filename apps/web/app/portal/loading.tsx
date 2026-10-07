export default function PortalLoading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4 py-10">
      <div
        className="h-9 w-9 animate-spin rounded-full border-[3px] border-[#3033a1] border-t-transparent"
        role="status"
        aria-label="Loading"
      />
    </div>
  );
}
