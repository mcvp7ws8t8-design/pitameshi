// 素材ファイル(public/assets 以下)の読み込み。
// サーバー版は、普通にファイルとして取りに行く。
// Claude の画面(Artifact)版は、素材のファイルを別に置けない形式があるので、ページの中に base64 で
// 埋め込んでおき(scripts/make-artifact.mjs が `window.__HK_ASSETS__` に入れる)、そこから取り出す。

type Embedded = Record<string, string>;

export async function loadAsset(path: string): Promise<ArrayBuffer> {
  const embedded = (window as unknown as { __HK_ASSETS__?: Embedded }).__HK_ASSETS__;
  const b64 = embedded?.[path];
  if (b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
  }
  const res = await fetch(`./assets/${path}`);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.arrayBuffer();
}
