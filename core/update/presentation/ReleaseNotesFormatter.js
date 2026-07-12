class ReleaseNotesFormatter {
  static format(raw = '') {
    const text = String(raw || '').replace(/\r/g, '').trim();
    const sections = {
      features: [],
      fixes: [],
      performance: [],
      security: [],
      breakingChanges: [],
      knownIssues: [],
      other: []
    };
    for (const line of text.split('\n').map(item => item.trim()).filter(Boolean)) {
      const normalized = line.toLowerCase();
      if (normalized.includes('security')) sections.security.push(line);
      else if (normalized.includes('performance') || normalized.includes('speed')) sections.performance.push(line);
      else if (normalized.includes('fix')) sections.fixes.push(line);
      else if (normalized.includes('breaking')) sections.breakingChanges.push(line);
      else if (normalized.includes('known issue')) sections.knownIssues.push(line);
      else if (normalized.includes('feature') || normalized.includes('new')) sections.features.push(line);
      else sections.other.push(line);
    }
    return Object.freeze({
      markdown: text,
      summary: text.split('\n').find(Boolean)?.slice(0, 220) || 'Release notes are not available.',
      sections
    });
  }
}

module.exports = ReleaseNotesFormatter;
