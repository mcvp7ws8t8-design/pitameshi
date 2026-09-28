import "server-only";

/**
 * Supabase を PostgREST(REST API)で直接呼ぶ小さなクライアント。
 * supabase-js を入れると Worker のサイズ(無料プランは3MiBまで)を圧迫するので fetch だけで書いている。
 * キーはサーバー側でだけ使う(ブラウザには出さない)。
 */

export function supabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function headers(): HeadersInit {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

/** RPC(データベース関数)を呼ぶ。読み取りは1時間キャッシュ。 */
export async function rpc<T>(fn: string, args: Record<string, unknown>, revalidate = 3600): Promise<T> {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(args),
    next: { revalidate },
  } as RequestInit);
  if (!res.ok) throw new Error(`Supabase rpc ${fn}: HTTP ${res.status}`);
  return (await res.json()) as T;
}

export async function insert(table: string, row: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...headers(), Prefer: "return=minimal" },
    body: JSON.stringify(row),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Supabase insert ${table}: HTTP ${res.status}`);
}
