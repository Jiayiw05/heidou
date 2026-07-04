/**
 * 内存存储 — Redis 的轻量替代
 * 用于没有 Redis 的云部署环境
 * 实现与 Redis 完全相同的 lPush / lRange / lTrim / del / set / get 接口
 */

interface ListEntry {
  key: string;
  values: string[];
}

interface StringEntry {
  key: string;
  value: string;
}

class MemoryStore {
  private lists: Map<string, string[]> = new Map();
  private strings: Map<string, string> = new Map();

  // ===== List 操作 =====

  async lPush(key: string, value: string): Promise<number> {
    if (!this.lists.has(key)) {
      this.lists.set(key, []);
    }
    this.lists.get(key)!.unshift(value);
    return this.lists.get(key)!.length;
  }

  async lRange(key: string, start: number, stop: number): Promise<string[]> {
    const list = this.lists.get(key) || [];
    const end = stop === -1 ? list.length : stop + 1;
    return list.slice(start, end);
  }

  async lTrim(key: string, start: number, stop: number): Promise<void> {
    const list = this.lists.get(key);
    if (!list) return;
    const end = stop + 1;
    this.lists.set(key, list.slice(start, end));
  }

  // ===== String 操作 =====

  async set(key: string, value: string): Promise<void> {
    this.strings.set(key, value);
  }

  async get(key: string): Promise<string | null> {
    return this.strings.get(key) ?? null;
  }

  // ===== Key 操作 =====

  async del(key: string): Promise<void> {
    this.lists.delete(key);
    this.strings.delete(key);
  }

  // ===== 工具方法 =====

  async ping(): Promise<'PONG'> {
    return 'PONG';
  }

  /** 30 分钟后自动清理所有数据 */
  scheduleCleanup(minutes: number = 30): void {
    setTimeout(() => {
      this.lists.clear();
      this.strings.clear();
    }, minutes * 60 * 1000);
  }
}

// 单例
export const memoryStore = new MemoryStore();
