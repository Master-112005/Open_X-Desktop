class InstallationService {
  constructor(options = {}) {
    this.validator = options.validator;
    this.confirmationManager = options.confirmationManager;
    this.shutdownCoordinator = options.shutdownCoordinator;
    this.launcher = options.launcher;
  }
}

module.exports = InstallationService;
