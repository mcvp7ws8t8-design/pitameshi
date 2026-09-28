import { NextResponse, type NextRequest } from "next/server";
import { engineDeps } from "@/lib/deps";
import { countResults } from "@/lib/search/engine";
import { API_FLAG_BY_ID } from "@/lib/search/filters";
import { parseSearchState, type SearchState } from "@/lib/search/query";

/**
 * 件数だけを返す(U-03・U-04)。
 * GET /api/count?<検索条件>&try=private_room,free_drink
 *   → { total, approximate, tries: { private_room: 12, free_drink: 30 } }
 * try には「その条件を足したら何件か」を知りたいAPIフラグを最大6個まで渡せる。
 * API呼び出しが増えるため、画面に出ている条件だけを渡すこと。
 */
const MAX_TRIES = 6;

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const state = parseSearchState(params);
  const deps = await engineDeps();

  try {
    const base = await countResults(state, deps);
    const tries = (params.get("try") ?? "")
      .split(",")
      .filter((id) => API_FLAG_BY_ID.has(id) && !state.flags.includes(id))
      .slice(0, MAX_TRIES);

    const counted = await Promise.all(
      tries.map(async (id) => {
        const s: SearchState = { ...state, flags: [...state.flags, id], page: 1 };
        const r = await countResults(s, deps).catch(() => undefined);
        return [id, r?.total ?? null] as const;
      }),
    );

    return NextResponse.json(
      { total: base.total, approximate: base.approximate, tries: Object.fromEntries(counted) },
      { headers: { "Cache-Control": "public, max-age=300" } },
    );
  } catch (e) {
    console.error("[api/count]", e);
    return NextResponse.json({ error: "count_failed" }, { status: 502 });
  }
}
