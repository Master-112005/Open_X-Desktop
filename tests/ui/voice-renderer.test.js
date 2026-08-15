const assert = require('assert');
const fs = require('fs');
const path = require('path');

describe('Voice Renderer UI', function() {
  const rendererRoot = path.join(__dirname, '..', '..', 'apps', 'desktop', 'renderer', 'voice');
  const script = fs.readFileSync(path.join(rendererRoot, 'index.js'), 'utf8');

  it('should re-arm listening after a completed assistant reply when auto close is off', function() {
    assert.match(script, /function listenAfterTurn\(currentTurn, delayMs = RELISTEN_DELAY_MS, closeDelayMs = delayMs\)/);
    assert.match(script, /if \(settings\.autoCloseVoice\) \{[\s\S]*closeAfterDelay\(closeDelayMs\);[\s\S]*return true;[\s\S]*\}/);
    assert.match(script, /beginListening\(\{ resetAttempts: true, statusText: 'Listening\.\.\.' \}\)/);
    assert.match(script, /listenAfterTurn\(currentTurn, responseText \? RELISTEN_DELAY_MS : 700, responseText \? 1200 : 700\)/);
  });

  it('should cancel queued re-listening when the voice window is closed or interrupted', function() {
    assert.match(script, /function deactivateVoiceTurn\(\) \{[\s\S]*active = false;[\s\S]*turnId \+= 1;[\s\S]*speechSynthesis\?\.cancel/);
    assert.match(script, /captureGeneration \+= 1;/);
    assert.match(script, /clearRelistenTimer\(\);/);
    assert.match(script, /onVoiceDeactivated\?\.\(\(\) => \{[\s\S]*deactivateVoiceTurn\(\);[\s\S]*stopListening\(\)/);
    assert.match(script, /if \(!active \|\| currentTurn !== turnId \|\| settings\.autoCloseVoice\) return;/);
    assert.match(script, /event\.key !== 'Escape'[\s\S]*deactivateVoiceTurn\(\)/);
  });

  it('should ignore stale audio callbacks from replaced capture sessions', function() {
    assert.match(script, /let captureGeneration = 0;/);
    assert.match(script, /const captureToken = captureGeneration \+ 1;/);
    assert.match(script, /function connectAudioGraph\(stream, captureToken\)/);
    assert.match(script, /const contextSampleRate = nextAudioContext\.sampleRate \|\| VAD_TARGET_SAMPLE_RATE;/);
    assert.match(script, /if \(captureToken !== captureGeneration\) return;[\s\S]*handleAudioChunk\(event\.data, contextSampleRate\);/);
    assert.match(script, /if \(captureToken !== captureGeneration\) return;[\s\S]*handleAudioChunk\(event\.inputBuffer\.getChannelData\(0\), contextSampleRate\);/);
    assert.doesNotMatch(script, /handleAudioChunk\(event\.data, audioContext\.sampleRate\)/);
    assert.doesNotMatch(script, /handleAudioChunk\(event\.inputBuffer\.getChannelData\(0\), audioContext\.sampleRate\)/);
  });
});
