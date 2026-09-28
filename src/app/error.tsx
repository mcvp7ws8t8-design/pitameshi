"use client";

import Link from "next/link";

/** 予期しないエラー(API障害など)のときの画面 */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md space-y-3 py-10 text-center">
      <h1 className="text-lg font-bold">一時的に表示できません</h1>
      <p className="text-sm text-ink-soft">お店の情報を取得できませんでした。時間をおいてもう一度お試しください。</p>
      <div className="flex justify-center gap-2">
        <button type="button" onClick={reset} className="rounded-full bg-brand px-5 py-2.5 font-bold text-white">
          もう一度読み込む
        </button>
        <Link href="/" className="rounded-full border border-line px-5 py-2.5">
          トップへ
        </Link>
      </div>
    </div>
  );
}
