import { ATTRIBUTE_STALE_DAYS, isStale } from "../../src/lib/osm/types";

/**
 * 閉店チェック(C-04)の判定。scripts/osm/check-closed.ts から使う。
 */
export type AttributeCheckRow = {
  osm_id: string;
  name_at_check: string | null;
  current_name: string | null;
  checked_at: string; // YYYY-MM-DD
  in_osm: boolean;
};

export type ClosureReason = "missing" | "renamed" | "stale";

export type ClosureFinding = { osmId: string; reasons: ClosureReason[]; name: string; currentName?: string; checkedAt: string };

const REASON_LABEL: Record<ClosureReason, string> = {
  missing: "OSMから消えた(閉店・移転の可能性)",
  renamed: "店名が変わった(別の店の可能性)",
  stale: `確認から${ATTRIBUTE_STALE_DAYS}日以上`,
};

/** 空白・記号・全角半角の違いは店名の変更とみなさない */
function normName(s: string): string {
  return s.normalize("NFKC").replace(/[\s・･.,、。'’"“”()（）-]/g, "").toLowerCase();
}

export function findClosureIssues(rows: AttributeCheckRow[], today: Date): ClosureFinding[] {
  const out: ClosureFinding[] = [];
  for (const r of rows) {
    const reasons: ClosureReason[] = [];
    if (!r.in_osm) reasons.push("missing");
    else if (r.name_at_check && r.current_name && normName(r.name_at_check) !== normName(r.current_name)) reasons.push("renamed");
    if (isStale(r.checked_at, today)) reasons.push("stale");
    if (reasons.length) {
      out.push({
        osmId: r.osm_id,
        reasons,
        name: r.name_at_check ?? r.current_name ?? "(店名未登録)",
        currentName: r.current_name ?? undefined,
        checkedAt: r.checked_at,
      });
    }
  }
  // 消えた → 店名変更 → 古いだけ の順
  const rank = (f: ClosureFinding) => (f.reasons.includes("missing") ? 0 : f.reasons.includes("renamed") ? 1 : 2);
  return out.sort((a, b) => rank(a) - rank(b) || a.checkedAt.localeCompare(b.checkedAt));
}

/** GitHub Actions のジョブの概要に出す表 */
export function closureReport(findings: ClosureFinding[], total: number): string {
  const lines = [`## カフェの閉店チェック(C-04)`, "", `独自属性を登録した ${total} 件のうち、確認が必要なもの: ${findings.length} 件`, ""];
  if (findings.length === 0) return lines.join("\n");
  lines.push("| OSM ID | 登録時の店名 | 今の店名 | 確認日 | 理由 |", "| --- | --- | --- | --- | --- |");
  for (const f of findings) {
    const link = `[${f.osmId}](https://www.openstreetmap.org/${f.osmId})`;
    lines.push(`| ${link} | ${f.name} | ${f.currentName ?? "—"} | ${f.checkedAt} | ${f.reasons.map((r) => REASON_LABEL[r]).join("、")} |`);
  }
  lines.push(
    "",
    "対応: 閉店・移転を確かめたら Supabase の cafe_attributes で closed を true にする。移転先が OSM にあれば、新しい osm_id で登録し直す。",
  );
  return lines.join("\n");
}
