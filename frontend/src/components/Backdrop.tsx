/** Soft animated aurora behind the glass. Pure CSS animation → cheap on mobile GPUs. */
export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#f4f6fb]">
      <div className="absolute -left-24 -top-28 h-80 w-80 animate-drift rounded-full bg-indigo-300/45 blur-3xl" />
      <div className="absolute -right-28 top-40 h-96 w-96 animate-drift-slow rounded-full bg-sky-300/40 blur-3xl" />
      <div className="absolute -bottom-32 left-10 h-80 w-80 animate-drift rounded-full bg-rose-200/45 blur-3xl" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,.65),transparent_60%)]" />
    </div>
  );
}
