const fs = require('fs');

class ResumeManager {
  getResumeOffset(task) {
    try {
      if (!task.partPath || !fs.existsSync(task.partPath)) return 0;
      return fs.statSync(task.partPath).size;
    } catch (_) {
      return 0;
    }
  }

  canResume(response) {
    return Number(response.statusCode) === 206 || /bytes/i.test(String(response.headers?.['accept-ranges'] || ''));
  }
}

module.exports = ResumeManager;
