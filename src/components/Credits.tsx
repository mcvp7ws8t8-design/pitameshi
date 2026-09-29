import Link from "next/link";

/**
 * 出典表示(F-07)。
 * - ホットペッパーグルメ Webサービス:APIを使う全ページにクレジット表示が必要。
 *   正式なHTMLは https://webservice.recruit.co.jp/doc/hotpepper/guideline.html の「クレジット」のテキスト形式と「画像利用の際のクレジット」を使用(2026-09-28 確認)。
 * - OpenStreetMap:ODbL。「© OpenStreetMap contributors」+ 著作権ページへのリンク。
 */
export function Credits() {
  return (
    <div className="space-y-1 text-xs text-ink-soft">
      {/* ご利用案内の指定クレジット(テキスト形式)。文言・リンク先を変えないこと */}
      <p>
        Powered by{" "}
        <a href="http://webservice.recruit.co.jp/" target="_blank" rel="noopener" className="underline">
          ホットペッパーグルメ Webサービス
        </a>
      </p>
      {/* お店の写真を載せているため必須(ご利用案内「画像利用の際のクレジット」) */}
      <p>【画像提供：ホットペッパー グルメ】</p>
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
