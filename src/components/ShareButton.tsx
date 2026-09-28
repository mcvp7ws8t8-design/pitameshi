"use client";

import { useState } from "react";

/**
 * 条件のURL共有(U-05)。ログイン不要で、同じ検索結果をLINEなどで送れる。
 * スマホでは端末の共有メニュー、PCではURLをコピー。LINEで送るボタンも出す。
 */
export function ShareButton({ path, title, label = "この条件を共有" }: { path: string; title: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const fullUrl = () => new URL(path, window.location.origin).toString();

  async function share() {
    const url = fullUrl();
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        /* キャンセルされたらコピーにする */
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={share} className="rounded-full border border-line bg-card px-3 py-1.5 text-sm font-semibold hover:border-brand">
        {copied ? "URLをコピーしました" : label}
      </button>
      <a
        href={`https://line.me/R/share?text=${encodeURIComponent(`${title}\n`)}`}
        onClick={(e) => {
          e.currentTarget.href = `https://line.me/R/share?text=${encodeURIComponent(`${title}\n${fullUrl()}`)}`;
        }}
        target="_blank"
        rel="noopener"
        className="rounded-full bg-[#06c755] px-3 py-1.5 text-sm font-bold text-white"
      >
        LINEで送る
      </a>
    </div>
  );
}
