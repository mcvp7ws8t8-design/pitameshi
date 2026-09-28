import Link from "next/link";

/**
 * 出典表示(F-07)。
 * - ホットペッパーグルメ Webサービス:APIを使う全ページにクレジット表示が必要。
 *   正式なHTMLは https://webservice.recruit.co.jp/doc/hotpepper/guideline.html の「クレジット」から選んで貼り替えること。
 * - OpenStreetMap:ODbL。「© OpenStreetMap contributors」+ 著作権ページへのリンク。
 */
export function Credits() {
  return (
    <div className="space-y-1 text-xs text-ink-soft">
      <p>
        {/* TODO: ご利用案内の指定クレジット(画像またはテキストのHTML)に差し替える */}
        <a href="https://webservice.recruit.co.jp/" target="_blank" rel="noopener" className="underline">
          Powered by ホットペッパーグルメ Webサービス
        </a>
      </p>
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
