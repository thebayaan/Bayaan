/**
 * Performance Diagnostic Tool
 * Use this to measure render counts and identify performance bottlenecks
 *
 * USAGE:
 * 1. Import and call startMonitoring() at app startup
 * 2. Call trackRender('ComponentName') in components you want to monitor
 * 3. Call getReport() to see render statistics
 * 4. Call reset() to clear data
 */

interface RenderEntry {
  count: number;
  timestamps: number[];
  lastProps?: Record<string, unknown>;
}

interface PerformanceReport {
  totalRenders: number;
  componentRenders: Record<string, number>;
  rendersPerSecond: Record<string, number>;
  hotComponents: string[]; // Components with >10 renders/sec
  monitoringDurationMs: number;
}

class PerformanceMonitor {
  private renderCounts: Map<string, RenderEntry> = new Map();
  private startTime: number = Date.now();
  private isEnabled = false;
  private consoleLogInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Start monitoring - call this at app initialization
   */
  startMonitoring(options?: {logToConsole?: boolean; intervalMs?: number}) {
    this.isEnabled = true;
    this.startTime = Date.now();
    this.renderCounts.clear();

    if (options?.logToConsole) {
      const interval = options.intervalMs || 5000;
      this.consoleLogInterval = setInterval(() => {
        this.logReport();
      }, interval);
    }

    console.log('[PerfMonitor] Started monitoring');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    this.isEnabled = false;
    if (this.consoleLogInterval) {
      clearInterval(this.consoleLogInterval);
      this.consoleLogInterval = null;
    }
    console.log('[PerfMonitor] Stopped monitoring');
  }

  /**
   * Track a component render - call this inside useEffect or at component top
   */
  trackRender(componentName: string, props?: Record<string, unknown>) {
    if (!this.isEnabled) return;

    const now = Date.now();
    const entry = this.renderCounts.get(componentName) || {
      count: 0,
      timestamps: [],
    };

    entry.count++;
    entry.timestamps.push(now);
    entry.lastProps = props;

    // Keep only last 100 timestamps for memory efficiency
    if (entry.timestamps.length > 100) {
      entry.timestamps = entry.timestamps.slice(-100);
    }

    this.renderCounts.set(componentName, entry);
  }

  /**
   * Get performance report
   */
  getReport(): PerformanceReport {
    const now = Date.now();
    const durationMs = now - this.startTime;

    const componentRenders: Record<string, number> = {};
    const rendersPerSecond: Record<string, number> = {};
    const hotComponents: string[] = [];
    let totalRenders = 0;

    this.renderCounts.forEach((entry, name) => {
      componentRenders[name] = entry.count;
      totalRenders += entry.count;

      // Calculate renders per second based on last 10 seconds
      const tenSecondsAgo = now - 10000;
      const recentRenders = entry.timestamps.filter(
        t => t > tenSecondsAgo,
      ).length;
      const rps = recentRenders / 10;
      rendersPerSecond[name] = Math.round(rps * 100) / 100;

      if (rps > 10) {
        hotComponents.push(name);
      }
    });

    return {
      totalRenders,
      componentRenders,
      rendersPerSecond,
      hotComponents,
      monitoringDurationMs: durationMs,
    };
  }

  /**
   * Log report to console
   */
  logReport() {
    const report = this.getReport();
    console.log('\n========== PERFORMANCE REPORT ==========');
    console.log(
      `Duration: ${(report.monitoringDurationMs / 1000).toFixed(1)}s`,
    );
    console.log(`Total renders: ${report.totalRenders}`);

    if (report.hotComponents.length > 0) {
      console.log('\n⚠️  HOT COMPONENTS (>10 renders/sec):');
      report.hotComponents.forEach(name => {
        console.log(`  - ${name}: ${report.rendersPerSecond[name]} r/s`);
      });
    }

    console.log('\nAll components (renders/sec):');
    Object.entries(report.rendersPerSecond)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .forEach(([name, rps]) => {
        console.log(
          `  ${name}: ${rps} r/s (${report.componentRenders[name]} total)`,
        );
      });
    console.log('==========================================\n');
  }

  /**
   * Reset all data
   */
  reset() {
    this.renderCounts.clear();
    this.startTime = Date.now();
  }
}

export const perfMonitor = new PerformanceMonitor();

/**
 * Hook to track component renders
 * Usage: useRenderTracker('MyComponent')
 */
export function useRenderTracker(
  componentName: string,
  props?: Record<string, unknown>,
) {
  perfMonitor.trackRender(componentName, props);
}
