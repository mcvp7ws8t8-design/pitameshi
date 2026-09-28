import type { Metadata } from "next";
import Link from "next/link";
import { LocationButton } from "@/components/LocationButton";
import { formatOpeningHours, MOCK_STATIONS } from "@/lib/osm/cafes";
import { getCafeProvider } from "@/lib/osm/providers";
import type { CafeView } from "@/lib/osm/types";
import { EMPTY_STATE } from "@/lib/search/query";

/**
 * カフェ検索(C-02)。データは OpenStreetMap(ODbL)+ 運営者が確認した独自情報(C-03)。
 * ホットペッパーの店舗とは混ぜずに別枠で出す(要件定義書)。
 */
export const metadata: Metadata = {
  title: "近くのカフェ・喫茶店を探す(電源・Wi-Fi)",
  robots: { index: false, follow: true },
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const RADII = [300, 500, 1000] as const;

function one(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function CafesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const preset = one(sp.p);
  const lat = Number.parseFloat(one(sp.lat) ?? "");
  const lng = Number.parseFloat(one(sp.lng) ?? "");
  const hasCenter = Number.isFinite(lat) && Number.isFinite(lng) && lat > 20 && lat < 46 && lng > 122 && lng < 154;
  const radius = RADII.find((r) => String(r) === one(sp.r)) ?? 500;
  const isWork = preset === "cafe-work";
  const wifi = one(sp.wifi) === "1" || (isWork && one(sp.wifi) !== "0");
  const power = one(sp.power) === "1" || (isWork && one(sp.power) !== "0");
  const includeUnknown = one(sp.unk) !== "0"; // カフェは情報がない店が多いので、初期値は「含める」
  const provider = getCafeProvider();

  const q = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const cur: Record<string, string | undefined> = {
      p: preset,
      lat: hasCenter ? String(lat) : undefined,
      lng: hasCenter ? String(lng) : undefined,
      r: String(radius),
      wifi: wifi ? "1" : "0",
      power: power ? "1" : "0",
      unk: includeUnknown ? "1" : "0",
      ...patch,
    };
    for (const [k, v] of Object.entries(cur)) if (v !== undefined) p.set(k, v);
    return `/cafes?${p}`;
  };

  let cafes: CafeView[] = [];
  let failed = false;
  if (provider && hasCenter) {
    try {
      cafes = await provider.nearby({ center: { lat, lng }, radiusM: radius, wifi, power, includeUnknown, limit: 50 });
    } catch (e) {
      console.error("[cafes]", e);
      failed = true;
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold">{isWork ? "💻 作業できるカフェ" : "☕ 近くのカフェ・喫茶店"}</h1>

      {!provider ? (
        <p className="rounded-2xl border border-line bg-card p-4 text-sm">カフェ検索は準備中です。もうしばらくお待ちください。</p>
      ) : (
        <>
          <div className="space-y-3 rounded-2xl border border-line bg-card p-4">
            <LocationButton base={EMPTY_STATE} target="cafes" label="現在地の近くのカフェ" />
            {provider.kind === "mock" && (
              <div className="text-sm">
                <p className="mb-1 text-xs text-ink-soft">開発モード(仮データ):駅から探す</p>
                <div className="flex flex-wrap gap-2">
                  {MOCK_STATIONS.map((s) => (
                    <Link key={s.osmId} href={q({ lat: String(s.lat), lng: String(s.lng) })} className="rounded-full border border-line px-3 py-1">
                      {s.name}駅
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {hasCenter && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-ink-soft">範囲</span>
                {RADII.map((r) => (
                  <Link key={r} href={q({ r: String(r) })} aria-current={r === radius} className={`rounded-full border px-3 py-1 ${r === radius ? "border-brand bg-brand text-white" : "border-line"}`}>
                    {r < 1000 ? `${r}m` : "1km"}
                  </Link>
                ))}
                <Toggle href={q({ wifi: wifi ? "0" : "1" })} on={wifi} label="Wi-Fi" />
                <Toggle href={q({ power: power ? "0" : "1" })} on={power} label="電源" />
                <Toggle href={q({ unk: includeUnknown ? "0" : "1" })} on={includeUnknown} label="情報が不明の店も含める" />
              </div>
            )}
          </div>

          {failed && <p className="text-sm">カフェの情報を取得できませんでした。時間をおいてお試しください。</p>}
          {hasCenter && !failed && cafes.length === 0 && (
            <p className="rounded-2xl border border-line bg-card p-4 text-sm">条件に合うカフェが見つかりませんでした。範囲を広げるか、条件を外してみてください。</p>
          )}

          <ul className="space-y-3">
            {cafes.map((c) => (
              <li key={c.osmId}>
                <CafeCard cafe={c} />
              </li>
            ))}
          </ul>

          <p className="text-xs text-ink-soft">
            カフェの場所・営業時間などは
            <a href="https://www.openstreetmap.org/copyright" className="underline" target="_blank" rel="noopener">
              © OpenStreetMap contributors
            </a>
            のデータです。電源・作業のしやすさは、ぴためしが確認した情報です。
          </p>
        </>
      )}
    </div>
  );
}

function Toggle({ href, on, label }: { href: string; on: boolean; label: string }) {
  return (
    <Link href={href} aria-pressed={on} className={`rounded-full border px-3 py-1 ${on ? "border-brand bg-brand-soft font-semibold text-brand-strong" : "border-line"}`}>
      {on ? "✓ " : ""}
      {label}
    </Link>
  );
}

function yesNoLabel(v: boolean | undefined, yes: string, no: string) {
  if (v === undefined) return undefined;
  return v ? yes : no;
}

function CafeCard({ cafe }: { cafe: CafeView }) {
  const a = cafe.attributes;
  const wifi = cafe.internetAccess ? (cafe.internetAccess === "no" ? "Wi-Fiなし" : "Wi-Fiあり") : "Wi-Fi:不明";
  const tags = [
    wifi,
    a ? yesNoLabel(a.power, "電源あり", "電源なし") : "電源:不明",
    a ? yesNoLabel(a.workFriendly, "作業OK", "作業には不向き") : undefined,
    a?.longStay ? "長居しやすい" : undefined,
    a?.solo ? "一人でも入りやすい" : undefined,
  ].filter(Boolean) as string[];
  return (
    <article className="rounded-2xl border border-line bg-card p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-bold">{cafe.name}</h2>
        {cafe.distanceM !== undefined && <span className="shrink-0 text-xs text-ink-soft">{cafe.distanceM}m</span>}
      </div>
      {cafe.openingHours && <p className="text-xs text-ink-soft">営業時間(目安):{formatOpeningHours(cafe.openingHours)}</p>}
      <ul className="mt-2 flex flex-wrap gap-1">
        {tags.map((t) => (
          <li key={t} className={`rounded-full px-2 py-0.5 text-xs font-semibold ${t.includes("不明") ? "border border-dashed border-unknown/50 text-unknown" : "bg-brand-soft text-brand-strong"}`}>
            {t}
          </li>
        ))}
      </ul>
      {a && (
        <p className={`mt-1 text-[11px] ${cafe.stale ? "text-accent" : "text-ink-soft"}`}>
          {cafe.stale ? "⚠ 情報が古い可能性があります。" : ""}ぴためし確認日:{a.checkedAt}
        </p>
      )}
      <a
        href={`https://www.openstreetmap.org/${cafe.osmId}`}
        target="_blank"
        rel="noopener"
        className="mt-2 inline-block text-xs underline"
      >
        地図で見る
      </a>
    </article>
  );
}
