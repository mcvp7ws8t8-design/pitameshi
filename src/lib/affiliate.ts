/**
 * アフィリエイトリンク(F-04)。
 * バリューコマースで提携後、管理画面で発行されるリンク形式を AFFILIATE_URL_TEMPLATE に設定する。
 * {URL} の部分に、ホットペッパーの店舗ページURL(エンコード済み)が入る。
 * ※ API由来の店舗URLにリンクを付けてよいかは、提携時にプログラムの条件で確認すること(要件定義書の未決事項)。
 */

const ALLOWED_HOSTS = ["www.hotpepper.jp", "hotpepper.jp"];

/** 送客先はホットペッパーのページだけに限る(オープンリダイレクト対策) */
export function isAllowedDestination(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && ALLOWED_HOSTS.includes(u.hostname);
  } catch {
    return false;
  }
}

export function buildAffiliateUrl(shopUrl: string, template: string | undefined): string {
  if (!isAllowedDestination(shopUrl)) throw new Error("送客先がホットペッパーではありません");
  if (!template || !template.includes("{URL}")) return shopUrl;
  return template.replace("{URL}", encodeURIComponent(shopUrl));
}
