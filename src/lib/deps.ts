import "server-only";
import { getBackend, getMasters, isMockMode } from "./hotpepper";
import { getStationProvider } from "./osm/providers";
import type { EngineDeps } from "./search/engine";

/** 画面・APIルートから検索エンジンを使うときの依存関係をまとめる */
export async function engineDeps(): Promise<EngineDeps & { masters: Awaited<ReturnType<typeof getMasters>>; mock: boolean }> {
  const masters = await getMasters();
  return {
    backend: getBackend(),
    stations: getStationProvider(),
    budgets: masters.budgets,
    masters,
    mock: isMockMode(),
  };
}
