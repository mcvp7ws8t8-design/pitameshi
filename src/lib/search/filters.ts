/**
 * 絞り込み項目の定義(要件定義書「絞り込み項目一覧」)。
 * - kind: "apiFlag" はホットペッパーAPIのパラメータに "1" を渡すだけで絞れる項目
 * - それ以外はサーバー側で判定する項目(src/lib/search/engine.ts)
 * - release: その項目を入れるリリース(要件定義書「リリース計画」)
 * - common: プリセット未選択時に「よく使う条件」として最初から見せるか(U-01)
 * - help: 紛らわしい用語の説明(U-08)
 */

export type FilterCategory =
  | "場所"
  | "ジャンル・予算"
  | "人数・席"
  | "飲む"
  | "食べる"
  | "時間"
  | "タバコ"
  | "設備"
  | "支払い"
  | "誰と"
  | "雰囲気"
  | "お得";

export const CATEGORY_ORDER: FilterCategory[] = [
  "場所",
  "ジャンル・予算",
  "人数・席",
  "飲む",
  "食べる",
  "時間",
  "タバコ",
  "設備",
  "支払い",
  "誰と",
  "雰囲気",
  "お得",
];

export type ApiFlagDef = {
  kind: "apiFlag";
  id: string; // = APIのパラメータ名
  label: string;
  category: FilterCategory;
  help?: string;
  release: 1 | 2 | 3;
  /** APIに渡す値(ほとんどは "1"。クーポンだけ "0" = あり) */
  apiValue?: string;
  /**
   * 一覧のバッジや詳細に使うレスポンス項目。
   * sommelier・open_air・equipment・ktai・night_view などは検索条件には使えるが、
   * 実際のレスポンスに項目がない(2026-09 実データで確認)ので field を持たない。
   */
  field?: string;
};

export const API_FLAGS: ApiFlagDef[] = [
  // 人数・席
  { kind: "apiFlag", id: "private_room", label: "個室あり", category: "人数・席", release: 1, field: "private_room", help: "完全個室のほか、半個室を含むお店もあります。詳細はお店のページで確認してください。" },
  { kind: "apiFlag", id: "tatami", label: "座敷あり", category: "人数・席", release: 1, field: "tatami", help: "靴を脱いで上がる畳の席です。" },
  { kind: "apiFlag", id: "horigotatsu", label: "掘りごたつあり", category: "人数・席", release: 1, field: "horigotatsu", help: "座敷の床が掘り下げてあり、足を下ろして座れる席です。" },
  { kind: "apiFlag", id: "charter", label: "貸切できる", category: "人数・席", release: 1, field: "charter", help: "お店全体、またはフロアを自分たちだけで使えることです。人数の条件はお店ごとに違います。" },
  { kind: "apiFlag", id: "open_air", label: "オープンエア(テラスなど)", category: "人数・席", release: 1 },
  // 飲む
  { kind: "apiFlag", id: "free_drink", label: "飲み放題あり", category: "飲む", release: 1, field: "free_drink" },
  { kind: "apiFlag", id: "sommelier", label: "ソムリエがいる", category: "飲む", release: 1 },
  // 食べる
  { kind: "apiFlag", id: "course", label: "コースあり", category: "食べる", release: 1, field: "course" },
  { kind: "apiFlag", id: "free_food", label: "食べ放題あり", category: "食べる", release: 1, field: "free_food" },
  { kind: "apiFlag", id: "lunch", label: "ランチあり", category: "食べる", release: 1, field: "lunch" },
  { kind: "apiFlag", id: "midnight_meal", label: "23時以降も食事できる", category: "食べる", release: 1 },
  // 時間
  { kind: "apiFlag", id: "midnight", label: "23時以降も営業", category: "時間", release: 1, field: "midnight" },
  // タバコ(APIでは「禁煙席あり」しか絞れない。喫煙可・分煙・全席禁煙は SMOKING_OPTIONS でサーバー側判定)
  { kind: "apiFlag", id: "non_smoking", label: "禁煙席あり", category: "タバコ", release: 1, field: "non_smoking", help: "禁煙の席が少なくとも一部あるお店です。全席禁煙とは限りません。" },
  // 設備
  { kind: "apiFlag", id: "wifi", label: "Wi-Fiあり", category: "設備", release: 1, field: "wifi" },
  { kind: "apiFlag", id: "parking", label: "駐車場あり", category: "設備", release: 1, field: "parking" },
  { kind: "apiFlag", id: "barrier_free", label: "バリアフリー", category: "設備", release: 1, field: "barrier_free" },
  { kind: "apiFlag", id: "tv", label: "TV・プロジェクター", category: "設備", release: 1, field: "tv" },
  { kind: "apiFlag", id: "karaoke", label: "カラオケあり", category: "設備", release: 1, field: "karaoke" },
  { kind: "apiFlag", id: "band", label: "バンド演奏できる", category: "設備", release: 1, field: "band" },
  { kind: "apiFlag", id: "show", label: "ライブ・ショーあり", category: "設備", release: 1, field: "show" },
  { kind: "apiFlag", id: "equipment", label: "エンタメ設備", category: "設備", release: 1, help: "ダーツ・ビリヤードなどの遊べる設備です。" },
  { kind: "apiFlag", id: "ktai", label: "携帯電話がつながる", category: "設備", release: 1 },
  // 支払い
  { kind: "apiFlag", id: "card", label: "カード払いできる", category: "支払い", release: 1, field: "card" },
  // 誰と
  { kind: "apiFlag", id: "child", label: "お子様連れOK", category: "誰と", release: 1, field: "child" },
  { kind: "apiFlag", id: "pet", label: "ペット可", category: "誰と", release: 1, field: "pet" },
  { kind: "apiFlag", id: "english", label: "英語メニューあり", category: "誰と", release: 1, field: "english" },
  { kind: "apiFlag", id: "wedding", label: "ウェディング二次会の相談可", category: "誰と", release: 1, field: "wedding" },
  // 雰囲気
  { kind: "apiFlag", id: "night_view", label: "夜景がキレイ", category: "雰囲気", release: 1 },
  // お得
  { kind: "apiFlag", id: "ktai_coupon", label: "クーポンあり", category: "お得", release: 1, apiValue: "0" },
];

