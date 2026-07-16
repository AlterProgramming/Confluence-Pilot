let context: AudioContext | null = null;
let master: GainNode | null = null;
let ambientGain: GainNode | null = null;
let oscillatorA: OscillatorNode | null = null;
let oscillatorB: OscillatorNode | null = null;
let filter: BiquadFilterNode | null = null;
let muted = false;

function createAmbientGraph(audioContext: AudioContext) {
  master = audioContext.createGain();
  master.gain.value = 0;
  master.connect(audioContext.destination);

  const compressor = audioContext.createDynamicsCompressor();
  compressor.threshold.value = -28;
  compressor.knee.value = 18;
  compressor.ratio.value = 5;
  compressor.attack.value = 0.02;
  compressor.release.value = 0.4;
  compressor.connect(master);

  filter = audioContext.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 520;
  filter.Q.value = 0.7;
  filter.connect(compressor);

  ambientGain = audioContext.createGain();
  ambientGain.gain.value = 0.022;
  ambientGain.connect(filter);

  oscillatorA = audioContext.createOscillator();
  oscillatorA.type = 'sine';
  oscillatorA.frequency.value = 58;
  oscillatorA.detune.value = -5;
  oscillatorA.connect(ambientGain);

  oscillatorB = audioContext.createOscillator();
  oscillatorB.type = 'triangle';
  oscillatorB.frequency.value = 87;
  oscillatorB.detune.value = 7;
  const secondGain = audioContext.createGain();
  secondGain.gain.value = 0.32;
  oscillatorB.connect(secondGain);
  secondGain.connect(ambientGain);

  const lfo = audioContext.createOscillator();
  const lfoGain = audioContext.createGain();
  lfo.type = 'sine';
  lfo.frequency.value = 0.085;
  lfoGain.gain.value = 0.006;
  lfo.connect(lfoGain);
  lfoGain.connect(ambientGain.gain);

  oscillatorA.start();
  oscillatorB.start();
  lfo.start();
}

function ensureAudio() {
  if (typeof window === 'undefined') return null;
  if (!context) {
    const AudioContextConstructor = window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextConstructor) return null;
    context = new AudioContextConstructor();
    createAmbientGraph(context);
  }
  return context;
}

export function startAudio() {
  const audioContext = ensureAudio();
  if (!audioContext || !master) return;
  void audioContext.resume();
  const now = audioContext.currentTime;
  master.gain.cancelScheduledValues(now);
  master.gain.setValueAtTime(master.gain.value, now);
  master.gain.linearRampToValueAtTime(muted ? 0 : 0.9, now + 0.45);
}

export function setAudioMuted(value: boolean) {
  muted = value;
  if (!context || !master) return;
  const audioContext = context;
  const now = audioContext.currentTime;
  master.gain.cancelScheduledValues(now);
  master.gain.setValueAtTime(master.gain.value, now);
  master.gain.linearRampToValueAtTime(value ? 0 : 0.9, now + 0.18);
}

export function setRoomTone(roomIndex: number) {
  const audioContext = ensureAudio();
  if (!audioContext || !oscillatorA || !oscillatorB || !filter) return;
  const base = 52 + roomIndex * 2.35;
  const now = audioContext.currentTime;
  oscillatorA.frequency.cancelScheduledValues(now);
  oscillatorB.frequency.cancelScheduledValues(now);
  filter.frequency.cancelScheduledValues(now);
  oscillatorA.frequency.exponentialRampToValueAtTime(base, now + 0.8);
  oscillatorB.frequency.exponentialRampToValueAtTime(base * 1.5, now + 0.8);
  filter.frequency.exponentialRampToValueAtTime(420 + roomIndex * 34, now + 0.7);
}

export function playTransition(direction: -1 | 1, distance = 1) {
  const audioContext = ensureAudio();
  if (!audioContext || !master || muted) return;

  const duration = 0.95 + Math.min(0.75, distance * 0.08);
  const buffer = audioContext.createBuffer(1, Math.ceil(audioContext.sampleRate * duration), audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  let previous = 0;
  for (let index = 0; index < data.length; index += 1) {
    const white = Math.random() * 2 - 1;
    previous = previous * 0.84 + white * 0.16;
    data[index] = previous;
  }

  const source = audioContext.createBufferSource();
  source.buffer = buffer;

  const sweep = audioContext.createBiquadFilter();
  sweep.type = 'bandpass';
  sweep.Q.value = 1.15;

  const transitionGain = audioContext.createGain();
  const pan = audioContext.createStereoPanner();
  pan.pan.value = direction * 0.16;

  const now = audioContext.currentTime;
  sweep.frequency.setValueAtTime(direction > 0 ? 240 : 2500, now);
  sweep.frequency.exponentialRampToValueAtTime(direction > 0 ? 3200 : 260, now + duration);
  transitionGain.gain.setValueAtTime(0.0001, now);
  transitionGain.gain.exponentialRampToValueAtTime(0.075, now + duration * 0.3);
  transitionGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  source.connect(sweep);
  sweep.connect(transitionGain);
  transitionGain.connect(pan);
  pan.connect(master);
  source.start(now);
  source.stop(now + duration + 0.05);
}

export function playArrival(roomIndex: number) {
  const audioContext = ensureAudio();
  if (!audioContext || !master || muted) return;
  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = 174 + roomIndex * 5.5;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.035, now + 0.035);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.72);
  oscillator.connect(gain);
  gain.connect(master);
  oscillator.start(now);
  oscillator.stop(now + 0.78);
}
