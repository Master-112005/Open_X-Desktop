# Communications Module

## Purpose

Communication actions are stateless. The assistant uses recipient data supplied in the current command and does not save or resolve an address book.

Supported paths:

- `tel:` standard calls when an explicit phone number is supplied
- `mailto:` drafts when an explicit email address is supplied

Message composition through chat providers is not supported by the assistant.

## Files

- `core/automation/communications.js`

## Workflow

1. Parser and router resolve `email.compose` or `call.start`.
2. Entity extraction captures the recipient, content, and optional platform.
3. The controller validates the direct recipient value.
4. It executes the matching URI integration and returns result data.

Standard calls and email drafts require a phone number or email address directly in the command. No recipient data is persisted by this module, settings, IPC, or active-learning routing evidence.
