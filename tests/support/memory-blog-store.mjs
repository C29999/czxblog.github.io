export class MemoryStore {
  data = new Map();
  revision = 0;
  async getWithMetadata(key) { return structuredClone(this.data.get(key) || null); }
  async get(key) { return structuredClone(this.data.get(key)?.data || null); }
  async setJSON(key, data, options = {}) {
    const current = this.data.get(key);
    if ((options.onlyIfNew && current) || (options.onlyIfMatch && current?.etag !== options.onlyIfMatch)) return { modified: false };
    const etag = String(++this.revision);
    this.data.set(key, { data: structuredClone(data), etag });
    return { modified: true, etag };
  }
  async *list({ prefix = '', directories = false } = {}) {
    const keys = [...this.data.keys()].filter(key => key.startsWith(prefix));
    if (directories) {
      yield { blobs: [], directories: [...new Set(keys.map(key => prefix + key.slice(prefix.length).split('/')[0] + '/'))] };
      return;
    }
    for (let index = 0; index < keys.length; index += 50) yield { blobs: keys.slice(index, index + 50).map(key => ({ key })), directories: [] };
  }
  async delete(key) { this.data.delete(key); }
}
