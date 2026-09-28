import type { Metadata } from "next";
import Link from "next/link";
import { StaticPage } from "@/components/StaticPage";
import { operatorName } from "@/lib/site";

export const metadata: Metadata = { title: "プライバシーポリシー", alternates: { canonical: "/privacy" } };

/**
 * ひな形。公開前に内容を確認し、使うサービス(アクセス解析など)に合わせて直すこと。
 */
export default function PrivacyPage() {
  return (
    <StaticPage title="プライバシーポリシー">
      <p>{operatorName()}(以下「当サイト」)は、利用者の情報を次のとおり取り扱います。</p>

      <h2>1. 取得する情報</h2>
      <ul>
        <li>アクセス解析のための情報(閲覧したページ、ブラウザの種類、おおよその地域など)</li>
        <li>予約ボタンが押された記録(お店のID、押されたページ、日時)。個人を特定する情報は含みません。</li>
        <li>お問い合わせフォームに入力された内容</li>
      </ul>

      <h2>2. 位置情報</h2>
      <p>
        「現在地から探す」を使うと、ブラウザから位置情報を取得し、近くのお店を探すためだけに使います。
        位置情報は検索のURLに含まれますが、当サイトのデータベースには保存しません。
      </p>

      <h2>3. ブラウザへの保存</h2>
      <p>
        「最近使った条件」と「お気に入り」は、お使いのブラウザ(localStorage)にだけ保存し、当サイトのサーバーには送りません。
        現在地を使った検索は、位置情報を含むため「最近使った条件」に保存しません。ブラウザのデータを消去するか、各画面の「消す」ボタンで削除できます。
      </p>

      <h2>4. アクセス解析ツール</h2>
      <p>
        当サイトは Google アナリティクスを利用しています。Google アナリティクスは Cookie を使って利用状況を収集します。
        収集される情報や停止の方法は、Google のポリシーをご確認ください。
      </p>

      <h2>5. アフィリエイトプログラム</h2>
      <p>
        当サイトはバリューコマースのアフィリエイトプログラムに参加しています。予約ボタンを押すと、提携先の計測のために Cookie
        が使われることがあります。
      </p>

      <h2>6. 第三者への提供</h2>
      <p>法令に基づく場合を除き、取得した情報を本人の同意なく第三者に提供しません。</p>

      <h2>7. お問い合わせ</h2>
      <p>
        このポリシーについてのお問い合わせは<Link href="/contact">お問い合わせフォーム</Link>からお願いします。
      </p>
      <p className="text-xs text-ink-soft">制定日:(公開日を記入)</p>
    </StaticPage>
  );
}
