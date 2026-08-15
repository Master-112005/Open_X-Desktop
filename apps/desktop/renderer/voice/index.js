(function() {
  'use strict';

  const VAD_TARGET_SAMPLE_RATE = 16000;
  const PROCESSOR_BUFFER_SIZE = 4096;
  const PRE_ROLL_MS = 350;
  const NO_SPEECH_DISPLAY_MS = 4500;
  const DUPLICATE_TRANSCRIPT_WINDOW_MS = 5000;
  const RELISTEN_DELAY_MS = 250;
  const DEFAULT_VOICE_SETTINGS = Object.freeze({
    microphoneDeviceId: null,
    voiceVolume: 1,
    showVoiceTranscript: true,
    autoCloseVoice: false,
    speakRepliesEnabled: true,
    ttsVoiceURI: ''
  });
  const VAD_CONFIG = Object.freeze({
    calibrationMs: 450,
    minSpeechRmsFloor: 0.006,
    speechNoiseMultiplier: 2.8,
    maxSpeechRmsThreshold: 0.12,
    continuationRatio: 0.72,
    silenceHoldMs: 850,
    minSpeechMs: 180,
    maxUtteranceMs: 20000,
    noSpeechTimeoutMs: 12000,
    silentInputRms: 0.0001
  });

  const elements = {
    window: document.getElementById('voice-window'),
    orb: document.getElementById('voice-orb'),
    orbCore: document.getElementById('orb-core'),
    label: document.getElementById('voice-label'),
    heard: document.getElementById('voice-heard'),
    reply: document.getElementById('voice-reply')
  };

  let settings = { ...DEFAULT_VOICE_SETTINGS };
  let state = 'idle';
  let activation = null;
  let turnId = 0;
  let active = false;
  let lastTranscript = '';
  let lastTranscriptAt = 0;
  let audioContext = null;
  let mediaStream = null;
  let sourceNode = null;
  let workletNode = null;
  let scriptProcessor = null;
  let silentGainNode = null;
  let vad = null;
  let utteranceChunks = [];
  let preRollChunks = [];
  let recording = false;
  let listening = false;
  let noSpeechTimer = null;
  let autoCloseTimer = null;
  let relistenTimer = null;
  let workletBlobUrl = '';
  let currentMicrophone = null;
  let attemptedDeviceIds = new Set();
  let captureGeneration = 0;

  function attemptKey(deviceId) {
    return deviceId || 'default';
  }

  function percentile(values, ratio) {
    if (values.length === 0) return 0;
    const sorted = values.slice().sort((a, b) => a - b);
    const index = Math.max(0, Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio)));
    return sorted[index];
  }

  function computeRms(input) {
    if (input.length === 0) return 0;
    let sumSquares = 0;
    for (let i = 0; i < input.length; i += 1) sumSquares += input[i] * input[i];
    return Math.sqrt(sumSquares / input.length);
  }

  class VoiceActivityDetector {
    constructor(config = {}) {
      this.config = { ...VAD_CONFIG, ...config };
      this.totalMs = 0;
      this.speechMs = 0;
      this.silenceMs = 0;
      this.peakRms = 0;
      this.calibrationRms = [];
      this.speechThreshold = null;
      this.continuationThreshold = null;
      this.speechHasStarted = false;
    }

    accept(input, sampleRate) {
      const rms = computeRms(input);
      const chunkMs = sampleRate > 0 ? (input.length / sampleRate) * 1000 : 0;
      this.totalMs += chunkMs;
      this.peakRms = Math.max(this.peakRms, rms);

      let calibrated = false;
      let noiseFloor;
      if (this.speechThreshold === null) {
        this.calibrationRms.push(rms);
        if (this.totalMs < this.config.calibrationMs) {
          return this.decision(rms, calibrated, undefined, false, null);
        }

        const lowNoise = percentile(this.calibrationRms, 0.2);
        const medianNoise = percentile(this.calibrationRms, 0.5);
        noiseFloor = Math.min(medianNoise, lowNoise * 1.6);
        this.speechThreshold = Math.min(
          this.config.maxSpeechRmsThreshold,
          Math.max(this.config.minSpeechRmsFloor, noiseFloor * this.config.speechNoiseMultiplier)
        );
        this.continuationThreshold = Math.max(this.config.minSpeechRmsFloor * 0.75, this.speechThreshold * this.config.continuationRatio);
        calibrated = true;
      }

      const speechThreshold = this.speechThreshold;
      const continuationThreshold = this.continuationThreshold;
      if (speechThreshold === null || continuationThreshold === null) {
        return this.decision(rms, calibrated, noiseFloor, false, null);
      }

      const isSpeech = rms >= speechThreshold;
      const isContinuation = this.speechHasStarted && rms >= continuationThreshold;
      const activeSpeech = isSpeech || isContinuation;
      const speechStarted = !this.speechHasStarted && isSpeech;

      if (activeSpeech) {
        this.speechHasStarted = true;
        this.speechMs += chunkMs;
        this.silenceMs = 0;
      } else if (this.speechHasStarted) {
        this.silenceMs += chunkMs;
      }

      const hasEnoughSpeech = this.speechMs >= this.config.minSpeechMs;
      const trailingSilence = this.speechHasStarted && hasEnoughSpeech && this.silenceMs >= this.config.silenceHoldMs;
      const tooLong = this.speechHasStarted && this.totalMs >= this.config.maxUtteranceMs;
      if (trailingSilence || tooLong) {
        return this.decision(rms, calibrated, noiseFloor, speechStarted, null, trailingSilence ? 'trailing-silence' : 'max-duration');
      }

      if (!this.speechHasStarted && this.totalMs >= this.config.noSpeechTimeoutMs) {
        const reason = this.peakRms <= this.config.silentInputRms ? 'silent-input' : 'timeout';
        return this.decision(rms, calibrated, noiseFloor, false, { reason, peakRms: this.peakRms, speechThreshold });
      }

      return this.decision(rms, calibrated, noiseFloor, speechStarted, null);
    }

    decision(rms, calibrated, noiseFloor, speechStarted, noSpeech, finalized = false) {
      return {
        rms,
        level: Math.min(1, rms * 6),
        calibrated,
        noiseFloor,
        speechThreshold: this.speechThreshold || undefined,
        speechStarted,
        recording: this.speechHasStarted,
        finalized,
        noSpeech
      };
    }
  }

  function setState(nextState, label) {
    state = nextState;
    elements.window.dataset.state = nextState;
    elements.orb.dataset.state = nextState;
    elements.label.textContent = label || labelForState(nextState);
  }

  function labelForState(nextState) {
    if (nextState === 'listening') return 'Listening';
    if (nextState === 'processing') return 'Processing';
    if (nextState === 'speaking') return 'Speaking';
    if (nextState === 'error') return 'Voice unavailable';
    return 'Ready';
  }

  function showWindow() {
    clearTimeout(autoCloseTimer);
    elements.window.dataset.phase = 'shown';
  }

  function setExpanded(expanded) {
    elements.window.dataset.mode = expanded ? 'expanded' : 'compact';
    elements.window.style.setProperty('--voice-height', expanded ? '104px' : '62px');
  }

  function setLevel(level) {
    const scale = 0.85 + Math.min(1, Math.max(0, level)) * 0.45;
    elements.orb.style.setProperty('--orb-scale', scale.toFixed(3));
  }

  function setTranscript(heard, reply) {
    elements.heard.textContent = heard || '';
    elements.reply.textContent = reply || '';
    setExpanded(Boolean(settings.showVoiceTranscript && (heard || reply)));
  }

  function microphoneScore(device) {
    const label = String(device?.label || '').toLowerCase();
    let score = 0;
    if (label.includes('virtual') || label.includes('audiorelay') || label.includes('cable') || label.includes('stereo mix')) score -= 50;
    if (label.includes('microphone array') || label.includes('realtek') || label.includes('internal') || label.includes('built-in')) score += 20;
    if (label.includes('headset') || label.includes('usb') || label.includes('mic')) score += 10;
    return score;
  }

  async function pickFallbackMicrophone(currentDeviceId, currentLabel) {
    if (!navigator.mediaDevices?.enumerateDevices) return null;
    const currentLabelLower = String(currentLabel || '').toLowerCase();
    const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
    return devices
      .filter(device => device.kind === 'audioinput')
      .filter(device => device.deviceId && device.deviceId !== 'default' && device.deviceId !== 'communications')
      .filter(device => device.deviceId !== currentDeviceId)
      .filter(device => !attemptedDeviceIds.has(device.deviceId))
      .filter(device => !currentLabelLower || String(device.label || '').toLowerCase() !== currentLabelLower)
      .sort((a, b) => microphoneScore(b) - microphoneScore(a))[0] || null;
  }

  function closeAfterDelay(delayMs = 900) {
    if (!settings.autoCloseVoice) return;
    clearTimeout(autoCloseTimer);
    autoCloseTimer = setTimeout(() => {
      window.openx?.closeVoice?.().catch?.(() => {});
    }, delayMs);
  }

  function clearRelistenTimer() {
    if (!relistenTimer) return;
    clearTimeout(relistenTimer);
    relistenTimer = null;
  }

  function listenAfterTurn(currentTurn, delayMs = RELISTEN_DELAY_MS, closeDelayMs = delayMs) {
    if (!active || currentTurn !== turnId) return false;
    if (settings.autoCloseVoice) {
      setState('idle', 'Ready');
      closeAfterDelay(closeDelayMs);
      return true;
    }
    setState('processing', 'Listening...');
    clearRelistenTimer();
    relistenTimer = setTimeout(() => {
      relistenTimer = null;
      if (!active || currentTurn !== turnId || settings.autoCloseVoice) return;
      beginListening({ resetAttempts: true, statusText: 'Listening...' }).catch(error => failVoice(error));
    }, delayMs);
    return true;
  }

  function deactivateVoiceTurn() {
    active = false;
    turnId += 1;
    captureGeneration += 1;
    clearRelistenTimer();
    window.speechSynthesis?.cancel?.();
  }

  function concatFloat32(chunks) {
    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const output = new Float32Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      output.set(chunk, offset);
      offset += chunk.length;
    }
    return output;
  }

  function resampleLinear(input, fromRate, toRate) {
    if (!input || input.length === 0) return new Float32Array();
    if (fromRate === toRate) return input instanceof Float32Array ? input : Float32Array.from(input);
    const ratio = fromRate / toRate;
    const outputLength = Math.max(1, Math.round(input.length / ratio));
    const output = new Float32Array(outputLength);
    for (let i = 0; i < outputLength; i += 1) {
      const position = i * ratio;
      const left = Math.floor(position);
      const right = Math.min(input.length - 1, left + 1);
      const weight = position - left;
      output[i] = input[left] * (1 - weight) + input[right] * weight;
    }
    return output;
  }

  function trimPreRoll() {
    const maxSamples = Math.round((PRE_ROLL_MS / 1000) * VAD_TARGET_SAMPLE_RATE);
    let total = preRollChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    while (preRollChunks.length > 1 && total > maxSamples) {
      const removed = preRollChunks.shift();
      total -= removed.length;
    }
  }

  function resetCaptureState() {
    vad = new VoiceActivityDetector();
    utteranceChunks = [];
    preRollChunks = [];
    recording = false;
    setLevel(0);
  }

  async function pickConstraints() {
    const base = {
      audio: {
        sampleRate: { ideal: VAD_TARGET_SAMPLE_RATE },
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: { ideal: 1 }
      },
      video: false
    };
    if (settings.microphoneDeviceId) {
      base.audio.deviceId = { exact: settings.microphoneDeviceId };
    }
    return base;
  }

  async function openMicrophone(captureToken) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(await pickConstraints());
      if (captureToken !== captureGeneration) {
        for (const track of stream.getTracks()) track.stop();
        return null;
      }
      const track = stream.getAudioTracks()[0] || null;
      currentMicrophone = {
        deviceId: track?.getSettings?.()?.deviceId || settings.microphoneDeviceId || null,
        label: track?.label || null
      };
      console.log(`[VOICE] mic access granted (${currentMicrophone.label || 'default microphone'}), listening started (calibrating noise floor...)`);
      return stream;
    } catch (error) {
      if (!settings.microphoneDeviceId) throw error;
      const fallbackSettings = { ...settings, microphoneDeviceId: null };
      await window.openx?.updateVoiceSettings?.({ microphoneDeviceId: null }).catch?.(() => {});
      settings = fallbackSettings;
      const stream = await navigator.mediaDevices.getUserMedia(await pickConstraints());
      if (captureToken !== captureGeneration) {
        for (const track of stream.getTracks()) track.stop();
        return null;
      }
      const track = stream.getAudioTracks()[0] || null;
      currentMicrophone = {
        deviceId: track?.getSettings?.()?.deviceId || null,
        label: track?.label || null
      };
      console.log(`[VOICE] selected microphone failed; using ${currentMicrophone.label || 'default microphone'}`);
      return stream;
    }
  }

  function createWorkletSource() {
    return `
      class OpenXVoiceProcessor extends AudioWorkletProcessor {
        process(inputs) {
          const input = inputs[0] && inputs[0][0];
          if (input) this.port.postMessage(input.slice(0));
          return true;
        }
      }
      registerProcessor('openx-voice-processor', OpenXVoiceProcessor);
    `;
  }

  async function connectAudioGraph(stream, captureToken) {
    if (!stream || captureToken !== captureGeneration) return false;
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    const nextAudioContext = new AudioContextCtor({ latencyHint: 'interactive', sampleRate: VAD_TARGET_SAMPLE_RATE });
    audioContext = nextAudioContext;
    if (nextAudioContext.state === 'suspended') await nextAudioContext.resume();
    if (captureToken !== captureGeneration) {
      await nextAudioContext.close().catch(() => {});
      if (audioContext === nextAudioContext) audioContext = null;
      return false;
    }
    const contextSampleRate = nextAudioContext.sampleRate || VAD_TARGET_SAMPLE_RATE;
    sourceNode = nextAudioContext.createMediaStreamSource(stream);
    silentGainNode = nextAudioContext.createGain();
    silentGainNode.gain.value = 0;

    if (nextAudioContext.audioWorklet) {
      workletBlobUrl = URL.createObjectURL(new Blob([createWorkletSource()], { type: 'text/javascript' }));
      try {
        await nextAudioContext.audioWorklet.addModule(workletBlobUrl);
        if (captureToken !== captureGeneration) return false;
        workletNode = new AudioWorkletNode(nextAudioContext, 'openx-voice-processor', {
          numberOfInputs: 1,
          numberOfOutputs: 1,
          outputChannelCount: [1]
        });
        workletNode.port.onmessage = event => {
          if (captureToken !== captureGeneration) return;
          handleAudioChunk(event.data, contextSampleRate);
        };
        sourceNode.connect(workletNode);
        workletNode.connect(silentGainNode);
        silentGainNode.connect(nextAudioContext.destination);
        return true;
      } catch (error) {
        console.warn(`[VOICE] AudioWorklet unavailable (${error?.message || String(error)}); falling back to ScriptProcessorNode`);
      } finally {
        URL.revokeObjectURL(workletBlobUrl);
        workletBlobUrl = '';
      }
    }

    console.warn('[VOICE] AudioWorklet unavailable; falling back to ScriptProcessorNode');
    if (captureToken !== captureGeneration || !audioContext) return false;
    scriptProcessor = nextAudioContext.createScriptProcessor(PROCESSOR_BUFFER_SIZE, 1, 1);
    scriptProcessor.onaudioprocess = event => {
      if (captureToken !== captureGeneration) return;
      handleAudioChunk(event.inputBuffer.getChannelData(0), contextSampleRate);
    };
    sourceNode.connect(scriptProcessor);
    scriptProcessor.connect(silentGainNode);
    silentGainNode.connect(nextAudioContext.destination);
    return true;
  }

  async function stopListening() {
    listening = false;
    clearTimeout(noSpeechTimer);
    noSpeechTimer = null;

    try { workletNode?.disconnect?.(); } catch (_) {}
    try { sourceNode?.disconnect?.(); } catch (_) {}
    try { scriptProcessor?.disconnect?.(); } catch (_) {}
    try { silentGainNode?.disconnect?.(); } catch (_) {}
    if (workletNode?.port) workletNode.port.onmessage = null;
    if (scriptProcessor) scriptProcessor.onaudioprocess = null;
    workletNode = null;
    scriptProcessor = null;
    sourceNode = null;
    silentGainNode = null;

    if (mediaStream) {
      for (const track of mediaStream.getTracks()) track.stop();
      mediaStream = null;
    }
    if (audioContext && audioContext.state !== 'closed') {
      await audioContext.close().catch(() => {});
    }
    audioContext = null;
    if (workletBlobUrl) {
      URL.revokeObjectURL(workletBlobUrl);
      workletBlobUrl = '';
    }
    resetCaptureState();
  }

  function handleAudioChunk(rawChunk, sampleRate) {
    if (!listening || state === 'processing' || state === 'speaking') return;
    const chunk = resampleLinear(rawChunk, sampleRate, VAD_TARGET_SAMPLE_RATE);
    if (chunk.length === 0) return;
    const decision = vad.accept(chunk, VAD_TARGET_SAMPLE_RATE);
    setLevel(decision.level);
    if (decision.calibrated && decision.noiseFloor !== undefined && decision.speechThreshold !== undefined) {
      console.log(`[VOICE] calibrated: noise floor ${decision.noiseFloor.toFixed(4)}, speech threshold ${decision.speechThreshold.toFixed(4)}`);
    }

    if (!recording) {
      preRollChunks.push(chunk);
      trimPreRoll();
    }

    if (decision.speechStarted && !recording) {
      console.log('[VOICE] speech detected');
      recording = true;
      utteranceChunks = preRollChunks.slice();
      setState('listening', 'Listening');
    }

    if (recording) utteranceChunks.push(chunk);

    if (decision.finalized) {
      const samples = concatFloat32(utteranceChunks);
      console.log(`[VOICE] utterance finalized (${decision.finalized === 'trailing-silence' ? 'trailing silence' : 'max duration reached'})`);
      resetCaptureState();
      processUtterance(samples).catch(error => failVoice(error));
      return;
    }

    if (decision.noSpeech) {
      resetCaptureState();
      handleNoSpeech(decision.noSpeech).catch(error => failVoice(error));
    }
  }

  async function handleNoSpeech(diagnostic) {
    const wasListening = listening;
    const microphone = currentMicrophone ? { ...currentMicrophone } : null;
    console.warn(
      `[VOICE] no speech detected within ${VAD_CONFIG.noSpeechTimeoutMs}ms ` +
      `(peak level ${diagnostic.peakRms.toFixed(4)}, threshold ${diagnostic.speechThreshold.toFixed(4)}, reason ${diagnostic.reason})`
    );
    await stopListening();
    if (!wasListening) return;
    if (diagnostic.reason === 'silent-input') {
      if (microphone?.deviceId) attemptedDeviceIds.add(microphone.deviceId);
      const fallback = await pickFallbackMicrophone(microphone?.deviceId || null, microphone?.label || null);
      if (fallback) {
        attemptedDeviceIds.add(fallback.deviceId);
        setState('processing', `Trying ${fallback.label || 'another microphone'}...`);
        await window.openx?.updateVoiceSettings?.({ microphoneDeviceId: fallback.deviceId }).catch?.(() => null);
        settings = { ...settings, microphoneDeviceId: fallback.deviceId };
        setTimeout(() => {
          if (state === 'processing') {
            beginListening({ resetAttempts: false, deviceId: fallback.deviceId, statusText: 'Starting alternate microphone...' }).catch(error => failVoice(error));
          }
        }, 350);
        return;
      }
    }

    const device = microphone?.label ? ` (${microphone.label})` : '';
    const message = diagnostic.reason === 'silent-input'
      ? `The selected microphone${device} is producing a zero-level signal. Check Windows input volume, unmute the device, or choose another microphone in Settings > Voice.`
      : "I didn't hear speech. Press Alt+Space and try again, or raise the microphone input level.";
    setState('error', message);
    setTranscript('', message);
    setTimeout(() => {
      if (settings.autoCloseVoice) window.openx?.closeVoice?.().catch?.(() => {});
    }, NO_SPEECH_DISPLAY_MS);
  }

  async function processUtterance(samples) {
    const currentTurn = ++turnId;
    await stopListening();
    setState('processing', 'Transcribing');
    const transcription = await window.openx.transcribeVoice(samples);
    if (currentTurn !== turnId) return;
    if (transcription?.success === false) {
      throw new Error(transcription.error || 'Voice transcription failed');
    }

    const text = String(typeof transcription === 'string' ? transcription : (transcription?.text || '')).trim();
    if (!text) {
      setState('idle', 'I did not catch that');
      listenAfterTurn(currentTurn, 900);
      return;
    }
    const now = Date.now();
    if (text.toLowerCase() === lastTranscript.toLowerCase() && now - lastTranscriptAt < DUPLICATE_TRANSCRIPT_WINDOW_MS) {
      setState('idle', 'Ready');
      listenAfterTurn(currentTurn, 600);
      return;
    }
    lastTranscript = text;
    lastTranscriptAt = now;
    setTranscript(`You said: ${text}`, '');
    setState('processing', 'Thinking');

    const reply = await sendVoiceCommand(text);
    if (currentTurn !== turnId) return;
    const responseText = String(reply?.response || reply?.message || reply?.text || '').trim();
    if (responseText) setTranscript(`You said: ${text}`, responseText);
    if (settings.speakRepliesEnabled && responseText) {
      await speak(responseText, currentTurn);
    }
    listenAfterTurn(currentTurn, responseText ? RELISTEN_DELAY_MS : 700, responseText ? 1200 : 700);
  }

  async function sendVoiceCommand(text) {
    if (typeof window.openx?.processVoiceCommand === 'function') {
      return window.openx.processVoiceCommand(text);
    }
    return window.openx.processCommand(text, 'voice');
  }

  function selectVoice() {
    const voices = window.speechSynthesis?.getVoices?.() || [];
    if (!settings.ttsVoiceURI) return null;
    return voices.find(voice => voice.voiceURI === settings.ttsVoiceURI) || null;
  }

  function speak(text, currentTurn) {
    return new Promise(resolve => {
      const synth = window.speechSynthesis;
      if (!synth || currentTurn !== turnId) {
        resolve();
        return;
      }
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.volume = Math.max(0, Math.min(1, Number(settings.voiceVolume) || 1));
      const voice = selectVoice();
      if (voice) utterance.voice = voice;
      utterance.onstart = () => {
        if (currentTurn === turnId) setState('speaking', 'Speaking');
      };
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      synth.speak(utterance);
    });
  }

  function failVoice(error) {
    console.error('[VOICE] Runtime failed', error);
    setState('error', error?.message || 'Voice unavailable');
    closeAfterDelay(1400);
  }

  async function beginListening(nextActivation = {}) {
    active = true;
    activation = nextActivation || {};
    clearRelistenTimer();
    const captureToken = captureGeneration + 1;
    captureGeneration = captureToken;
    if (activation.resetAttempts !== false) attemptedDeviceIds = new Set();
    if (activation.deviceId !== undefined) settings = { ...settings, microphoneDeviceId: activation.deviceId };
    attemptedDeviceIds.add(attemptKey(settings.microphoneDeviceId));
    turnId += 1;
    window.speechSynthesis?.cancel?.();
    await stopListening().catch(() => {});
    showWindow();
    setTranscript('', activation.greetingText || activation.greeting || '');
    setState('processing', activation.statusText || 'Starting microphone...');
    resetCaptureState();
    try {
      mediaStream = await openMicrophone(captureToken);
      if (captureToken !== captureGeneration || !mediaStream) return;
      const connected = await connectAudioGraph(mediaStream, captureToken);
      if (captureToken !== captureGeneration || !connected) return;
      listening = true;
      setState('listening', 'Listening');
    } catch (error) {
      failVoice(error);
    }
  }

  async function loadSettings() {
    const loaded = await window.openx?.getVoiceSettings?.().catch?.(() => null);
    settings = { ...DEFAULT_VOICE_SETTINGS, ...(loaded || {}) };
  }

  async function initialize() {
    if (!window.openx) {
      failVoice(new Error('OpenX bridge is unavailable'));
      return;
    }
    await loadSettings();
    const pendingActivation = await window.openx.getVoiceActivation?.().catch?.(() => null);
    window.openx.onVoiceActivated?.(payload => beginListening(payload).catch(error => failVoice(error)));
    window.openx.onVoiceDeactivated?.(() => {
      deactivateVoiceTurn();
      stopListening().catch(() => {});
    });
    window.openx.onVoiceInterrupted?.(() => {
      if (state === 'listening') {
        deactivateVoiceTurn();
        window.openx.closeVoice?.().catch?.(() => {});
        return;
      }
      beginListening({ resetAttempts: true, statusText: 'Listening...' }).catch(error => failVoice(error));
    });
    await beginListening(pendingActivation || {});
  }

  window.addEventListener('beforeunload', () => {
    deactivateVoiceTurn();
    stopListening().catch(() => {});
  });

  window.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    deactivateVoiceTurn();
    stopListening().catch(() => {});
    window.openx?.closeVoice?.().catch?.(() => {});
  });

  initialize().catch(error => failVoice(error));
})();
