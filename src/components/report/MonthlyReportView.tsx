import type { MonthlyReport } from "@/lib/studio/report";

const n = (v: number) => v.toLocaleString("en-IN");
const change = (now: number, before: number) => {
  if (!before) return now ? "new" : "—";
  const pct = Math.round(((now - before) / before) * 100);
  return `${pct >= 0 ? "+" : ""}${pct}% vs last month`;
};
const path = (url: string) => url.replace(/^https?:\/\/[^/]+/, "") || "/";

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="report-stat">
      <div className="report-label">{label}</div>
      <div className="report-value">{value}</div>
      {sub && <div className="report-sub">{sub}</div>}
    </div>
  );
}

export function MonthlyReportView({ r, actions }: { r: MonthlyReport; actions?: React.ReactNode }) {
  return (
    <article className="report">
      <header className="report-head">
        <div>
          <p className="report-label">SEO report · {r.label}</p>
          <h1>{r.client.name}</h1>
          <p className="report-sub">
            {r.client.site.replace(/^https:\/\//, "")} · {r.client.plan} plan
          </p>
        </div>
        {actions}
      </header>

      <section className="report-grid">
        <Stat label="Clicks from Google" value={n(r.search.clicks)} sub={change(r.search.clicks, r.search.prevClicks)} />
        <Stat label="Times shown in Google" value={n(r.search.impressions)} sub={change(r.search.impressions, r.search.prevImpressions)} />
        <Stat label="Average position" value={r.search.position == null ? "—" : String(r.search.position)} />
        <Stat label="Articles published" value={String(r.articles.length)} sub={`${r.usage.articles} of ${r.usage.articlesLimit} in the plan`} />
        <Stat label="Site health" value={r.health.score == null ? "—" : `${r.health.score}/100`} sub={r.health.prevScore != null && r.health.score != null ? `${r.health.score - r.health.prevScore >= 0 ? "+" : ""}${r.health.score - r.health.prevScore} since the check before` : undefined} />
        <Stat label="Problems fixed" value={String(r.health.fixed)} sub={`${r.health.open} still open`} />
      </section>

      <section>
        <h2>Articles published</h2>
        {r.articles.length ? (
          <ol>
            {r.articles.map((a) => (
              <li key={a.title}>
                {a.url ? <a href={a.url}>{a.title}</a> : a.title} <span className="report-sub">· {new Date(a.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" })}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="report-sub">None this month.</p>
        )}
      </section>

      <section className="report-two">
        <div>
          <h2>Top searches</h2>
          {r.topQueries.length ? (
            <table>
              <thead>
                <tr>
                  <th>Search</th>
                  <th>Clicks</th>
                  <th>Position</th>
                </tr>
              </thead>
              <tbody>
                {r.topQueries.map((q) => (
                  <tr key={q.query}>
                    <td>{q.query}</td>
                    <td>{n(q.clicks)}</td>
                    <td>{q.position}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="report-sub">No Search Console data for this month.</p>
          )}
        </div>
        <div>
          <h2>Top pages</h2>
          {r.topPages.length ? (
            <table>
              <thead>
                <tr>
                  <th>Page</th>
                  <th>Clicks</th>
                  <th>Shown</th>
                </tr>
              </thead>
              <tbody>
                {r.topPages.map((p) => (
                  <tr key={p.page}>
                    <td>{path(p.page)}</td>
                    <td>{n(p.clicks)}</td>
                    <td>{n(p.impressions)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="report-sub">No Search Console data for this month.</p>
          )}
        </div>
      </section>

      {(r.speed.length > 0 || r.indexing.checked > 0) && (
        <section className="report-two">
          {r.speed.length > 0 && (
            <div>
              <h2>Speed (mobile)</h2>
              <table>
                <thead>
                  <tr>
                    <th>Page</th>
                    <th>Score</th>
                    <th>Largest paint</th>
                  </tr>
                </thead>
                <tbody>
                  {r.speed.map((s) => (
                    <tr key={s.url}>
                      <td>{path(s.url)}</td>
                      <td>{s.performance ?? "—"}</td>
                      <td>{s.lcp != null ? `${(s.lcp / 1000).toFixed(1)} s` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {r.indexing.checked > 0 && (
            <div>
              <h2>Google indexing</h2>
              <p>
                {r.indexing.indexed} of {r.indexing.checked} new articles are in Google.
              </p>
            </div>
          )}
        </section>
      )}
    </article>
  );
}

