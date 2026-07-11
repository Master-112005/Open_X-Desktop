class VersionFormatter {
  static clean(value, fallback = 'Unknown') {
    return String(value || fallback).replace(/\s+/g, ' ').trim() || fallback;
  }

  static versionLabel(value) {
    const version = this.clean(value);
    return version === 'Unknown' ? version : `Version ${version}`;
  }
}

module.exports = VersionFormatter;