export const API_FLAG_BY_ID = new Map(API_FLAGS.map((f) => [f.id, f]));

/** お酒の種類(S-02)。1つならAPIでそのまま絞り、2つ以上なら「どれか」をサーバー側で統合する。 */
export const ALCOHOL_OPTIONS = [
  { id: "sake", label: "日本酒が充実" },
  { id: "shochu", label: "焼酎が充実" },
  { id: "wine", label: "ワインが充実" },
  { id: "cocktail", label: "カクテルが充実" },
] as const;
export type AlcoholId = (typeof ALCOHOL_OPTIONS)[number]["id"];

/** タバコ(S-03)。店舗データの「禁煙席」の記載から判定する(src/lib/search/smoking.ts)。 */
export const SMOKING_OPTIONS = [
  { id: "ok", label: "喫煙できる(分煙を含む)", help: "店内のどこかでタバコを吸えるお店です。喫煙できる席・部屋には20歳未満は入れません。" },
  { id: "separated", label: "分煙", help: "禁煙の席と、喫煙できる席(または喫煙室)が分かれているお店です。" },
  { id: "none", label: "全席禁煙", help: "店内はすべて禁煙のお店です。" },
] as const;
export type SmokingFilter = (typeof SMOKING_OPTIONS)[number]["id"];

/** 並び順(S-06)。recommend と distance 以外はサーバー側で並べ替える。 */
export const SORT_OPTIONS = [
  { id: "recommend", label: "おすすめ順" },
  { id: "distance", label: "近い順(現在地検索のみ)" },
  { id: "budget_asc", label: "予算が安い順" },
  { id: "party_desc", label: "宴会の人数が多い順" },
  { id: "seats_desc", label: "席数が多い順" },
] as const;
export type SortId = (typeof SORT_OPTIONS)[number]["id"];

/** 現在地からの範囲(API仕様の5段階) */
export const RANGE_OPTIONS = [
  { value: 1, label: "300m" },
  { value: 2, label: "500m" },
  { value: 3, label: "1km" },
  { value: 4, label: "2km" },
  { value: 5, label: "3km" },
] as const;

/** 駅から徒歩(分)。不動産の表示ルールに合わせて 80m = 徒歩1分 で計算する。 */
export const WALK_OPTIONS = [3, 5, 10] as const;
export const METERS_PER_WALK_MINUTE = 80;

/** 情報がない店の扱い(U-07)で使う、紛らわしい用語の説明(U-08) */
export const GLOSSARY: Record<string, string> = {
  unknown: "お店の情報に記載がない項目です。条件に合う可能性もあるため、「不明の店も含める」をオンにすると一覧に出します。",
  partyCapacity: "宴会で一度に入れる最大の人数です。お店の総席数とは違います。",
  seats: "お店の席の合計です。",
  walk: "最寄り駅から店までの直線距離を、80m=1分として計算した目安です。実際の道のりより短くなることがあります。",
};
