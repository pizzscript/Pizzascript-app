-- PizzaScript becomes an ordinary client: its profile is saved data (editable in Clients) instead of code, and its
-- website address is its public site, not the Render app (which now hosts only Studio).
-- Same values as supabase/seed/pizzascript-profile.json. Rollback: supabase/rollback/20261210000000_pizzascript_as_client_down.sql

insert into public.settings (workspace_id, key, value)
values (
  '00000000-0000-4000-8000-000000000001',
  'profile',
  $profile${
    "agentName": "Pizzascript",
    "description": "a custom web engineering studio in Pune, India (React, Next.js, performance, technical SEO, scroll animation)",
    "shortDescription": "a custom web engineering studio in Pune, India",
    "broadDescription": "a Pune, India studio that builds custom software, automation and websites for small and medium businesses",
    "broadShortDescription": "a studio that builds custom software and automation for small businesses",
    "voiceRule": "Say \"we\", never \"freelancer\".",
    "positioning": "Studio positioning: never \"freelancer\"; always \"studio\" / \"we\" / \"our process\". Never imply limited capacity. The India angle is an asset (faster delivery, direct access).",
    "researchDescription": "a web development studio in Pune, India, that also builds business automation and custom software for small and medium businesses",
    "market": "business owners in Pune first, then the rest of India",
    "showLogo": true,
    "articleUrl": "https://www.pizzascript.com/blog/{slug}",
    "staticPaths": ["/", "/services", "/portfolio", "/about", "/blog", "/freelance-pune"],
    "feeds": [
      { "name": "Next.js releases", "url": "https://github.com/vercel/next.js/releases.atom", "stableOnly": true },
      { "name": "React releases", "url": "https://github.com/facebook/react/releases.atom", "stableOnly": true },
      { "name": "Vercel blog", "url": "https://vercel.com/atom" },
      { "name": "Cloudflare blog", "url": "https://blog.cloudflare.com/rss/" },
      { "name": "Google Search Central", "url": "https://developers.google.com/search/blog/feed.xml" }
    ],
    "trendFocus": "builds React/Next.js sites with GSAP/Lenis animation on Vercel/Cloudflare, focused on performance and technical SEO"
  }$profile$::jsonb
)
on conflict (workspace_id, key) do nothing;

update public.workspaces
set site_url = 'https://www.pizzascript.com'
where id = '00000000-0000-4000-8000-000000000001' and site_url like '%onrender.com%';
