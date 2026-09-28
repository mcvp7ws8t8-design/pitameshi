import Link from "next/link";

/**
 * 出典表示(F-07)。
 * - ホットペッパーグルメ Webサービス:APIを使う全ページにクレジット表示が必要。
 *   ご利用案内(https://webservice.recruit.co.jp/doc/hotpepper/guideline.html)の「c.テキスト形式」を使う。
 *   店舗の写真を出すときは「画像提供:ホットペッパー グルメ」の明記も必要(同ページ「3.画像利用の際のクレジット」)。
 * - OpenStreetMap:ODbL。「© OpenStreetMap contributors」+ 著作権ページへのリンク。
 */
/** 店舗写真のクレジット。文言はご利用案内の指定どおり。 */
export const PHOTO_CREDIT = "画像提供:ホットペッパー グルメ";

export function Credits() {
  return (
    <div className="space-y-1 text-xs text-ink-soft">
      <p>
        Powered by{" "}
        <a href="https://webservice.recruit.co.jp/" target="_blank" rel="noopener" className="underline">
          ホットペッパーグルメ Webサービス
        </a>
      </p>
      <p>{PHOTO_CREDIT}</p>
      <p>
        カフェ・駅のデータ:
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener" className="underline">
          © OpenStreetMap contributors
        </a>
      </p>
    </div>
  );
}

/** 広告表記(景品表示法のステルスマーケティング規制への対応)。予約ボタンの近くに出す。 */
export function PrNotice({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs text-ink-soft ${className}`}>
      <span className="mr-1 rounded border border-line px-1 py-px font-semibold">PR</span>
      予約ボタンはアフィリエイトリンクです。予約されると当サイトに紹介料が入ります。
      <Link href="/disclaimer#ads" className="underline">
        詳しく
      </Link>
    </p>
  );
}
