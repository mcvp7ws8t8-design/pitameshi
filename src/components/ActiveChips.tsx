import Link from "next/link";
import { removableConditions } from "@/lib/search/engine";
import { PRESET_BY_ID } from "@/lib/search/presets";
import { searchHref, type SearchState } from "@/lib/search/query";

/** 選んでいる条件をチップで表示し、ワンタップで外せるようにする(S-05) */
export function ActiveChips({ state }: { state: SearchState }) {
  const conditions = removableConditions(state).filter((c) => c.id !== "includeUnknown");
  const preset = state.preset ? PRESET_BY_ID.get(state.preset) : undefined;
  if (conditions.length === 0 && !preset) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="選んでいる条件">
      {preset && (
        <span className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-ink">
          {preset.emoji} {preset.label}
          {preset.apply.keyword ? `(キーワード「${preset.apply.keyword}」)` : ""}
        </span>
      )}
      {conditions.map((c) => (
        <Link
          key={c.id}
          href={searchHref(c.state)}
          className="group flex items-center gap-1 rounded-full border border-brand/40 bg-brand-soft px-3 py-1 text-xs font-semibold text-brand-strong hover:border-brand"
          aria-label={`${c.label}を外す`}
        >
          {c.label}
          <span aria-hidden className="text-brand/70 group-hover:text-brand">
            ×
          </span>
        </Link>
      ))}
    </div>
  );
}
