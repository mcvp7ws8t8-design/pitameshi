import { NextResponse, type NextRequest } from "next/server";
import { buildAffiliateUrl, isAllowedDestination } from "@/lib/affiliate";
import { getShop, SHOP_ID_RE } from "@/lib/hotpepper";
import { insert, supabaseConfigured } from "@/lib/supabase";

/**
 * 予約ボタンの行き先(F-04)。クリックを記録してから、ホットペッパーの店舗ページへアフィリエイトリンク経由で送る。
 * - 送り先はAPIから取り直した店舗URLだけ(URLをクエリで受け取らない = オープンリダイレクト対策)
 * - 記録するのは店舗ID・どのページから来たか・日時だけ(個人を特定する情報は持たない)
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!SHOP_ID_RE.test(id)) return NextResponse.redirect(new URL("/", req.url));

  const shop = await getShop(id).catch(() => undefined);
  const shopUrl = shop?.urls.pc;
  if (!shopUrl || !isAllowedDestination(shopUrl)) return NextResponse.redirect(new URL(`/shop/${id}`, req.url));

  const from = (req.nextUrl.searchParams.get("from") ?? "").slice(0, 300);
  const preset = from.match(/[?&]p=([a-z0-9-]+)/)?.[1] ?? null;
  const log = { shop_id: id, from_path: from.startsWith("/") ? from : null, preset };

  // 記録の失敗で予約の邪魔をしない
  if (supabaseConfigured()) {
    await insert("click_logs", log).catch((e) => console.error("[go] click log failed", e));
  } else {
    console.log("[go] click", log);
  }

  const dest = buildAffiliateUrl(shopUrl, process.env.AFFILIATE_URL_TEMPLATE);
  return NextResponse.redirect(dest, { status: 302, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}
