import Script from "next/script";

/**
 * Add <RaksHexGoogleAnalytics /> to the public site's root <body>.
 * Do not add this to the authenticated dashboard or API.
 * Enable only after obtaining your own GA4 web-stream measurement ID and
 * confirming the site's analytics-consent requirements.
 */
export default function RaksHexGoogleAnalytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;

  // Prevent broken placeholder IDs or arbitrary JS from reaching inline scripts.
  if (!gaId || !/^G-[A-Z0-9]+$/.test(gaId)) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
      <Script id="rakshex-ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${gaId}');
        `}
      </Script>
    </>
  );
}
