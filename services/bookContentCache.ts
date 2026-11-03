import type { BookContent } from '../types';

// Session-only LRU. Notes and reading position are always fetched separately.
// A generation check prevents an invalidated request from repopulating the cache.
export class BookContentCache {
  private owner: string | null = null;
  private entries = new Map<string, { value: BookContent; size: number; until: number }>();
  private requests = new Map<string, { controller: AbortController; promise: Promise<BookContent> }>();
  private bytes = 0;

  constructor(private maxEntries = 3, private maxBytes = 16 * 1024 * 1024, private maxAgeMs = 5 * 60_000, private now = Date.now) {}

  forUser(owner: string) {
    if (this.owner !== owner) { this.clear(); this.owner = owner; }
  }

  clear() {
    this.owner = null;
    this.entries.clear();
    this.bytes = 0;
    this.requests.forEach(request => request.controller.abort());
    this.requests.clear();
  }

  invalidate(owner: string, id: string) {
    if (this.owner !== owner) return;
    const entry = this.entries.get(id);
    if (entry) this.bytes -= entry.size;
    this.entries.delete(id);
    this.requests.get(id)?.controller.abort();
    this.requests.delete(id);
  }

  put(owner: string, id: string, value: BookContent) {
    if (this.owner !== owner) return;
    this.invalidate(owner, id);
    const size = JSON.stringify(value).length * 2;
    if (size > this.maxBytes || this.maxEntries < 1) return;
    while (this.entries.size >= this.maxEntries || this.bytes + size > this.maxBytes) {
      const oldest = this.entries.keys().next().value!;
      this.bytes -= this.entries.get(oldest)!.size;
      this.entries.delete(oldest);
    }
    this.entries.set(id, { value, size, until: this.now() + this.maxAgeMs });
    this.bytes += size;
  }

  load(owner: string, id: string, loader: (signal: AbortSignal) => Promise<BookContent>): Promise<BookContent> {
    this.forUser(owner);
    const hit = this.entries.get(id);
    if (hit && hit.until > this.now()) {
      this.entries.delete(id); this.entries.set(id, hit);
      return Promise.resolve(hit.value);
    }
    if (hit) this.invalidate(owner, id);
    const pending = this.requests.get(id);
    if (pending) return pending.promise;
    const controller = new AbortController();
    const request = { controller, promise: Promise.resolve({} as BookContent) };
    request.promise = Promise.resolve().then(() => loader(controller.signal)).then(value => {
      if (controller.signal.aborted || this.owner !== owner || this.requests.get(id) !== request) {
        const error = new Error('Book content request was invalidated');
        error.name = 'AbortError';
        throw error;
      }
      this.requests.delete(id);
      this.put(owner, id, value);
      return value;
    }).finally(() => {
      if (this.requests.get(id) === request) this.requests.delete(id);
    });
    this.requests.set(id, request);
    return request.promise;
  }
}
