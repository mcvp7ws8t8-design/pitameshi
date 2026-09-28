"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AreaMaster } from "@/lib/hotpepper/masters";
import { searchHref, type SearchState } from "@/lib/search/query";

/** 場所(都道府県 → エリア)とキーワードで探す */
export function SearchBox({ areas, base, compact = false }: { areas: AreaMaster[]; base: SearchState; compact?: boolean }) {
  const router = useRouter();
  const larges = areas.filter((a) => a.level === "large");
  const [large, setLarge] = useState(base.largeArea ?? areas.find((a) => a.code === base.middleAreas[0])?.parent ?? "");
  const [middle, setMiddle] = useState(base.middleAreas[0] ?? "");
  const [keyword, setKeyword] = useState(base.keyword ?? "");
  const middles = areas.filter((a) => a.level === "middle" && a.parent === large);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    router.push(
      searchHref({
        ...base,
        largeArea: middle ? undefined : large || undefined,
        middleAreas: middle ? [middle] : [],
        keyword: keyword.trim() || undefined,
        lat: undefined,
        lng: undefined,
        sort: base.sort === "distance" ? "recommend" : base.sort,
        page: 1,
      }),
    );
  }

  return (
    <form onSubmit={submit} className={`grid gap-2 ${compact ? "sm:grid-cols-[1fr_1fr_1.4fr_auto]" : "sm:grid-cols-2"}`} role="search">
      <label className="sr-only" htmlFor="sb-large">
        都道府県
      </label>
      <select
        id="sb-large"
        value={large}
        onChange={(e) => {
          setLarge(e.target.value);
          setMiddle("");
        }}
        className="rounded-xl border border-line bg-card px-3 py-2.5"
      >
        <option value="">都道府県を選ぶ</option>
        {larges.map((a) => (
          <option key={a.code} value={a.code}>
            {a.name}
          </option>
        ))}
      </select>
      <label className="sr-only" htmlFor="sb-middle">
        エリア
      </label>
      <select id="sb-middle" value={middle} onChange={(e) => setMiddle(e.target.value)} disabled={!large} className="rounded-xl border border-line bg-card px-3 py-2.5 disabled:opacity-50">
        <option value="">エリアを選ぶ(任意)</option>
        {middles.map((a) => (
          <option key={a.code} value={a.code}>
            {a.name}
          </option>
        ))}
      </select>
      <label className="sr-only" htmlFor="sb-keyword">
        キーワード
      </label>
      <input
        id="sb-keyword"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        placeholder="駅名・店名・料理など"
        className={`rounded-xl border border-line bg-card px-3 py-2.5 ${compact ? "" : "sm:col-span-2"}`}
      />
      <button type="submit" disabled={!large && !keyword.trim()} className={`rounded-xl bg-brand px-5 py-2.5 font-bold text-white disabled:opacity-40 ${compact ? "" : "sm:col-span-2"}`}>
        探す
      </button>
    </form>
  );
}
