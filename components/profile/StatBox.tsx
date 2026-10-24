// components/profile/StatBox.tsx
//
// One stat tile in the profile page's stat stack (Sets Opened, Total Gels,
// Total Contributions, Likes Received). Shared by both /profile (own) and
// /u/[handle] (public) — the viewed user's stats either way.

export default function StatBox({ label, value, className = "" }: { label: string; value: number; className?: string }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-1 px-5 py-4 rounded-xl bg-slate-800/60 border border-slate-700/50 ${className}`}
    >
      <span className="text-2xl font-bold text-white tabular-nums">{value.toLocaleString()}</span>
      <span className="text-[11px] text-slate-400 uppercase tracking-wider font-medium text-center">
        {label}
      </span>
    </div>
  );
}
