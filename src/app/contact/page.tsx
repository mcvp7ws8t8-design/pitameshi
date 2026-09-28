import type { Metadata } from "next";
import { StaticPage } from "@/components/StaticPage";

export const metadata: Metadata = { title: "お問い合わせ" };

/** 問い合わせは外部フォーム(Googleフォームなど)で受ける。CONTACT_FORM_URL に設定する。 */
export default function ContactPage() {
  const url = process.env.CONTACT_FORM_URL;
  return (
    <StaticPage title="お問い合わせ">
      <p>当サイトへのご意見・掲載内容の誤りのご連絡は、下のフォームからお願いします。</p>
      <p>お店の予約・料金についてのお問い合わせは、各お店またはホットペッパーグルメへお願いします。</p>
      {url ? (
        <p>
          <a href={url} target="_blank" rel="noopener" className="inline-block rounded-full bg-brand px-5 py-2.5 font-bold text-white no-underline">
            お問い合わせフォームを開く
          </a>
        </p>
      ) : (
        <p className="rounded-lg bg-accent-soft p-3">(準備中)お問い合わせフォームのURLが未設定です。</p>
      )}
    </StaticPage>
  );
}
