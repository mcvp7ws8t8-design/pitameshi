import Link from "next/link";
import { applyPreset, visiblePresets } from "@/lib/search/presets";
import { EMPTY_STATE, searchHref, type SearchState } from "@/lib/search/query";

/** 目的別プリセット(S-01)。場所が決まっていればそのまま、なければ場所を選ぶ画面に進む。 */
export function PresetGrid({ base = EMPTY_STATE, current }: { base?: SearchState; current?: string }) {
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {visiblePresets().map((p) => {
        const href = p.mode === "cafe" ? `/cafes?p=${p.id}` : searchHref(applyPreset(base, p));
        const active = current === p.id;
        return (
          <li key={p.id}>
            <Link
              href={href}
              aria-current={active ? "true" : undefined}
              className={`flex h-full flex-col gap-0.5 rounded-2xl border p-3 transition ${active ? "border-brand bg-brand-soft" : "border-line bg-card hover:border-brand"}`}
            >
              <span className="text-2xl" aria-hidden>
                {p.emoji}
              </span>
              <span className="font-bold">
                {p.label}
                {p.beta && <span className="ml-1 rounded bg-accent-soft px-1 text-[10px] font-semibold">試験中</span>}
              </span>
              <span className="text-xs leading-snug text-ink-soft">{p.description}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
