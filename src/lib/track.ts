const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const LAST_ARTICLE = "ps_last_article";

function send(path: string, kind: "view" | "conversion") {
  if (!url || !key) return;
  fetch(`${url}/rest/v1/rpc/track_event`, {
    method: "POST",
    keepalive: true,
    headers: { "content-type": "application/json", apikey: key, authorization: `Bearer ${key}` },
    body: JSON.stringify({ event_path: path, event_kind: kind }),
  }).catch(() => {});
}

export function trackView(path: string) {
  send(path, "view");
  try {
    if (path.startsWith("/blog/")) sessionStorage.setItem(LAST_ARTICLE, path);
  } catch {}
}

/** Credits an enquiry to the article the visitor last read, since the form itself lives on another page. */
export function trackConversion() {
  let path = window.location.pathname;
  try {
    path = sessionStorage.getItem(LAST_ARTICLE) ?? path;
  } catch {}
  send(path, "conversion");
}
