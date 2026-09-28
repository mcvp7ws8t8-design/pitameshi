import { budgetCodesFor } from "../hotpepper/masters";
import type { SearchState } from "./query";

/**
 * 目的別プリセット(要件定義書 S-01・絞り込み項目一覧)。
 * - apply: プリセットを選んだときに最初から入る条件(あとから自由に外せる)
 * - common: そのプリセットで「よく使う条件」として最初に見せる項目のID(U-01)
 *   ID は filters.ts の APIフラグID、または下の SPECIAL_FILTER_IDS
 * - mode: "cafe" はOSMのカフェ検索(/cafes)に進む
 * - release: 要件定義書「リリース計画」
 */
export type Preset = {
  id: string;
  label: string;
  emoji: string;
  description: string;
  release: 1 | 2 | 3;
  mode?: "shop" | "cafe";
  beta?: boolean;
  apply: Partial<Pick<SearchState, "genres" | "budgets" | "flags" | "partyMin" | "keyword" | "alcohol" | "sort">>;
  common: string[];
};

/** APIフラグ以外で「よく使う条件」に出せる項目 */
export const SPECIAL_FILTER_IDS = ["genre", "budget", "partyMin", "partyMax", "smoking", "alcohol", "walk", "seatsMin"] as const;

const DEFAULT_COMMON = ["genre", "budget", "partyMin", "private_room", "free_drink", "smoking", "alcohol", "midnight"];

