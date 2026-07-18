const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { Logger } = require('../../core/assistant/Data');
const { formatLogLine } = require('../../core/chat/LogFormatter');
const CloudLogger = require('../../core/cloud/CloudLogger');

describe('Structured Logger', function() {
  let directory;

  beforeEach(function() {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'openx-logs-'));
  });

  afterEach(function() {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('should write structured app and error logs with sensitive data redacted', function() {
    const logger = new Logger({ directory, console: false });
    logger.info('Started', {
      user: 'local',
      password: 'unsafe',
      inputText: 'open private folder',
      nested: { apiKey: 'secret', transcript: 'call mummy' }
    });
    logger.error('Failed', { token: 'unsafe' });

    const appFile = fs.readdirSync(directory).find(name => name.startsWith('app-'));
    const errorFile = fs.readdirSync(directory).find(name => name.startsWith('error-'));
    const appEntry = JSON.parse(fs.readFileSync(path.join(directory, appFile), 'utf8').trim());
    const errorEntry = JSON.parse(fs.readFileSync(path.join(directory, errorFile), 'utf8').trim());

    assert.equal(appEntry.message, 'Started');
    assert.match(appEntry.summary, /user=local/);
    assert.match(appEntry.summary, /password=\[REDACTED\]/);
    assert.equal(appEntry.data.password, '[REDACTED]');
    assert.equal(appEntry.data.inputText, '[19 chars]');
    assert.equal(appEntry.data.nested.apiKey, '[REDACTED]');
    assert.equal(appEntry.data.nested.transcript, '[10 chars]');
    assert.equal(errorEntry.data.token, '[REDACTED]');
    assert.equal(JSON.stringify(appEntry).includes('open private folder'), false);
    assert.equal(JSON.stringify(appEntry).includes('call mummy'), false);
  });

  it('should redact console output as well as file output', function() {
    const logger = new Logger({ directory, file: false });
    const originalLog = console.log;
    let output = '';
    console.log = value => { output += value; };
    try {
      logger.info('Authentication', { password: 'never-print-this' });
    } finally {
      console.log = originalLog;
    }

    assert.match(output, /\[REDACTED\]/);
    assert.doesNotMatch(output, /never-print-this/);
  });

  it('should print all structured console logs as compact human-readable summaries', function() {
    const logger = new Logger({ directory, file: false });
    const originalLog = console.log;
    let output = '';
    console.log = value => { output += value; };
    try {
      logger.info('HTTP request completed', {
        method: 'POST',
        path: '/account/login/start',
        statusCode: 200,
        durationMs: 14,
        token: 'unsafe'
      });
    } finally {
      console.log = originalLog;
    }

    assert.match(output, /method=POST/);
    assert.match(output, /path=\/account\/login\/start/);
    assert.match(output, /status-code=200/);
    assert.match(output, /duration-ms=14/);
    assert.match(output, /token=\[REDACTED\]/);
    assert.doesNotMatch(output, /\{"method"/);
    assert.doesNotMatch(output, /unsafe/);
  });

  it('should summarize nested model metadata instead of printing object placeholders', function() {
    const logger = new Logger({ directory, file: false });
    const originalLog = console.log;
    let output = '';
    console.log = value => { output += value; };
    try {
      logger.info('[Voice Models] Assistant model summary', {
        reason: 'tts-ready',
        stt: {
          role: 'speech-to-text',
          engine: 'parakeet',
          model: 'nvidia-parakeet-tdt-v3',
          runtime: 'sherpa-onnx',
          files: 4
        },
        tts: {
          role: 'text-to-speech',
          engine: 'windows-sapi',
          voiceCount: 2
        }
      });
    } finally {
      console.log = originalLog;
    }

    assert.match(output, /reason=tts-ready/);
    assert.match(output, /stt=\{role:speech-to-text,engine:parakeet,model:nvidia-parakeet-tdt-v3,runtime:sherpa-onnx,files:4\}/);
    assert.match(output, /tts=\{role:text-to-speech,engine:windows-sapi,voice-count:2\}/);
    assert.doesNotMatch(output, /\[object\]/);
    assert.doesNotMatch(output, /\{"role"/);
  });

  it('should format standalone chat and cloud logs as readable single-line records', function() {
    const chatLine = formatLogLine('CHAT', 'info', 'Verification code requested', {
      apiBaseUrl: 'http://127.0.0.1:8090',
      statusCode: 200,
      durationMs: 14,
      otp: '123456'
    });

    assert.match(chatLine, /\[INFO\] \[CHAT\] Verification code requested/);
    assert.match(chatLine, /api-base-url=http:\/\/127\.0\.0\.1:8090/);
    assert.match(chatLine, /status-code=200/);
    assert.match(chatLine, /duration-ms=14/);
    assert.match(chatLine, /otp=\[REDACTED\]/);
    assert.doesNotMatch(chatLine, /\{"apiBaseUrl"/);
    assert.doesNotMatch(chatLine, /123456/);
  });

  it('should pass cloud metadata to the main logger without double timestamp formatting', function() {
    const entries = [];
    const structuredLogger = {
      _log() {},
      _formatData() {},
      info(message, data) {
        entries.push({ message, data });
      }
    };
    const logger = new CloudLogger({ logger: structuredLogger });

    logger.info('Connected', {
      relayUrl: 'ws://localhost:8090',
      authToken: 'unsafe'
    });

    assert.deepEqual(entries, [{
      message: '[CLOUD] Connected',
      data: {
        relayUrl: 'ws://localhost:8090',
        authToken: '[REDACTED]'
      }
    }]);
  });

  it('should rotate logs and enforce the retention limit', function() {
    const logger = new Logger({
      directory,
      console: false,
      maxFileSize: 120,
      maxFiles: 3
    });

    for (let index = 0; index < 12; index += 1) {
      logger.info('Rotation record', { index, value: 'x'.repeat(100) });
    }

    const appFiles = fs.readdirSync(directory).filter(name => name.startsWith('app-'));
    assert.ok(appFiles.length > 1);
    assert.ok(appFiles.length <= 3);
  });

  it('should create redacted crash records with stack and context', function() {
    Logger.writeCrashSync(
      new Error('renderer failed'),
      { origin: 'renderer', authorization: 'unsafe' },
      { directory, maxFiles: 5 }
    );

    const crashFile = fs.readdirSync(directory).find(name => name.startsWith('crash-'));
    const crashEntry = JSON.parse(fs.readFileSync(path.join(directory, crashFile), 'utf8').trim());
    assert.equal(crashEntry.message, 'renderer failed');
    assert.match(crashEntry.stack, /renderer failed/);
    assert.equal(crashEntry.context.authorization, '[REDACTED]');
  });

  it('should preserve useful Error diagnostics in structured log data', function() {
    const logger = new Logger({ directory, console: false });
    logger.error('Launch failed', new Error('executable missing'));

    const errorFile = fs.readdirSync(directory).find(name => name.startsWith('error-'));
    const errorEntry = JSON.parse(fs.readFileSync(path.join(directory, errorFile), 'utf8').trim());
    assert.equal(errorEntry.data.name, 'Error');
    assert.equal(errorEntry.data.message, 'executable missing');
    assert.match(errorEntry.data.stack, /executable missing/);
  });

  it('should print voice logs as compact human-readable summaries', function() {
    const logger = new Logger({ directory, file: false });
    const originalLog = console.log;
    let output = '';
    console.log = value => { output += value; };
    try {
      logger.info('[Voice] Runtime pipeline: audio frame received', {
        state: 'LISTENING',
        recognitionCycleId: 'cycle-2',
        text: 'open private file',
        counters: {
          audioFrames: 50,
          processedFrames: 49,
          sttFrames: 48,
          partialTranscripts: 2,
          finalTranscripts: 0
        }
      });
    } finally {
      console.log = originalLog;
    }

    assert.match(output, /state=LISTENING/);
    assert.match(output, /recognition-cycle-id=cycle-2/);
    assert.match(output, /pipeline=audio:50,processed:49,stt:48,partial:2/);
    assert.match(output, /text=\[17 chars\]/);
    assert.doesNotMatch(output, /open private file/);
  });
});
