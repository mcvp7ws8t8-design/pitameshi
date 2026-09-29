/**
 * 検索エンジンに登録する「エリア×ジャンル」ページの一覧(F-05)。
 * 要件定義書の方針:中身の薄いページを量産しない。お店が十分にある組み合わせを、よく検索されるものから少しずつ増やす。
 * ここに載せたものだけがサイトマップに入る。載せていない組み合わせも /area/... で表示はできるが、noindex にする。
 */
export const MIN_SHOPS_FOR_INDEX = 10;

export const LANDING_PAGES: { area: string; genre: string }[] = [
  // 2026-09-28 の実データで、どれも150件以上ある組み合わせ。増やすときも件数を確認してから少しずつ。
  // 東京
  { area: "Y055", genre: "G001" }, // 新宿 × 居酒屋(990件)
  { area: "Y055", genre: "G004" }, // 新宿 × 和食
  { area: "Y055", genre: "G008" }, // 新宿 × 焼肉・ホルモン
  { area: "Y005", genre: "G001" }, // 銀座・有楽町・新橋 × 居酒屋
  { area: "Y005", genre: "G004" }, // 銀座・有楽町・新橋 × 和食
  { area: "Y005", genre: "G006" }, // 銀座・有楽町・新橋 × イタリアン・フレンチ
  { area: "Y030", genre: "G001" }, // 渋谷 × 居酒屋
  { area: "Y050", genre: "G001" }, // 池袋 × 居酒屋
  { area: "Y050", genre: "G004" }, // 池袋 × 和食
  { area: "Y010", genre: "G001" }, // 東京・大手町・日本橋 × 居酒屋
  { area: "Y015", genre: "G001" }, // 上野・御徒町・浅草 × 居酒屋
  { area: "Y020", genre: "G001" }, // 神田・秋葉原 × 居酒屋
  { area: "Y025", genre: "G001" }, // 品川・五反田 × 居酒屋
  { area: "Y045", genre: "G001" }, // 赤坂・六本木 × 居酒屋
  { area: "Y045", genre: "G004" }, // 赤坂・六本木 × 和食
  // 東京以外
  { area: "Y135", genre: "G001" }, // 横浜 × 居酒屋
  { area: "Y300", genre: "G001" }, // 梅田 × 居酒屋
  { area: "Y300", genre: "G008" }, // 梅田 × 焼肉・ホルモン
  { area: "Y315", genre: "G001" }, // 心斎橋・なんば × 居酒屋
  { area: "Y315", genre: "G008" }, // 心斎橋・なんば × 焼肉・ホルモン
  { area: "Y200", genre: "G001" }, // 名古屋駅 × 居酒屋
  { area: "Y500", genre: "G001" }, // すすきの × 居酒屋
  { area: "Y500", genre: "G008" }, // すすきの × 焼肉・ホルモン
  { area: "Y700", genre: "G001" }, // 博多 × 居酒屋
  { area: "Y706", genre: "G001" }, // 天神・西中洲・春吉 × 居酒屋
];

export function isLandingPage(area: string, genre: string): boolean {
  return LANDING_PAGES.some((p) => p.area === area && p.genre === genre);
}
