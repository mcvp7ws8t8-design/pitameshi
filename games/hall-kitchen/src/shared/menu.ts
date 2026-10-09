// メニュー。料理20種(キッチン)とドリンク20種(ホール)。
// 時間は秒。ドリンクの relief は、出したときにお客さんの我慢ゲージが戻る割合(0〜1)。
// 手間のかかるものほど、効き目が大きい。

export interface DishInfo {
  name: string;
  cook: number;
}
export interface DrinkInfo {
  name: string;
  make: number;
  relief: number;
}

export const DISHES: DishInfo[] = [
  { name: "冷やっこ", cook: 2 },
  { name: "サラダ", cook: 3 },
  { name: "コーンスープ", cook: 3 },
  { name: "おにぎり", cook: 3 },
  { name: "フライドポテト", cook: 4 },
  { name: "サンドイッチ", cook: 4 },
  { name: "から揚げ", cook: 5 },
  { name: "餃子", cook: 5 },
  { name: "焼き鳥", cook: 5 },
  { name: "カレーライス", cook: 6 },
  { name: "ナポリタン", cook: 6 },
  { name: "チャーハン", cook: 6 },
  { name: "ハンバーグ", cook: 7 },
  { name: "オムライス", cook: 7 },
  { name: "カルボナーラ", cook: 7 },
  { name: "ラーメン", cook: 8 },
  { name: "寿司盛り合わせ", cook: 8 },
  { name: "とんかつ定食", cook: 9 },
  { name: "天ぷら盛り合わせ", cook: 9 },
  { name: "ステーキ", cook: 10 },
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

export const dishName = (i: number): string => DISHES[i]?.name ?? "?";
export const drinkName = (i: number): string => DRINKS[i]?.name ?? "?";
