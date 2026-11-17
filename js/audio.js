// Web Audio 即時合成音效
const SFX = (() => {
  let ctx;
  const ac = () => (ctx ||= new (window.AudioContext || window.webkitAudioContext)());
  function tone(freq, dur, type = 'square', vol = 0.15) {
    const c = ac(), o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + dur);
  }
  function noise(dur, filterFreq, vol = 0.3, type = 'bandpass') {
    const c = ac(), len = c.sampleRate * dur, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = buf; f.type = type; f.frequency.value = filterFreq; g.gain.value = vol;
    s.connect(f).connect(g).connect(c.destination); s.start();
  }
  return {
    unlock: () => ac().resume(),
    beep: () => tone(1200, 0.06),
    cash: () => { noise(0.09, 3000, 0.4); setTimeout(() => noise(0.07, 4000, 0.3), 60); },
    thud: () => { tone(70, 0.3, 'sine', 0.6); noise(0.15, 200, 0.6, 'lowpass'); },
    ok: () => { tone(880, 0.1, 'sine', 0.2); setTimeout(() => tone(1320, 0.15, 'sine', 0.2), 90); },
    err: () => tone(160, 0.25, 'sawtooth', 0.15),
    swipe: () => noise(0.2, 1500, 0.25),
  };
})();
