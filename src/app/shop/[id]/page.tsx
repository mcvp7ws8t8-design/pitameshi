import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrNotice } from "@/components/Credits";
import { FavoriteButton } from "@/components/Favorites";
import { getShop } from "@/lib/hotpepper";
import { shopBadges } from "@/lib/search/badges";
import { classifySmoking, SMOKING_LABEL, shopLatLng, yesNo } from "@/lib/search/interpret";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const shop = await getShop((await params).id).catch(() => undefined);
  if (!shop) return { title: "お店が見つかりません" };
  return {
    title: `${shop.name}(${shop.small_area?.name ?? shop.middle_area?.name ?? ""} ${shop.genre.name})`,
    description: shop.catch,
    // 店舗の情報はホットペッパーのものなので、検索エンジンには登録しない(重複コンテンツ回避)
    robots: { index: false, follow: true },
  };
}

const ROWS: { label: string; field: keyof NonNullable<Awaited<ReturnType<typeof getShop>>> }[] = [
  { label: "住所", field: "address" },
  { label: "アクセス", field: "access" },
  { label: "営業時間", field: "open" },
  { label: "定休日", field: "close" },
  { label: "予算", field: "budget_memo" },
  { label: "総席数", field: "capacity" },
  { label: "宴会の最大人数", field: "party_capacity" },
  { label: "個室", field: "private_room" },
  { label: "座敷", field: "tatami" },
  { label: "掘りごたつ", field: "horigotatsu" },
  { label: "貸切", field: "charter" },
  { label: "飲み放題", field: "free_drink" },
  { label: "食べ放題", field: "free_food" },
  { label: "コース", field: "course" },
  { label: "カード", field: "card" },
  { label: "Wi-Fi", field: "wifi" },
  { label: "駐車場", field: "parking" },
  { label: "バリアフリー", field: "barrier_free" },
  { label: "お子様連れ", field: "child" },
  { label: "ペット", field: "pet" },
  { label: "英語メニュー", field: "english" },
  { label: "23時以降の営業", field: "midnight" },
  { label: "その他設備", field: "other_memo" },
  { label: "備考", field: "shop_detail_memo" },
];

export default async function ShopPage({ params }: Props) {
  const { id } = await params;
  const shop = await getShop(id);
  if (!shop) notFound();

  const smoking = classifySmoking(shop.non_smoking);
  const badges = shopBadges(shop, smoking, [], 12);
  const pos = shopLatLng(shop);

  return (
    <article className="space-y-5">
      <div className="overflow-hidden rounded-3xl border border-line bg-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={shop.photo.pc.l} alt="" className="h-56 w-full bg-accent-soft object-cover sm:h-72" />
        <div className="space-y-2 p-4">
          <p className="text-sm text-ink-soft">
            {shop.genre.name} ・ {shop.small_area?.name ?? shop.middle_area?.name}
          </p>
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-2xl font-bold leading-snug">{shop.name}</h1>
            <FavoriteButton shopId={shop.id} className="shrink-0" />
          </div>
          <p className="text-ink-soft">{shop.catch}</p>
          <p className="font-semibold">{shop.budget?.average || shop.budget?.name}</p>
          <ul className="flex flex-wrap gap-1">
            {badges.map((b) => (
              <li key={b.id} className={`rounded-full px-2 py-0.5 text-xs font-semibold ${b.tone === "unknown" ? "border border-dashed border-unknown/50 text-unknown" : "bg-brand-soft text-brand-strong"}`}>
                {b.label}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="sticky bottom-3 z-20 space-y-1 rounded-2xl border border-line bg-paper/95 p-3 backdrop-blur">
        <a href={`/go/${shop.id}?from=${encodeURIComponent(`/shop/${shop.id}`)}`} rel="nofollow sponsored" className="block rounded-full bg-brand py-3 text-center font-bold text-white hover:bg-brand-strong">
          ホットペッパーで空席を確認・予約する
        </a>
        <PrNotice />
      </div>

      <section className="rounded-2xl border border-line bg-card p-4">
        <h2 className="mb-3 font-bold">お店の情報</h2>
        <dl className="divide-y divide-line text-sm">
          <div className="grid grid-cols-[7rem_1fr] gap-2 py-2">
            <dt className="text-ink-soft">タバコ</dt>
            <dd>
              {SMOKING_LABEL[smoking]}
              {shop.non_smoking && <span className="text-ink-soft">(お店の記載:{shop.non_smoking})</span>}
              <p className="text-xs text-ink-soft">喫煙の可否は変わることがあります。来店前にお店へご確認ください。喫煙できる席には20歳未満は入れません。</p>
            </dd>
          </div>
          {ROWS.map(({ label, field }) => {
            const raw = shop[field];
            const value = typeof raw === "string" || typeof raw === "number" ? String(raw).trim() : "";
            if (!value) return null;
            const yn = typeof raw === "string" ? yesNo(raw) : undefined;
            return (
              <div key={label} className="grid grid-cols-[7rem_1fr] gap-2 py-2">
                <dt className="text-ink-soft">{label}</dt>
                <dd className={yn === false ? "text-ink-soft" : ""}>{value}</dd>
              </div>
            );
          })}
        </dl>
        {pos && (
          <p className="mt-3 text-sm">
            <a href={`https://www.openstreetmap.org/?mlat=${pos.lat}&mlon=${pos.lng}#map=18/${pos.lat}/${pos.lng}`} target="_blank" rel="noopener" className="underline">
              地図で場所を見る(OpenStreetMap)
            </a>
          </p>
        )}
      </section>

      <p className="text-xs text-ink-soft">
        掲載情報はホットペッパーグルメから取得しています。最新の情報はお店のページでご確認ください。
      </p>
      <Link href="/search" className="text-sm underline">
        ← お店を探す
      </Link>
    </article>
  );
}
