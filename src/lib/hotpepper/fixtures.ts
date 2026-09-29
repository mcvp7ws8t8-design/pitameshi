import type { HotpepperShop } from "./types";

/**
 * 仮データ(APIキーがないとき用)。店名・内容はすべて架空。
 * 実際のAPIでは返らない条件(日本酒充実・夜景など)は mock_tags に持たせ、仮の検索でだけ使う。
 */
export type MockShop = HotpepperShop & { mock_tags?: string[] };

type Seed = {
  name: string;
  genre: [string, string];
  middle: "Y005" | "Y055";
  budget: [string, string, string]; // code, name, average
  party?: number;
  seats?: number;
  smoking: string;
  yes: string[]; // 「あり」になる項目
  tags?: string[];
  catch: string;
  coupon?: boolean;
};

const MIDDLE = {
  Y005: { name: "銀座・有楽町・新橋・築地・月島", station: "銀座", base: { lat: 35.6717, lng: 139.765 }, small: { code: "X010", name: "銀座5～8丁目" } },
  Y055: { name: "新宿", station: "新宿", base: { lat: 35.6905, lng: 139.7005 }, small: { code: "X150", name: "東口・歌舞伎町方面" } },
} as const;

const SEEDS: Seed[] = [
  { name: "炉端 ひなた", genre: ["G001", "居酒屋"], middle: "Y055", budget: ["B002", "2001～3000円", "3000円"], party: 40, seats: 60, smoking: "禁煙席なし", yes: ["free_drink", "private_room", "course", "tatami", "midnight", "card"], tags: ["sake", "shochu", "midnight_meal"], catch: "炭火の炉端焼きと地酒", coupon: true },
  { name: "大衆酒場 ことぶき", genre: ["G001", "居酒屋"], middle: "Y055", budget: ["B001", "1501～2000円", "1800円"], party: 25, seats: 45, smoking: "禁煙席なし", yes: ["free_drink", "midnight", "tatami"], tags: ["shochu", "midnight_meal"], catch: "せんべろ価格の大衆酒場" },
  { name: "個室和食 月あかり", genre: ["G004", "和食"], middle: "Y005", budget: ["B016", "6001～7000円", "6500円"], party: 30, seats: 50, smoking: "全面禁煙", yes: ["private_room", "course", "horigotatsu", "card", "english"], tags: ["sake"], catch: "全室個室の会席料理" },
  { name: "トラットリア ソーレ", genre: ["G006", "イタリアン・フレンチ"], middle: "Y005", budget: ["B003", "3001～4000円", "4000円"], party: 20, seats: 32, smoking: "全面禁煙", yes: ["course", "card", "lunch", "wifi", "child"], tags: ["wine", "night_view"], catch: "薪窯ピッツァと自然派ワイン" },
  { name: "Bar 灯台", genre: ["G012", "バー・カクテル"], middle: "Y005", budget: ["B003", "3001～4000円", "3500円"], party: 12, seats: 18, smoking: "禁煙席なし", yes: ["midnight", "card"], tags: ["cocktail", "wine"], catch: "カウンター10席のオーセンティックバー" },
  { name: "肉バル ミートクラブ", genre: ["G002", "ダイニングバー・バル"], middle: "Y055", budget: ["B002", "2001～3000円", "2800円"], party: 60, seats: 80, smoking: "一部禁煙", yes: ["free_drink", "private_room", "course", "charter", "tv", "card", "midnight"], tags: ["wine"], catch: "熟成肉と飲み放題の大箱バル", coupon: true },
  { name: "宴会場 はなみずき", genre: ["G001", "居酒屋"], middle: "Y055", budget: ["B008", "4001～5000円", "4500円"], party: 120, seats: 150, smoking: "一部禁煙(喫煙専用室あり)", yes: ["free_drink", "private_room", "course", "charter", "tatami", "tv", "karaoke", "card"], tags: ["sake", "shochu"], catch: "最大120名の宴会専用フロア" },
  { name: "焼肉 うしかい", genre: ["G008", "焼肉・ホルモン"], middle: "Y055", budget: ["B003", "3001～4000円", "3800円"], party: 36, seats: 52, smoking: "全面禁煙", yes: ["free_drink", "private_room", "course", "card", "child", "midnight"], tags: ["midnight_meal"], catch: "個室で楽しむ黒毛和牛" },
  { name: "中華酒場 紅楼", genre: ["G007", "中華"], middle: "Y005", budget: ["B002", "2001～3000円", "2500円"], party: 50, seats: 70, smoking: "一部禁煙", yes: ["free_drink", "course", "lunch", "card", "tatami", "child"], tags: ["shochu"], catch: "本格点心と紹興酒" },
  { name: "Cafe こもれび", genre: ["G014", "カフェ・スイーツ"], middle: "Y005", budget: ["B010", "501～1000円", "900円"], seats: 28, smoking: "全面禁煙", yes: ["lunch", "wifi", "child", "pet"], tags: [], catch: "テラス席でペットと過ごせるカフェ" },
  { name: "ラーメン 麺屋しずく", genre: ["G013", "ラーメン"], middle: "Y055", budget: ["B010", "501～1000円", "950円"], seats: 12, smoking: "全面禁煙", yes: ["midnight", "lunch"], tags: ["midnight_meal"], catch: "鶏白湯の人気店" },
  { name: "創作ダイニング 環", genre: ["G003", "創作料理"], middle: "Y005", budget: ["B008", "4001～5000円", "5000円"], party: 40, seats: 55, smoking: "全面禁煙", yes: ["free_drink", "private_room", "course", "card", "wifi", "tv"], tags: ["wine", "sake", "night_view"], catch: "夜景の見える創作和洋ダイニング" },
  { name: "韓国料理 ソウル食堂", genre: ["G017", "韓国料理"], middle: "Y055", budget: ["B002", "2001～3000円", "2500円"], party: 30, seats: 40, smoking: "禁煙席なし", yes: ["free_drink", "course", "midnight", "tatami"], tags: ["midnight_meal"], catch: "サムギョプサルと韓国焼酎" },
  { name: "カラオケ酒場 ドレミ", genre: ["G011", "カラオケ・パーティ"], middle: "Y055", budget: ["B002", "2001～3000円", "2500円"], party: 80, seats: 100, smoking: "禁煙席なし", yes: ["free_drink", "private_room", "karaoke", "charter", "midnight", "tv", "card"], tags: ["midnight_meal"], catch: "朝まで歌える二次会向け", coupon: true },
  { name: "鮨 まさご", genre: ["G004", "和食"], middle: "Y005", budget: ["B021", "12001～15000円", "13000円"], party: 8, seats: 14, smoking: "全面禁煙", yes: ["private_room", "card", "english"], tags: ["sake"], catch: "カウンター江戸前鮨" },
  { name: "ビストロ 小さな庭", genre: ["G006", "イタリアン・フレンチ"], middle: "Y055", budget: ["B015", "5001～6000円", "6000円"], party: 16, seats: 24, smoking: "全面禁煙", yes: ["course", "card", "private_room"], tags: ["wine", "night_view"], catch: "記念日にも使えるビストロ" },
  { name: "串カツ だるま家", genre: ["G001", "居酒屋"], middle: "Y005", budget: ["B001", "1501～2000円", "2000円"], party: 20, seats: 30, smoking: "禁煙席なし", yes: ["free_drink", "midnight"], tags: ["shochu"], catch: "立ち飲みもできる串カツ" },
  { name: "エスニック食堂 スパイス", genre: ["G009", "アジア・エスニック料理"], middle: "Y055", budget: ["B001", "1501～2000円", "1800円"], party: 24, seats: 34, smoking: "全面禁煙", yes: ["lunch", "free_drink", "card", "pet", "wifi", "english"], tags: ["cocktail"], catch: "スパイスカレーとタイ料理" },
  { name: "居酒屋 ふるさと", genre: ["G001", "居酒屋"], middle: "Y055", budget: ["B002", "2001～3000円", ""], smoking: "未確認", yes: ["free_drink"], tags: ["sake"], catch: "郷土料理と地酒の店" },
  { name: "ホテルダイニング 星見台", genre: ["G005", "洋食"], middle: "Y005", budget: ["B018", "8001～9000円", "8500円"], party: 100, seats: 120, smoking: "全面禁煙", yes: ["private_room", "course", "charter", "card", "wifi", "barrier_free", "parking", "wedding", "english", "child"], tags: ["wine", "night_view"], catch: "高層階の夜景とコース料理" },
  { name: "お好み焼き てっぱん", genre: ["G016", "お好み焼き・もんじゃ"], middle: "Y005", budget: ["B002", "2001～3000円", "2500円"], party: 40, seats: 48, smoking: "一部禁煙", yes: ["free_drink", "tatami", "child", "lunch"], tags: [], catch: "もんじゃと鉄板焼き" },
  { name: "ダーツバー ブル", genre: ["G012", "バー・カクテル"], middle: "Y055", budget: ["B002", "2001～3000円", "2500円"], party: 50, seats: 60, smoking: "禁煙席なし", yes: ["free_drink", "charter", "equipment", "midnight", "tv"], tags: ["cocktail", "midnight_meal"], catch: "ダーツ台10台のバー" },
  { name: "和ダイニング 縁", genre: ["G004", "和食"], middle: "Y055", budget: ["B003", "3001～4000円", "4000円"], party: 45, seats: 60, smoking: "一部禁煙", yes: ["free_drink", "private_room", "course", "horigotatsu", "card", "tatami"], tags: ["sake", "shochu"], catch: "掘りごたつ個室の和食" },
  { name: "ベーカリーカフェ むぎ", genre: ["G014", "カフェ・スイーツ"], middle: "Y055", budget: ["B009", "～500円", "500円"], seats: 20, smoking: "全面禁煙", yes: ["lunch", "wifi", "child"], tags: [], catch: "焼きたてパンのカフェ" },
];

