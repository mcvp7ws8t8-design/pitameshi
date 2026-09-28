import type { Metadata } from "next";
import Link from "next/link";
import { StaticPage } from "@/components/StaticPage";
import { operatorName, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = { title: "運営者情報", alternates: { canonical: "/about" } };

export default function AboutPage() {
  return (
    <StaticPage title="運営者情報">
      <dl className="grid grid-cols-[7rem_1fr] gap-y-2">
        <dt className="text-ink-soft">サイト名</dt>
        <dd>{SITE_NAME}</dd>
        <dt className="text-ink-soft">運営者</dt>
        <dd>{operatorName()}</dd>
        <dt className="text-ink-soft">お問い合わせ</dt>
        <dd>
          <Link href="/contact">お問い合わせフォーム</Link>
        </dd>
      </dl>
      <h2>このサイトについて</h2>
      <p>
        {SITE_NAME}は、居酒屋からカフェまで全国の飲食店を、個室・喫煙可・飲み放題・宴会の人数などの細かい条件で探せる検索サイトです。
        お店の情報はホットペッパーグルメ Webサービス、カフェと駅の情報は OpenStreetMap のデータを利用しています。
      </p>
      <p>
        予約ボタンはアフィリエイトリンクです。詳しくは<Link href="/disclaimer#ads">免責事項・広告表記</Link>をご覧ください。
      </p>
    </StaticPage>
  );
}
