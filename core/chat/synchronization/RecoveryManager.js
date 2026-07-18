/**
 * Desktop recovery helper for missing sequence gaps.
 */
class RecoveryManager {
  /**
   * Builds recovery state from gap validation.
   * @param {object[]} gaps Gaps.
   * @returns {object} Recovery state.
   */
  inspect(gaps = []) {
    return {
      required: gaps.length > 0,
      status: gaps.length ? 'Required' : 'NotRequired',
      gaps
    };
  }
}

module.exports = RecoveryManager;
