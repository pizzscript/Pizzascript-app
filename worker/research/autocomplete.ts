/** Phrases people really type, from Google autocomplete (India, English). Free and unofficial, so used lightly. */
export async function autocomplete(seeds: string[], gapMs = 1200) {
  const phrases = new Set<string>();
  for (const seed of seeds.slice(0, 15)) {
    const q = seed.trim().toLowerCase();
    if (!q) continue;
    phrases.add(q);
    try {
      const res = await fetch(`https://suggestqueries.google.com/complete/search?client=firefox&hl=en&gl=in&q=${encodeURIComponent(q)}`, {
        headers: { "user-agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(15_000),
      });
      if (res.ok) for (const s of ((await res.json()) as [string, string[]])[1] ?? []) phrases.add(String(s).toLowerCase());
    } catch {
      // One missed seed only means fewer phrases.
    }
    if (gapMs) await new Promise((r) => setTimeout(r, gapMs));
  }
  return phrases;
}
