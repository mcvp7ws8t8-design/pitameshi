/**
 * 検索エンジンに登録する「エリア×ジャンル」ページの一覧(F-05)。
 * 要件定義書の方針:中身の薄いページを量産しない。お店が十分にある組み合わせを、よく検索されるものから少しずつ増やす。
 * ここに載せたものだけがサイトマップに入る。載せていない組み合わせも /area/... で表示はできるが、noindex にする。
 */
export const MIN_SHOPS_FOR_INDEX = 10;

export const LANDING_PAGES: { area: string; genre: string }[] = [
  // 仮データで確認できる組み合わせ。APIキー取得後、実データを見ながら差し替える。
  { area: "Y055", genre: "G001" }, // 新宿 × 居酒屋
  { area: "Y005", genre: "G004" }, // 銀座 × 和食
];

export function isLandingPage(area: string, genre: string): boolean {
  return LANDING_PAGES.some((p) => p.area === area && p.genre === genre);
}
