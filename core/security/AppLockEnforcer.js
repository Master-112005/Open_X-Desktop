class AppLockEnforcer {
  constructor(options = {}) {
    this.securityLocks = options.securityLocks;
    this.apps = options.apps;
    this.logger = options.logger;
    this.onLockedAppDetected = options.onLockedAppDetected;
    this.intervalMs = Math.max(1500, Number(options.intervalMs) || 3000);
    this.unlockedWindowMs = Math.max(30_000, Number(options.unlockedWindowMs) || 5 * 60 * 1000);
    this.timer = null;
    this.scanning = false;
    this.promptingTargets = new Set();
    this.visibleTargets = new Set();
    this.knownLockTargets = new Set();
    this.baselineComplete = false;
  }

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.scan(), this.intervalMs);
    this.timer.unref?.();
    this.scan();
  }

  stop() {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
  }

  async scan() {
    if (this.scanning || !this.securityLocks || !this.apps) return;
    this.scanning = true;
    try {
      const locks = this.securityLocks.listLocks()
        .filter(lock => lock.enabled !== false && lock.type === 'app');
      for (const lock of locks) {
        if (this._recentlyUnlocked(lock) || this.promptingTargets.has(lock.target)) continue;
        const visible = this.apps.findVisibleApp(lock.target, { allowWindowFallback: true });
        if (!visible) {
          this.visibleTargets.delete(lock.target);
          this.knownLockTargets.add(lock.target);
          continue;
        }
        const newLockTarget = !this.knownLockTargets.has(lock.target);
        this.knownLockTargets.add(lock.target);
        if (!this.baselineComplete || newLockTarget || this.visibleTargets.has(lock.target)) {
          this.visibleTargets.add(lock.target);
          continue;
        }

        this.promptingTargets.add(lock.target);
        this.visibleTargets.add(lock.target);
        try {
          this.apps.close(lock.target, { targetProcessId: visible.Id });
          this.logger?.warn?.('Blocked locked app launch', {
            app: lock.displayName || lock.target,
            processName: visible.ProcessName || ''
          });
          const unlocked = await this.onLockedAppDetected?.(lock, visible);
          if (unlocked) this.apps.open(lock.target, { securityUnlocked: true });
        } finally {
          this.promptingTargets.delete(lock.target);
        }
      }
      this.baselineComplete = true;
    } catch (error) {
      this.logger?.error?.('App lock enforcement failed', { error: error.message });
    } finally {
      this.scanning = false;
    }
  }

  _recentlyUnlocked(lock) {
    if (!lock.lastUnlockedAt) return false;
    const unlockedAt = new Date(lock.lastUnlockedAt).getTime();
    return Number.isFinite(unlockedAt) && Date.now() - unlockedAt < this.unlockedWindowMs;
  }
}

module.exports = AppLockEnforcer;
