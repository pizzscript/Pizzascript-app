"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { trackView } from "@/lib/track";

const clarityId = process.env.NEXT_PUBLIC_CLARITY_ID;

export function SiteAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    if (process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_TRACK_DEV === "1") trackView(pathname);
  }, [pathname]);

  if (!clarityId || !/^[a-z0-9]+$/i.test(clarityId)) return null;
  return (
    <Script id="clarity" strategy="lazyOnload">
      {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${clarityId}");`}
    </Script>
  );
}
