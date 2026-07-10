function ok(data = {}, metadata = {}) {
  return {
    success: true,
    data,
    metadata
  };
}

function fail(error, metadata = {}) {
  const message = error instanceof Error ? error.message : String(error || 'Communication action failed');
  const details = { ...metadata };
  if (error?.context) details.context = error.context;
  if (error?.diagnostics) details.diagnostics = error.diagnostics;
  return {
    success: false,
    error: message,
    code: error?.code || metadata.code || 'COMMUNICATION_ERROR',
    metadata: details
  };
}

function duplicateContacts(provider, recipient, contacts) {
  return {
    success: false,
    needsClarification: true,
    error: 'Multiple matching contacts found',
    code: 'DUPLICATE_CONTACTS',
    data: {
      provider,
      recipient,
      clarificationType: 'communication.duplicateContacts',
      choices: contacts.map((contact, index) => ({
        index: index + 1,
        id: contact.id || contact.name || String(index + 1),
        title: contact.name || `Contact ${index + 1}`,
        provider,
        kind: 'contact',
        entities: {
          contactId: contact.id || contact.name || String(index + 1)
        }
      }))
    }
  };
}

module.exports = {
  ok,
  fail,
  duplicateContacts
};
