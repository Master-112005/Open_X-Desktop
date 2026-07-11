class ProcessMonitor {
  constructor(options = {}) {
    this.timeoutMs = Math.max(1000, Number(options.timeoutMs) || 15 * 60 * 1000);
  }

  monitor(child, options = {}) {
    const startedAt = Date.now();
    return new Promise((resolve) => {
      let settled = false;
      const timeoutMs = Math.max(1000, Number(options.timeoutMs) || this.timeoutMs);
      const finish = result => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve({
          ...result,
          durationMs: Date.now() - startedAt
        });
      };
      const timer = setTimeout(() => {
        try {
          child?.kill?.();
        } catch (_) {}
        finish({ success: false, timedOut: true, exitCode: null, signal: null, error: 'Installer timed out.' });
      }, timeoutMs);
      if (typeof timer.unref === 'function') timer.unref();
      if (!child || typeof child.once !== 'function') {
        finish({ success: false, exitCode: null, signal: null, error: 'Installer process is not monitorable.' });
        return;
      }
      child.once('exit', (code, signal) => {
        finish({ success: code === 0, exitCode: code, signal: signal || null, timedOut: false });
      });
      child.once('error', error => {
        finish({ success: false, exitCode: null, signal: null, timedOut: false, error: error.message });
      });
    });
  }
}

module.exports = ProcessMonitor;
