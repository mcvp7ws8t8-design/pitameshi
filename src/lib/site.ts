/** サイト全体の設定 */
export const SITE_NAME = "ぴためし";
export const SITE_TAGLINE = "条件にぴたっと合うお店が見つかる";
export const SITE_DESCRIPTION =
  "居酒屋からカフェまで、全国の飲食店を「個室」「喫煙可」「飲み放題」「宴会の人数」など細かい条件で探せる検索サイトです。";

export function siteUrl(): string {
  return (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function operatorName(): string {
  return process.env.OPERATOR_NAME || "ぴためし運営";
}
