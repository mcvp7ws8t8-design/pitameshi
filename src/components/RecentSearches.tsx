"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { addRecent, isSavable, parseRecent, RECENT_KEY } from "@/lib/browser/recent";
import { readStored, useStoredRaw, writeStored } from "@/lib/browser/useStored";

/** 検索結果を開いたときに、その条件を「最近使った条件」に記録する(U-06)。画面には何も出さない。 */
export function RememberSearch({ path, label, detail }: { path: string; label: string; detail: string }) {
  useEffect(() => {
    if (!isSavable(path)) return;
    const list = addRecent(parseRecent(readStored(RECENT_KEY)), { path, label, detail, savedAt: Date.now() });
    writeStored(RECENT_KEY, JSON.stringify(list));
  }, [path, label, detail]);
  return null;
}

/** 最近使った条件をワンタップで呼び出す(U-06)。保存がなければ何も出さない。 */
export function RecentSearches({ className = "" }: { className?: string }) {
  const raw = useStoredRaw(RECENT_KEY);
  const list = useMemo(() => parseRecent(raw), [raw]);
  if (list.length === 0) return null;
  return (
    <section className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">最近使った条件</h2>
        <button type="button" className="text-xs text-ink-soft underline" onClick={() => writeStored(RECENT_KEY, "[]")}>
          履歴を消す
        </button>
      </div>
      <ul className="space-y-2">
        {list.map((r) => (
          <li key={r.path}>
            <Link href={r.path} className="block rounded-xl border border-line bg-card px-3 py-2 hover:border-brand">
              <span className="block text-sm font-semibold">{r.label}</span>
              {r.detail && <span className="block truncate text-xs text-ink-soft">{r.detail}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
