import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md space-y-3 py-10 text-center">
      <p className="font-round text-5xl font-extrabold text-brand">404</p>
      <h1 className="text-lg font-bold">ページが見つかりませんでした</h1>
      <p className="text-sm text-ink-soft">お店が掲載を終了したか、URLが変わった可能性があります。</p>
      <Link href="/" className="inline-block rounded-full bg-brand px-5 py-2.5 font-bold text-white">
        トップへ戻る
      </Link>
    </div>
  );
}
