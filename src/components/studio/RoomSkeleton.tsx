export function RoomSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading" className="space-y-4 animate-pulse">
      <div className="h-4 w-40 rounded bg-white/5" />
      <div className="h-8 w-2/3 rounded bg-white/5" />
      <div className="h-40 rounded-xl bg-white/[0.03]" />
    </div>
  );
}