function offset(i: number): { dLat: number; dLng: number } {
  // 駅の周り 150〜900m に店を散らす(決まった配置になるようにする)
  const angle = (i * 137.5 * Math.PI) / 180;
  const r = 0.0015 + (i % 6) * 0.0012;
  return { dLat: r * Math.cos(angle), dLng: r * Math.sin(angle) * 1.2 };
}

export const MOCK_SHOPS: MockShop[] = SEEDS.map((s, i) => {
  const m = MIDDLE[s.middle];
  const { dLat, dLng } = offset(i);
  const id = `J9999${String(i + 1).padStart(5, "0")}`;
  const yes = (field: string, yesWord = "あり", noWord = "なし") => (s.yes.includes(field) ? yesWord : noWord);
  const photo = `/mock/shop-${(i % 4) + 1}.svg`;
  return {
    id,
    name: s.name,
    name_kana: "",
    address: `東京都(架空)${m.small.name} ${i + 1}-${(i * 3) % 9 + 1}`,
    station_name: m.station,
    ktai_coupon: s.coupon ? 0 : 1,
    large_service_area: { code: "SS10", name: "関東" },
    service_area: { code: "SA11", name: "東京" },
    large_area: { code: "Z011", name: "東京" },
    middle_area: { code: s.middle, name: m.name },
    small_area: m.small,
    lat: Number((m.base.lat + dLat).toFixed(6)),
    lng: Number((m.base.lng + dLng).toFixed(6)),
    genre: { code: s.genre[0], name: s.genre[1], catch: s.catch },
    budget: { code: s.budget[0], name: s.budget[1], average: s.budget[2] },
    budget_memo: "",
    catch: s.catch,
    capacity: s.seats ?? "",
    access: `${m.station}駅から徒歩${(i % 8) + 2}分(架空)`,
    urls: { pc: "https://www.hotpepper.jp/" },
    photo: { pc: { l: photo, m: photo, s: photo } },
    open: i % 3 === 0 ? "月～土: 17:00～翌2:00 日: 17:00～23:00" : "月～日: 11:30～14:00、17:00～23:00",
    close: i % 4 === 0 ? "日" : "なし",
    party_capacity: s.party ?? "",
    wifi: yes("wifi"),
    wedding: s.yes.includes("wedding") ? "応相談" : "",
    course: yes("course"),
    free_drink: yes("free_drink"),
    free_food: yes("free_food"),
    private_room: yes("private_room"),
    horigotatsu: yes("horigotatsu"),
    tatami: yes("tatami"),
    card: yes("card", "利用可", "利用不可"),
    non_smoking: s.smoking,
    charter: yes("charter", "貸切可", "貸切不可"),
    ktai: "つながる",
    parking: yes("parking"),
    barrier_free: yes("barrier_free"),
    sommelier: s.tags?.includes("wine") ? "いる" : "いない",
    open_air: yes("open_air"),
    show: "なし",
    equipment: yes("equipment"),
    karaoke: yes("karaoke"),
    band: "不可",
    tv: yes("tv"),
    english: yes("english"),
    pet: yes("pet", "可", "不可"),
    child: yes("child", "お子様連れOK", "お子様連れ不可"),
    lunch: yes("lunch"),
    midnight: yes("midnight", "営業している", "営業していない"),
    shop_detail_memo: "",
    coupon_urls: s.coupon ? { pc: "https://www.hotpepper.jp/", sp: "https://www.hotpepper.jp/" } : {},
    mock_tags: s.tags ?? [],
  };
});
