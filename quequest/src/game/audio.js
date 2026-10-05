export const EXTERNAL_SOUNDS = Object.freeze({
  'ui-click': 'assets/audio/kenney/click.wav',
});

export const SOUND_RECIPES = Object.freeze({
  'ui-click': Object.freeze({ frequency: 420, end: 300, duration: .045, gain: .025, type: 'triangle' }),
  cannon: Object.freeze({ frequency: 124, end: 58, duration: .09, gain: .095, type: 'sawtooth' }),
  impact: Object.freeze({ frequency: 76, end: 31, duration: .16, gain: .105, type: 'square' }),
  hit: Object.freeze({ frequency: 92, end: 48, duration: .13, gain: .08, type: 'square' }),
  dash: Object.freeze({ frequency: 180, end: 620, duration: .11, gain: .06, type: 'sawtooth' }),
  collapse: Object.freeze({ frequency: 74, end: 27, duration: .72, gain: .14, type: 'sawtooth' }),
  pickup: Object.freeze({ frequency: 290, end: 360, duration: .07, gain: .035, type: 'triangle' }),
  scan: Object.freeze({ frequency: 520, end: 740, duration: .09, gain: .04, type: 'sine' }),
  wire: Object.freeze({ frequency: 240, end: 680, duration: .15, gain: .05, type: 'triangle' }),
  lock: Object.freeze({ frequency: 180, end: 110, duration: .18, gain: .065, type: 'square' }),
  drop: Object.freeze({ frequency: 130, end: 82, duration: .12, gain: .05, type: 'square' }),
  step: Object.freeze({ frequency: 72, end: 54, duration: .045, gain: .018, type: 'triangle' }),
  clank: Object.freeze({ frequency: 920, end: 610, duration: .08, gain: .022, type: 'square' }),
  whoosh: Object.freeze({ frequency: 260, end: 120, duration: .09, gain: .03, type: 'sawtooth' }),
  cash: Object.freeze({ frequency: 1046, end: 1568, duration: .32, gain: .115, type: 'sine' }),
  wake: Object.freeze({ frequency: 210, end: 520, duration: .28, gain: .055, type: 'sine' }),
  arm: Object.freeze({ frequency: 118, end: 154, duration: .18, gain: .045, type: 'triangle' }),
  blocked: Object.freeze({ frequency: 96, end: 96, duration: .35, gain: .09, type: 'square' }),
  reward: Object.freeze({ frequency: 330, end: 880, duration: .58, gain: .12, type: 'sine' }),
  door: Object.freeze({ frequency: 95, end: 42, duration: .26, gain: .1, type: 'square' }),
  poster: Object.freeze({ frequency: 310, end: 92, duration: .2, gain: .075, type: 'triangle' }),
  power: Object.freeze({ frequency: 155, end: 640, duration: .48, gain: .085, type: 'sawtooth' }),
  // 17.0: jumping, landing on things, and a blip when someone in the hall speaks.
  jump: Object.freeze({ frequency: 150, end: 290, duration: .08, gain: .03, type: 'triangle' }),
  land: Object.freeze({ frequency: 88, end: 38, duration: .12, gain: .07, type: 'square' }),
  chatter: Object.freeze({ frequency: 660, end: 520, duration: .05, gain: .018, type: 'triangle' }),
  // 17.3: the garage and the apartment -- switches, doors, the TV, the
  // fridge, the toilet, the cat, the car, the laptop, the engine upgrade.
  switch: Object.freeze({ frequency: 1800, end: 900, duration: .04, gain: .03, type: 'square' }),
  rolldoor: Object.freeze({ frequency: 70, end: 110, duration: .7, gain: .07, type: 'sawtooth' }),
  tv: Object.freeze({ frequency: 15000, end: 9000, duration: .3, gain: .02, type: 'sine' }),
  fridge: Object.freeze({ frequency: 120, end: 90, duration: .25, gain: .04, type: 'triangle' }),
  flush: Object.freeze({ frequency: 900, end: 60, duration: .75, gain: .06, type: 'sawtooth' }),
  meow: Object.freeze({ frequency: 600, end: 980, duration: .32, gain: .04, type: 'triangle' }),
  honk: Object.freeze({ frequency: 392, end: 370, duration: .4, gain: .09, type: 'square' }),
  alarm: Object.freeze({ frequency: 1200, end: 700, duration: .22, gain: .06, type: 'square' }),
  chirp: Object.freeze({ frequency: 2000, end: 2600, duration: .07, gain: .05, type: 'square' }),
  boot: Object.freeze({ frequency: 220, end: 880, duration: .45, gain: .05, type: 'triangle' }),
  boing: Object.freeze({ frequency: 140, end: 420, duration: .2, gain: .05, type: 'sine' }),
  upgrade: Object.freeze({ frequency: 262, end: 1046, duration: .8, gain: .12, type: 'sawtooth' }),
});

