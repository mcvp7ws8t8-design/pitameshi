"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { searchHref, type SearchState } from "@/lib/search/query";

/**
 * 現在地から探す(F-08)。位置情報はこの検索にだけ使い、サーバーには保存しない(プライバシーポリシーに記載)。
 */
export function LocationButton({ base, className = "", label = "現在地から探す", target = "search" }: { base: SearchState; className?: string; label?: string; target?: "search" | "cafes" }) {
  const router = useRouter();
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  function locate() {
    if (!navigator.geolocation) {
      setStatus("error");
      return;
    }
    setStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Math.round(pos.coords.latitude * 1e5) / 1e5; // 約1mより細かい精度は使わない
        const lng = Math.round(pos.coords.longitude * 1e5) / 1e5;
        if (target === "cafes") {
          router.push(`/cafes?lat=${lat}&lng=${lng}`);
        } else {
          router.push(searchHref({ ...base, largeArea: undefined, middleAreas: [], lat, lng, range: base.range ?? 3, sort: "distance", page: 1 }));
        }
        setStatus("idle");
      },
      () => setStatus("error"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }

  return (
    <div className={className}>
      <button type="button" onClick={locate} disabled={status === "loading"} className="w-full rounded-full border border-brand bg-card px-4 py-2.5 text-sm font-bold text-brand hover:bg-brand-soft disabled:opacity-60">
        📍 {status === "loading" ? "現在地を確認中…" : label}
      </button>
      {status === "error" && <p className="mt-1 text-xs text-ink-soft">現在地を取得できませんでした。ブラウザの位置情報の設定を確認してください。</p>}
    </div>
  );
}