export const PRESETS: Preset[] = [
  {
    id: "nomikai",
    label: "飲み会",
    emoji: "🍻",
    description: "居酒屋・バルで飲み放題、1人4,000円まで",
    release: 1,
    apply: { genres: ["G001", "G002"], flags: ["free_drink"], budgets: budgetCodesFor(0, 4000) },
    common: ["partyMin", "private_room", "smoking", "alcohol", "midnight", "tatami", "budget"],
  },
  {
    id: "sobetsu",
    label: "歓送迎会・宴会",
    emoji: "🎉",
    description: "20名以上・コースと飲み放題あり、1人3,001〜5,000円",
    release: 1,
    apply: { partyMin: 20, flags: ["course", "free_drink"], budgets: budgetCodesFor(3001, 5000) },
    common: ["partyMin", "partyMax", "charter", "private_room", "tv", "smoking", "walk"],
  },
  {
    id: "kashikiri",
    label: "大人数・貸切",
    emoji: "🏠",
    description: "貸切できる40名以上のお店",
    release: 2,
    apply: { partyMin: 40, flags: ["charter"] },
    common: ["partyMin", "partyMax", "free_drink", "course", "karaoke", "band", "tv"],
  },
  {
    id: "nijikai",
    label: "二次会・深夜",
    emoji: "🌙",
    description: "23時以降も営業している居酒屋・バー",
    release: 1,
    apply: { genres: ["G001", "G002", "G012", "G011"], flags: ["midnight"] },
    common: ["karaoke", "free_drink", "smoking", "walk", "midnight_meal"],
  },
  {
    id: "settai",
    label: "接待・会食",
    emoji: "🤝",
    description: "個室・カード払いできる和食、1人5,001円以上",
    release: 1,
    apply: { genres: ["G004"], flags: ["private_room", "card"], budgets: budgetCodesFor(5001, Number.POSITIVE_INFINITY) },
    common: ["genre", "horigotatsu", "sommelier", "smoking", "walk", "budget"],
  },
  {
    id: "date",
    label: "デート",
    emoji: "💐",
    description: "イタリアン・フレンチ・バーなど、1人3,001〜7,000円",
    release: 1,
    apply: { genres: ["G006", "G002", "G012"], budgets: budgetCodesFor(3001, 7000) },
    common: ["night_view", "private_room", "alcohol", "smoking", "genre", "budget"],
  },
  {
    id: "birthday",
    label: "誕生日・記念日",
    emoji: "🎂",
    description: "お祝いに使えるお店(キーワード「誕生日」)",
    release: 2,
    // TODO: 特集マスタAPIの「誕生日・記念日」系の特集コードが確認できたら special に置き換える
    apply: { keyword: "誕生日", budgets: budgetCodesFor(3001, 10000) },
    common: ["private_room", "night_view", "course", "genre", "budget"],
  },
  {
    id: "joshikai",
    label: "女子会",
    emoji: "🥂",
    description: "飲み放題つきのお店(キーワード「女子会」)",
    release: 2,
    // TODO: 特集コードに置き換える
    apply: { keyword: "女子会", flags: ["free_drink"] },
    common: ["private_room", "smoking", "alcohol", "budget", "genre"],
  },
  {
    id: "hitori",
    label: "一人飲み",
    emoji: "🍶",
    description: "カウンターのある居酒屋・バー(試験中)",
    release: 3,
    beta: true,
    // APIに該当項目がないため、キーワードで近似する(要検証)
    apply: { keyword: "カウンター", genres: ["G001", "G012"] },
    common: ["smoking", "alcohol", "midnight", "budget"],
  },
  {
    id: "lunch",
    label: "ランチ",
    emoji: "🍱",
    description: "ランチ営業のあるお店",
    release: 1,
    apply: { flags: ["lunch"] },
    common: ["genre", "non_smoking", "card", "child", "walk"],
  },
  {
    id: "kodure",
    label: "子連れ",
    emoji: "👶",
    description: "お子様連れOK・禁煙席あり",
    release: 1,
    apply: { flags: ["child", "non_smoking"] },
    common: ["tatami", "private_room", "parking", "barrier_free", "genre", "budget"],
  },
  {
    id: "pet",
    label: "ペット連れ",
    emoji: "🐕",
    description: "ペットと入れるお店",
    release: 2,
    apply: { flags: ["pet"] },
    common: ["open_air", "genre", "budget", "smoking"],
  },
  {
    id: "foreign",
    label: "外国人と",
    emoji: "🌏",
    description: "英語メニューのあるお店",
    release: 2,
    apply: { flags: ["english"] },
    common: ["card", "wifi", "genre", "budget", "smoking"],
  },
  {
    id: "cafe-work",
    label: "カフェで作業",
    emoji: "💻",
    description: "Wi-Fi・電源のあるカフェ",
    release: 2,
    mode: "cafe",
    apply: {},
    common: [],
  },
  {
    id: "cafe-rest",
    label: "カフェで休憩",
    emoji: "☕",
    description: "近くのカフェ・喫茶店",
    release: 2,
    mode: "cafe",
    apply: {},
    common: [],
  },
];

export const PRESET_BY_ID = new Map(PRESETS.map((p) => [p.id, p]));

/** 公開中のリリース。これ以下の release のプリセット・機能を表示する。 */
export const CURRENT_RELEASE = 2 as const;

export function visiblePresets(release: number = CURRENT_RELEASE): Preset[] {
  return PRESETS.filter((p) => p.release <= release);
}

export function commonFilterIds(presetId: string | undefined): string[] {
  return PRESET_BY_ID.get(presetId ?? "")?.common ?? DEFAULT_COMMON;
}

/** プリセットを選んだときの検索条件。場所・並び順は今の状態を引き継ぐ。 */
export function applyPreset(base: SearchState, preset: Preset): SearchState {
  return {
    ...base,
    genres: preset.apply.genres ?? [],
    budgets: preset.apply.budgets ?? [],
    flags: preset.apply.flags ?? [],
    partyMin: preset.apply.partyMin,
    partyMax: undefined,
    seatsMin: undefined,
    // プリセットのキーワード(「誕生日」など)は検索時に足す(engine.ts)。利用者が入れたキーワードはそのまま残す。
    keyword: base.keyword,
    alcohol: preset.apply.alcohol ?? [],
    smoking: undefined,
    walkMax: undefined,
    sort: preset.apply.sort ?? base.sort,
    preset: preset.id,
    page: 1,
  };
}
