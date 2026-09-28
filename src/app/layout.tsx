import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { M_PLUS_Rounded_1c, Noto_Sans_JP } from "next/font/google";
import { Analytics } from "@/components/Analytics";
import { Credits } from "@/components/Credits";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TAGLINE, siteUrl } from "@/lib/site";
import "./globals.css";

const noto = Noto_Sans_JP({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--font-noto", display: "swap", preload: false });
const rounded = M_PLUS_Rounded_1c({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-rounded", display: "swap", preload: false });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: `${SITE_NAME} | ${SITE_TAGLINE}`, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  openGraph: { siteName: SITE_NAME, locale: "ja_JP", type: "website" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f766e",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${noto.variable} ${rounded.variable}`}>
      <body className="min-h-dvh">
        <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
            <Link href="/" className="font-round text-2xl font-extrabold tracking-tight text-brand">
              ぴためし
            </Link>
            <nav className="flex gap-3 text-sm font-semibold sm:gap-4">
              <Link href="/search" className="hover:text-brand">
                <span className="hidden sm:inline">お店を</span>探す
              </Link>
              <Link href="/cafes" className="hover:text-brand">
                カフェ
              </Link>
              <Link href="/favorites" className="hover:text-brand">
                お気に入り
              </Link>
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-4 pb-28 pt-4">{children}</main>

        <footer className="border-t border-line bg-card">
          <div className="mx-auto grid max-w-5xl gap-4 px-4 py-6 sm:grid-cols-2">
            <div>
              <p className="font-round text-lg font-extrabold text-brand">ぴためし</p>
              <p className="text-sm text-ink-soft">{SITE_TAGLINE}</p>
            </div>
            <div className="space-y-3">
              <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <Link href="/about">運営者情報</Link>
                <Link href="/privacy">プライバシーポリシー</Link>
                <Link href="/disclaimer">免責事項・広告表記</Link>
                <Link href="/contact">お問い合わせ</Link>
              </nav>
              <Credits />
            </div>
          </div>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
