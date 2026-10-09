// メニュー。料理20種(キッチン)とドリンク20種(ホール)。
// 時間は秒。ドリンクの relief は、出したときにお客さんの我慢ゲージが戻る割合(0〜1)。
// 手間のかかるものほど、効き目が大きい。

// 料理は、食材を2〜3個、冷蔵庫から取って、それぞれ「焼く・茹でる・揚げる」のどれかで調理し、
// 盛り付け台で1皿にする。食材は40種。調理法ごとに専用の調理場がある。
export type Method = "grill" | "boil" | "fry";
export const METHOD_NAME: Record<Method, string> = { grill: "焼き", boil: "茹で", fry: "揚げ" };

export interface Ingredient {
  name: string;
  method: Method;
  cook: number; // 調理にかかる秒数
}

// 焼く16・茹でる12・揚げる12
export const INGREDIENTS: Ingredient[] = [
  // 焼く
  { name: "合い挽き肉", method: "grill", cook: 5 },
  { name: "牛ステーキ肉", method: "grill", cook: 7 },
  { name: "鶏もも肉", method: "grill", cook: 5 },
  { name: "豚バラ肉", method: "grill", cook: 4 },
  { name: "卵", method: "grill", cook: 2 },
  { name: "玉ねぎ", method: "grill", cook: 3 },
  { name: "ピーマン", method: "grill", cook: 2 },
  { name: "しいたけ", method: "grill", cook: 3 },
  { name: "ごはん", method: "grill", cook: 3 },
  { name: "食パン", method: "grill", cook: 2 },
  { name: "チーズ", method: "grill", cook: 1 },
  { name: "ベーコン", method: "grill", cook: 3 },
  { name: "焼き鳥串", method: "grill", cook: 5 },
  { name: "鮭", method: "grill", cook: 5 },
  { name: "なす", method: "grill", cook: 3 },
  { name: "餃子", method: "grill", cook: 4 },
  // 茹でる
  { name: "スパゲッティ", method: "boil", cook: 6 },
  { name: "中華麺", method: "boil", cook: 5 },
  { name: "豆腐", method: "boil", cook: 2 },
  { name: "にんじん", method: "boil", cook: 3 },
  { name: "ブロッコリー", method: "boil", cook: 2 },
  { name: "ほうれん草", method: "boil", cook: 2 },
  { name: "トウモロコシ", method: "boil", cook: 3 },
  { name: "カレー", method: "boil", cook: 6 },
  { name: "煮豚", method: "boil", cook: 6 },
  { name: "煮卵", method: "boil", cook: 3 },
  { name: "白米", method: "boil", cook: 5 },
  { name: "焼売", method: "boil", cook: 4 },
  // 揚げる
  { name: "フライドポテト", method: "fry", cook: 4 },
  { name: "から揚げ肉", method: "fry", cook: 5 },
  { name: "豚ロース", method: "fry", cook: 6 },
  { name: "えび", method: "fry", cook: 3 },
  { name: "かぼちゃ", method: "fry", cook: 3 },
  { name: "白身魚", method: "fry", cook: 4 },
  { name: "いか", method: "fry", cook: 3 },
  { name: "コロッケ", method: "fry", cook: 4 },
  { name: "春巻き", method: "fry", cook: 4 },
  { name: "アスパラ", method: "fry", cook: 2 },
  { name: "れんこん", method: "fry", cook: 3 },
  { name: "チキンカツ", method: "fry", cook: 5 },
];

const ing = (name: string): number => {
  const i = INGREDIENTS.findIndex((x) => x.name === name);
  if (i < 0) throw new Error(`食材が見つかりません: ${name}`);
  return i;
};

export interface DishInfo {
  name: string;
  parts: number[]; // INGREDIENTS の番号
}

const dish = (name: string, ...parts: string[]): DishInfo => ({ name, parts: parts.map(ing) });

// 料理20種。どの食材もどれかの料理で使う。
export const DISHES: DishInfo[] = [
  dish("湯豆腐", "豆腐", "ほうれん草", "しいたけ"),
  dish("温野菜サラダ", "ブロッコリー", "にんじん", "トウモロコシ"),
  dish("焼きおにぎり", "ごはん", "鮭"),
  dish("チーズポテト", "フライドポテト", "チーズ"),
  dish("ホットサンド", "食パン", "ベーコン", "卵"),
  dish("から揚げ定食", "から揚げ肉", "白米", "ピーマン"),
  dish("点心盛り合わせ", "餃子", "焼売", "春巻き"),
  dish("焼き鳥盛り合わせ", "焼き鳥串", "ピーマン", "玉ねぎ"),
  dish("コロッケカレー", "カレー", "白米", "コロッケ"),
  dish("ナポリタン", "スパゲッティ", "玉ねぎ", "ベーコン"),
  dish("チャーハン", "ごはん", "卵", "豚バラ肉"),
  dish("ハンバーグ定食", "合い挽き肉", "にんじん", "フライドポテト"),
  dish("オムライス", "卵", "鶏もも肉", "ごはん"),
  dish("カルボナーラ", "スパゲッティ", "ベーコン", "卵"),
  dish("ラーメン", "中華麺", "煮豚", "煮卵"),
  dish("とんかつ定食", "豚ロース", "白米", "ほうれん草"),
  dish("天ぷら盛り合わせ", "えび", "かぼちゃ", "れんこん"),
  dish("ステーキ", "牛ステーキ肉", "アスパラ", "フライドポテト"),
  dish("フライ盛り合わせ", "白身魚", "いか", "チキンカツ"),
  dish("焼きなすと鶏もも", "なす", "鶏もも肉", "ピーマン"),
];

export interface DrinkInfo {
  name: string;
  make: number;
  relief: number;
}

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

export const ingredientName = (i: number): string => INGREDIENTS[i]?.name ?? "?";
export const methodOfIngredient = (i: number): Method => INGREDIENTS[i]?.method ?? "grill";
export const dishName = (i: number): string => DISHES[i]?.name ?? "?";
export const drinkName = (i: number): string => DRINKS[i]?.name ?? "?";