export const AMBIENT_RECIPES = Object.freeze({
  combat: Object.freeze({ frequency: 54, harmonic: 108, gain: .009, type: 'sawtooth' }),
  warehouse: Object.freeze({ frequency: 86, harmonic: 172, gain: .012, type: 'triangle' }),
});

export function quietFrom(search = '', hash = '') {
  const raw = `${search}${hash}`;
  let text = raw;
  try { text = decodeURIComponent(raw); } catch { /* Keep malformed input inert. */ }
  return /(^|[?&#])(тихо|tiho|quiet)(=1|=true)?([&#]|$)/i.test(text);
}

export function createAudioBus({ search, hash } = {}) {
  const quiet = quietFrom(
    search ?? globalThis.location?.search ?? '',
    hash ?? globalThis.location?.hash ?? '',
  );
  let context = null;
  let master = null;
  let analyser = null;
  let muted = false;
  let ambientNodes = null;
  let ambientName = null;
  const samples = new Map();

  async function unlock() {
    if (quiet) return false;
    if (!context) {
      const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AudioContextClass) return false;
      context = new AudioContextClass();
      master = context.createGain();
      analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      master.gain.value = muted ? 0 : .62;
      master.connect(analyser);
      analyser.connect(context.destination);
    }
    if (context.state === 'suspended') await context.resume();
    return context.state === 'running';
  }

  async function play(name) {
    const external = EXTERNAL_SOUNDS[name];
    if (external && !quiet && !muted && typeof globalThis.Audio === 'function') {
      try {
        let sample=samples.get(name);
        if(!sample){sample=new globalThis.Audio(external);sample.preload='auto';sample.volume=.22;samples.set(name,sample);}
        sample.currentTime=0;
        const pending=sample.play(); if(pending?.catch) pending.catch(()=>{});
        return true;
      } catch { /* Fall through to synthesized offline-safe tone. */ }
    }
    const recipe = SOUND_RECIPES[name];
    if (!recipe || !(await unlock())) return false;
    const started = context.currentTime;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = recipe.type;
    oscillator.frequency.setValueAtTime(recipe.frequency, started);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, recipe.end), started + recipe.duration);
    envelope.gain.setValueAtTime(.0001, started);
    envelope.gain.exponentialRampToValueAtTime(recipe.gain, started + .012);
    envelope.gain.exponentialRampToValueAtTime(.0001, started + recipe.duration);
    oscillator.connect(envelope);
    envelope.connect(master);
    oscillator.start(started);
    oscillator.stop(started + recipe.duration + .02);
    return true;
  }

  function stopAmbient() {
    if (!ambientNodes || !context) {
      ambientNodes = null;
      ambientName = null;
      return;
    }
    const stoppedAt = context.currentTime + .1;
    ambientNodes.envelope.gain.cancelScheduledValues(context.currentTime);
    ambientNodes.envelope.gain.setValueAtTime(Math.max(.0001, ambientNodes.envelope.gain.value), context.currentTime);
    ambientNodes.envelope.gain.exponentialRampToValueAtTime(.0001, stoppedAt);
    ambientNodes.oscillators.forEach((oscillator) => oscillator.stop(stoppedAt + .02));
    ambientNodes = null;
    ambientName = null;
  }

  async function setAmbient(name) {
    if (!name) {
      stopAmbient();
      return true;
    }
    const recipe = AMBIENT_RECIPES[name];
    if (!recipe || !(await unlock())) return false;
    if (ambientName === name && ambientNodes) return true;
    stopAmbient();
    const started = context.currentTime;
    const envelope = context.createGain();
    envelope.gain.setValueAtTime(.0001, started);
    envelope.gain.exponentialRampToValueAtTime(recipe.gain, started + .35);
    const oscillators = [recipe.frequency, recipe.harmonic].map((frequency, index) => {
      const oscillator = context.createOscillator();
      const layer = context.createGain();
      oscillator.type = recipe.type;
      oscillator.frequency.value = frequency;
      layer.gain.value = index ? .22 : 1;
      oscillator.connect(layer);
      layer.connect(envelope);
      oscillator.start(started);
      return oscillator;
    });
    envelope.connect(master);
    ambientNodes = { envelope, oscillators };
    ambientName = name;
    return true;
  }

  function setMuted(nextMuted) {
    muted = Boolean(nextMuted);
    if (master && context) master.gain.setTargetAtTime(muted ? 0 : .62, context.currentTime, .012);
    return muted;
  }

  function level() {
    if (!analyser || !context || context.state !== 'running') return 0;
    const samples = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(samples);
    const rms = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
    return rms < .00001 ? 0 : rms;
  }

  return {
    unlock,
    play,
    setAmbient,
    setMuted,
    toggle() { return setMuted(!muted); },
    muted() { return muted; },
    level,
    created() { return Boolean(context); },
    ambient() { return ambientName; },
    quiet,
  };
}
