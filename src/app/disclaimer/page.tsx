import type { Metadata } from "next";
import { StaticPage } from "@/components/StaticPage";

export const metadata: Metadata = { title: "免責事項・広告表記" };

export default function DisclaimerPage() {
  return (
    <StaticPage title="免責事項・広告表記">
      <h2 id="ads">広告表記</h2>
      <p>
        当サイトの「予約する」「空席を確認・予約する」ボタンは、ホットペッパーグルメへのアフィリエイトリンク(広告)です。
        ボタンから予約・来店されると、当サイトに紹介料が支払われることがあります。お店の料金が変わることはありません。
      </p>
      <p>お店の並び順や表示内容は、紹介料の有無によって変えていません。</p>

      <h2>掲載情報について</h2>
      <ul>
        <li>お店の情報はホットペッパーグルメ Webサービスから取得しています。</li>
        <li>カフェ・駅の情報は OpenStreetMap のデータ(© OpenStreetMap contributors)を利用しています。</li>
        <li>「喫煙できる」「分煙」などの表示は、お店の掲載情報をもとに当サイトが判定したものです。</li>
        <li>電源・作業のしやすさなどは、当サイトが確認した時点の情報です。</li>
      </ul>
      <p>
        情報は変わることがあります。営業時間・喫煙の可否・料金などは、来店前にお店へ直接ご確認ください。
        当サイトの情報を利用したことで生じたトラブルや損害について、当サイトは責任を負いかねます。
      </p>

      <h2>喫煙について</h2>
      <p>健康増進法により、喫煙できる席・部屋には20歳未満の方は立ち入れません。</p>
    </StaticPage>
  );
}
