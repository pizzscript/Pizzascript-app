// Shared, ref-counted image cache and concurrency-limited loader for scroll sequences.

const MAX_CONCURRENT = 6;

interface Entry {
  img: HTMLImageElement;
  refs: number;
  loaded: boolean;
  promise: Promise<HTMLImageElement | null>;
}

const cache = new Map<string, Entry>();
const queue: Array<() => void> = [];
let active = 0;

function pump() {
  while (active < MAX_CONCURRENT && queue.length > 0) {
    const start = queue.shift()!;
    active++;
    start();
  }
}

function load(url: string, priority: boolean): Entry {
  const img = new Image();
  img.decoding = "async";
  let resolvePromise!: (value: HTMLImageElement | null) => void;
  const entry: Entry = {
    img,
    refs: 0,
    loaded: false,
    promise: new Promise((resolve) => (resolvePromise = resolve)),
  };
  const start = () => {
    if (entry.refs === 0) {
      active--;
      resolvePromise(null);
      pump();
      return;
    }
    const done = (ok: boolean) => {
      img.onload = img.onerror = null;
      entry.loaded = ok;
      active--;
      resolvePromise(ok ? img : null);
      pump();
    };
    img.onload = () => done(true);
    img.onerror = () => done(false);
    img.src = url;
  };
  if (priority) queue.unshift(start);
  else queue.push(start);
  return entry;
}

export function acquireFrame(url: string, priority = false) {
  let entry = cache.get(url);
  if (!entry) {
    entry = load(url, priority);
    cache.set(url, entry);
  }
  entry.refs++;
  pump();
  return entry;
}

export function releaseFrame(url: string) {
  const entry = cache.get(url);
  if (!entry) return;
  entry.refs--;
  if (entry.refs > 0) return;
  cache.delete(url);
  if (!entry.loaded) entry.img.src = "";
}

export type FrameEntry = ReturnType<typeof acquireFrame>;
