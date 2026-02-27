/**
 * Source Plugin Registry
 *
 * Registers, configures, and runs source plugins.
 * Each plugin runs independently — one failure doesn't stop others.
 */

import type { SourcePlugin, SourcePluginConfig, DiscoveryQuery, RawGrant, DiscoveryRunStats } from '../types.js';

export class SourceRegistry {
  private plugins = new Map<string, SourcePlugin>();
  private configs = new Map<string, SourcePluginConfig>();

  register(plugin: SourcePlugin): void {
    this.plugins.set(plugin.id, plugin);
    if (!this.configs.has(plugin.id)) {
      this.configs.set(plugin.id, { id: plugin.id, enabled: true });
    }
  }

  configure(id: string, config: Partial<SourcePluginConfig>): void {
    const existing = this.configs.get(id) || { id, enabled: true };
    this.configs.set(id, { ...existing, ...config });
  }

  getPlugin(id: string): SourcePlugin | undefined {
    return this.plugins.get(id);
  }

  getEnabled(sourceIds?: string[]): SourcePlugin[] {
    const plugins: SourcePlugin[] = [];
    for (const [id, plugin] of this.plugins) {
      const config = this.configs.get(id);
      if (config && !config.enabled) continue;
      if (sourceIds && !sourceIds.includes(id)) continue;
      plugins.push(plugin);
    }
    return plugins;
  }

  /**
   * Run all enabled plugins and collect grants.
   * Each plugin runs sequentially to respect rate limits.
   * Individual plugin failures are captured, not thrown.
   */
  async *discoverAll(
    query: DiscoveryQuery,
    sourceIds?: string[]
  ): AsyncGenerator<{ grant: RawGrant; stats: DiscoveryRunStats }> {
    const plugins = this.getEnabled(sourceIds);

    for (const plugin of plugins) {
      const stats: DiscoveryRunStats = {
        source: plugin.id,
        grantsFound: 0,
        errors: [],
        durationMs: 0,
      };
      const start = Date.now();

      try {
        for await (const grant of plugin.discover(query)) {
          stats.grantsFound++;
          yield { grant, stats };
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        stats.errors.push(message);
        console.error(`[${plugin.id}] Source plugin error: ${message}`);
      }

      stats.durationMs = Date.now() - start;
    }
  }
}
