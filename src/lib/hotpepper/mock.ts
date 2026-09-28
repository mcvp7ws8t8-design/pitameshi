import { distanceMeters, RANGE_METERS } from "../geo";
import { classifySmoking, hasCoupon, yesNo } from "../search/interpret";
import { MOCK_SHOPS, type MockShop } from "./fixtures";
import type { HotpepperBackend, HotpepperQuery } from "./types";

/**
 * 仮データで API の検索をまねる(APIキーがないとき用)。
 * 絞り込みの意味は本物のAPIに近づけているが、完全に同じではない。
 */

const FLAG_FIELDS: Record<string, keyof MockShop> = {
  wifi: "wifi",
  course: "course",
  free_drink: "free_drink",
  free_food: "free_food",
  private_room: "private_room",
  horigotatsu: "horigotatsu",
  tatami: "tatami",
  card: "card",
  charter: "charter",
  ktai: "ktai",
  parking: "parking",
  barrier_free: "barrier_free",
  sommelier: "sommelier",
  open_air: "open_air",
  show: "show",
  equipment: "equipment",
  karaoke: "karaoke",
  band: "band",
  tv: "tv",
  english: "english",
  pet: "pet",
  child: "child",
  lunch: "lunch",
  midnight: "midnight",
};

/** レスポンスに項目がなく、仮データでは mock_tags で判定する条件 */
const TAG_FLAGS = new Set(["sake", "shochu", "wine", "cocktail", "night_view", "midnight_meal"]);

function arr(v: string | string[] | undefined): string[] {
  if (v === undefined) return [];
  return (Array.isArray(v) ? v : v.split(",")).map((s) => s.trim()).filter(Boolean);
}

function matches(shop: MockShop, q: HotpepperQuery): boolean {
  const ids = arr(q.id);
  if (ids.length && !ids.includes(shop.id)) return false;
  const large = arr(q.large_area);
  if (large.length && !large.includes(shop.large_area?.code ?? "")) return false;
  const middle = arr(q.middle_area);
  if (middle.length && !middle.includes(shop.middle_area?.code ?? "")) return false;
  const genres = arr(q.genre);
  if (genres.length && !genres.includes(shop.genre.code ?? "")) return false;
  const budgets = arr(q.budget);
  if (budgets.length && !budgets.includes(shop.budget?.code ?? "")) return false;

  const kw = typeof q.keyword === "string" ? q.keyword : undefined;
  if (kw) {
    const hay = [shop.name, shop.catch, shop.genre.name, shop.genre.catch, shop.address, shop.station_name, shop.middle_area?.name, shop.access].join(" ");
    for (const word of kw.split(/\s+/).filter(Boolean)) {
      if (!hay.includes(word)) return false;
    }
  }

  if (typeof q.party_capacity === "string") {
    const need = Number.parseInt(q.party_capacity, 10);
    const has = Number.parseInt(String(shop.party_capacity), 10);
    if (!(Number.isFinite(has) && has > need)) return false;
  }

  if (typeof q.lat === "string" && typeof q.lng === "string") {
    const center = { lat: Number(q.lat), lng: Number(q.lng) };
    const limit = RANGE_METERS[Number(q.range ?? 3)] ?? 1000;
    if (distanceMeters(center, { lat: Number(shop.lat), lng: Number(shop.lng) }) > limit) return false;
  }

  for (const [key, value] of Object.entries(q)) {
    if (value !== "1") continue;
    if (TAG_FLAGS.has(key)) {
      if (!shop.mock_tags?.includes(key)) return false;
    } else if (key === "non_smoking") {
      const c = classifySmoking(shop.non_smoking);
      if (c !== "none" && c !== "separated") return false;
    } else if (FLAG_FIELDS[key]) {
      if (yesNo(String(shop[FLAG_FIELDS[key]] ?? "")) !== true) return false;
    }
  }
  if (q.ktai_coupon === "0" && !hasCoupon(shop)) return false;
  return true;
}

export function createMockBackend(shops: MockShop[] = MOCK_SHOPS): HotpepperBackend {
  return {
    kind: "mock",
    async search(q) {
      let hits = shops.filter((s) => matches(s, q));
      // 位置検索で order 指定がなければ距離順(API仕様に合わせる)
      if (typeof q.lat === "string" && typeof q.lng === "string" && q.order === undefined) {
        const center = { lat: Number(q.lat), lng: Number(q.lng) };
        hits = [...hits].sort(
          (a, b) =>
            distanceMeters(center, { lat: Number(a.lat), lng: Number(a.lng) }) - distanceMeters(center, { lat: Number(b.lat), lng: Number(b.lng) }),
        );
      }
      const start = Math.max(1, Number.parseInt(String(q.start ?? "1"), 10) || 1);
      const count = Math.min(100, Math.max(1, Number.parseInt(String(q.count ?? "10"), 10) || 10));
      return { total: hits.length, start, shops: hits.slice(start - 1, start - 1 + count) };
    },
  };
}
