// メニュー。料理20種(キッチン)とドリンク20種(ホール)。
// 時間は秒。ドリンクの relief は、出したときにお客さんの我慢ゲージが戻る割合(0〜1)。
// 手間のかかるものほど、効き目が大きい。

// 料理は、食材を2〜3個、冷蔵庫から取って、それぞれ「焼く・茹でる・揚げる」のどれかで調理し、
// 盛り付け台で1皿にする。食材は40種。調理法ごとに専用の調理場がある。
export type Method = "grill" | "boil" | "fry";
export const METHOD_NAME: Record<Method, string> = { grill: "焼き", boil: "茹で", fry: "揚げ" };

export interface Ingredient {
  id: string; // クライアントの3Dモデル(src/client/zukan.ts)の名前
  name: string;
  method: Method;
  cook: number; // 調理にかかる秒数
}

// 焼く15・茹でる15・揚げる10。id は、クライアントの3Dモデル(src/client/zukan.ts)の名前
export const INGREDIENTS: Ingredient[] = [
  // 焼く
  { id: "ground_meat", name: "合い挽き肉", method: "grill", cook: 5 },
  { id: "beef", name: "牛肉", method: "grill", cook: 7 },
  { id: "chicken", name: "鶏肉", method: "grill", cook: 5 },
  { id: "pork", name: "豚肉", method: "grill", cook: 4 },
  { id: "bacon", name: "ベーコン", method: "grill", cook: 3 },
  { id: "salmon", name: "鮭", method: "grill", cook: 5 },
  { id: "tuna", name: "まぐろ", method: "grill", cook: 3 },
  { id: "egg", name: "卵", method: "grill", cook: 2 },
  { id: "bread", name: "食パン", method: "grill", cook: 2 },
  { id: "butter", name: "バター", method: "grill", cook: 1 },
  { id: "tomato", name: "トマト", method: "grill", cook: 2 },
  { id: "lemon", name: "レモン", method: "grill", cook: 1 },
  { id: "nori", name: "のり", method: "grill", cook: 1 },
  { id: "salt", name: "塩", method: "grill", cook: 1 },
  { id: "mayonnaise", name: "マヨネーズ", method: "grill", cook: 2 },
  // 茹でる
  { id: "pasta", name: "パスタ", method: "boil", cook: 6 },
  { id: "chinese_noodles", name: "中華麺", method: "boil", cook: 5 },
  { id: "rice", name: "米", method: "boil", cook: 5 },
  { id: "tofu", name: "豆腐", method: "boil", cook: 2 },
  { id: "carrot", name: "にんじん", method: "boil", cook: 3 },
  { id: "cabbage", name: "キャベツ", method: "boil", cook: 2 },
  { id: "lettuce", name: "レタス", method: "boil", cook: 1 },
  { id: "cucumber", name: "きゅうり", method: "boil", cook: 1 },
  { id: "negi", name: "長ねぎ", method: "boil", cook: 1 },
  { id: "miso", name: "味噌", method: "boil", cook: 2 },
  { id: "curry_roux", name: "カレールー", method: "boil", cook: 4 },
  { id: "milk", name: "牛乳", method: "boil", cook: 2 },
  { id: "soy_sauce", name: "しょうゆ", method: "boil", cook: 2 },
  { id: "ketchup", name: "ケチャップ", method: "boil", cook: 2 },
  { id: "strawberry", name: "いちご", method: "boil", cook: 1 },
  // 揚げる
  { id: "shrimp", name: "えび", method: "fry", cook: 3 },
  { id: "flour", name: "小麦粉", method: "fry", cook: 2 },
  { id: "breadcrumbs", name: "パン粉", method: "fry", cook: 2 },
  { id: "potato", name: "じゃがいも", method: "fry", cook: 4 },
  { id: "eggplant", name: "なす", method: "fry", cook: 3 },
  { id: "garlic", name: "にんにく", method: "fry", cook: 2 },
  { id: "sausage", name: "ソーセージ", method: "fry", cook: 3 },
  { id: "onion", name: "玉ねぎ", method: "fry", cook: 3 },
  { id: "green_pepper", name: "ピーマン", method: "fry", cook: 2 },
  { id: "cheese", name: "チーズ", method: "fry", cook: 2 },
];

const ing = (name: string): number => {
  const i = INGREDIENTS.findIndex((x) => x.name === name);
  if (i < 0) throw new Error(`食材が見つかりません: ${name}`);
  return i;
};

export interface DishInfo {
  id: string; // クライアントの3Dモデル(src/client/zukan.ts)の名前
  name: string;
  parts: number[]; // INGREDIENTS の番号
}

const dish = (id: string, name: string, ...parts: string[]): DishInfo => ({ id, name, parts: parts.map(ing) });

// 料理20種。どの食材もどれかの料理で使う。皿の上には、ほかにも飾りの具が載っているが、調理するのは主な食材(最大3つ)だけ。
export const DISHES: DishInfo[] = [
  dish("omurice", "オムライス", "卵", "米", "ケチャップ"),
  dish("curry_rice", "カレーライス", "米", "カレールー", "じゃがいも"),
  dish("hamburg_steak", "ハンバーグ", "合い挽き肉", "玉ねぎ", "パン粉"),
  dish("hamburger", "ハンバーガー", "食パン", "合い挽き肉", "チーズ"),
  dish("napolitan", "ナポリタン", "パスタ", "ソーセージ", "ピーマン"),
  dish("ramen", "ラーメン", "中華麺", "豚肉", "しょうゆ"),
  dish("sushi", "寿司", "米", "まぐろ", "のり"),
  dish("onigiri", "おにぎり", "米", "鮭", "塩"),
  dish("miso_soup", "味噌汁", "味噌", "豆腐", "長ねぎ"),
  dish("tempura", "天ぷら", "えび", "なす", "小麦粉"),
  dish("tonkatsu", "とんかつ", "豚肉", "パン粉", "キャベツ"),
  dish("steak", "ステーキ", "牛肉", "にんにく", "バター"),
  dish("salad", "サラダ", "レタス", "トマト", "きゅうり"),
  dish("bacon_eggs", "ベーコンエッグ", "卵", "ベーコン", "食パン"),
  dish("sandwich", "サンドイッチ", "食パン", "卵", "マヨネーズ"),
  dish("pizza", "ピザ", "小麦粉", "チーズ", "ピーマン"),
  dish("gyoza", "餃子", "小麦粉", "合い挽き肉", "長ねぎ"),
  dish("grilled_salmon", "焼き鮭", "鮭", "塩", "レモン"),
  dish("cream_stew", "クリームシチュー", "牛乳", "鶏肉", "にんじん"),
  dish("pancakes", "パンケーキ", "小麦粉", "卵", "いちご"),
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
