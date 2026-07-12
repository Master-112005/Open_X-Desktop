const { execFileSync } = require('child_process');

class SignatureVerifier {
  constructor(options = {}) {
    this.configuration = options.configuration;
  }

  verify(context) {
    const startedAt = Date.now();
    try {
      const signature = this.readAuthenticode(context.filePath);
      context.signature = signature;
      const signed = signature.status === 'Valid';
      if (!signed && this.configuration.strictSignatureMode) {
        throw this.error('SIGNATURE_INVALID', `Package signature is not valid: ${signature.status || 'Unknown'}.`);
      }
      if (!signed) context.warn('SIGNATURE_RELAXED', 'Package is unsigned or signature could not be validated; accepted only because strict signature mode is disabled.');
      return context.addCheck('signature', true, signature, null, Date.now() - startedAt);
    } catch (error) {
      return context.addCheck('signature', false, {}, error, Date.now() - startedAt);
    }
  }

  readAuthenticode(filePath) {
    if (process.platform !== 'win32') return { checked: false, status: 'UnsupportedPlatform', signed: false };
    try {
      const script = [
        '& { param([string]$TargetPath)',
        '$sig = Get-AuthenticodeSignature -LiteralPath $TargetPath',
        '[pscustomobject]@{',
        'Status = [string]$sig.Status;',
        'StatusMessage = [string]$sig.StatusMessage;',
        'SignerCertificate = if ($sig.SignerCertificate) { $sig.SignerCertificate.Subject } else { $null }',
        '} | ConvertTo-Json -Compress',
        '}'
      ].join(' ');
      const output = execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script, filePath], {
        encoding: 'utf8',
        timeout: 10000,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      const parsed = JSON.parse(output || '{}');
      return {
        checked: true,
        status: parsed.Status || 'Unknown',
        statusMessage: parsed.StatusMessage || '',
        signerCertificate: parsed.SignerCertificate || null,
        signed: parsed.Status === 'Valid',
        trusted: parsed.Status === 'Valid',
        timestamp: null,
        publisher: parsed.SignerCertificate || null
      };
    } catch (error) {
      return { checked: false, status: 'Unavailable', signed: false, error: error.message };
    }
  }

  error(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
  }
}

module.exports = SignatureVerifier;
