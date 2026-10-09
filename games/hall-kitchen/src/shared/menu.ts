// メニュー。料理20種(キッチン)とドリンク20種(ホール)。
// 時間は秒。ドリンクの relief は、出したときにお客さんの我慢ゲージが戻る割合(0〜1)。
// 手間のかかるものほど、効き目が大きい。

// 料理は、焼く・茹でる・揚げるのどれか1つで作る。それぞれ専用の調理場がある。
export type Method = "grill" | "boil" | "fry";
export const METHOD_NAME: Record<Method, string> = { grill: "焼き", boil: "茹で", fry: "揚げ" };

export interface DishInfo {
  name: string;
  cook: number;
  method: Method;
}
export interface DrinkInfo {
  name: string;
  make: number;
  relief: number;
}

// 焼く 8種 / 茹でる 7種 / 揚げる 5種。順番は client/items.ts の見た目の表と同じ
export const DISHES: DishInfo[] = [
  { name: "湯豆腐", cook: 2, method: "boil" },
  { name: "温野菜サラダ", cook: 3, method: "boil" },
  { name: "コーンスープ", cook: 3, method: "boil" },
  { name: "焼きおにぎり", cook: 3, method: "grill" },
  { name: "フライドポテト", cook: 4, method: "fry" },
  { name: "ホットサンド", cook: 4, method: "grill" },
  { name: "から揚げ", cook: 5, method: "fry" },
  { name: "餃子", cook: 5, method: "grill" },
  { name: "焼き鳥", cook: 5, method: "grill" },
  { name: "カレーライス", cook: 6, method: "boil" },
  { name: "ナポリタン", cook: 6, method: "boil" },
  { name: "チャーハン", cook: 6, method: "grill" },
  { name: "ハンバーグ", cook: 7, method: "grill" },
  { name: "オムライス", cook: 7, method: "grill" },
  { name: "カルボナーラ", cook: 7, method: "boil" },
  { name: "ラーメン", cook: 8, method: "boil" },
  { name: "エビフライ", cook: 8, method: "fry" },
  { name: "とんかつ定食", cook: 9, method: "fry" },
  { name: "天ぷら盛り合わせ", cook: 9, method: "fry" },
  { name: "ステーキ", cook: 10, method: "grill" },
];

export const DRINKS: DrinkInfo[] = [
  { name: "お冷", make: 1, relief: 0.2 },
  { name: "烏龍茶", make: 1, relief: 0.25 },
  { name: "緑茶", make: 1, relief: 0.25 },
  { name: "コーラ", make: 1, relief: 0.3 },
  { name: "ジンジャーエール", make: 1, relief: 0.3 },
  { name: "オレンジジュース", make: 1, relief: 0.3 },
  { name: "アップルジュース", make: 1, relief: 0.3 },
  { name: "アイスコーヒー", make: 2, relief: 0.35 },
  { name: "ホットコーヒー", make: 2, relief: 0.35 },
  { name: "アイスティー", make: 2, relief: 0.35 },
  { name: "ホットティー", make: 2, relief: 0.35 },
  { name: "レモンスカッシュ", make: 2, relief: 0.35 },
  { name: "生ビール", make: 2, relief: 0.4 },
  { name: "ハイボール", make: 2, relief: 0.4 },
  { name: "梅酒", make: 2, relief: 0.4 },
  { name: "カフェラテ", make: 3, relief: 0.4 },
  { name: "ココア", make: 3, relief: 0.4 },
  { name: "レモンサワー", make: 3, relief: 0.45 },
  { name: "ワイン", make: 3, relief: 0.5 },
  { name: "日本酒", make: 3, relief: 0.5 },
];

export const methodOf = (i: number): Method => DISHES[i]?.method ?? "grill";
export const dishName = (i: number): string => DISHES[i]?.name ?? "?";
export const drinkName = (i: number): string => DRINKS[i]?.name ?? "?";
