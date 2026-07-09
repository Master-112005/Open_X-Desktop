'use strict';

const BaseValidator = require('./BaseValidator');

class PermissionValidator extends BaseValidator {
  validate(context) {
    const source = String(context.metadata.source || 'chat');
    const permissions = context.configuration?.permissions || {};
    const allowed = permissions[source] !== false;
    context.check(this.id, allowed, allowed ? 'source permission allowed' : `source permission denied: ${source}`, { source });
    return context;
  }
}

module.exports = PermissionValidator;
