import Script from "next/script";

/**
 * Google アナリティクス(GA4)。NEXT_PUBLIC_GA_ID が未設定なら何も出さない。
 * 予約ボタン(/go/[id] へのリンク)が押されたら reserve_click イベントを送る(要件定義書「計測」)。
 */
export function Analytics() {
  const id = process.env.NEXT_PUBLIC_GA_ID;
  if (!id || !/^G-[A-Z0-9]+$/.test(id)) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
      <Script id="ga-init" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${id}');document.addEventListener('click',function(e){var a=e.target instanceof Element&&e.target.closest('a[href^="/go/"]');if(a){gtag('event','reserve_click',{shop_id:a.getAttribute('href').split(/[/?]/)[2],transport_type:'beacon'});}},true);`}
      </Script>
    </>
  );
}
