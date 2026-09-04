const fs = require('fs');
let content = fs.readFileSync('src/utils/audio.ts', 'utf8');

content = content.replace(
`export function playSaveSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    
    // Note 1: Soft warm bubble pop (F5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(698.46, now);
    osc1.frequency.exponentialRampToValueAtTime(880.00, now + 0.08); // ramps to A5
    gain1.gain.setValueAtTime(0.18, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.12);

    // Note 2: Sweet high spark chime (C6)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1046.50, now + 0.07);
    osc2.frequency.exponentialRampToValueAtTime(1318.51, now + 0.24); // E6
    gain2.gain.setValueAtTime(0.001, now);
    gain2.gain.setValueAtTime(0.22, now + 0.07);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.07);
    osc2.stop(now + 0.28);

    // Note 3: Ultra subtle sparkly top shimmer
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(1760.00, now + 0.12); // A6
    gain3.gain.setValueAtTime(0.001, now);
    gain3.gain.setValueAtTime(0.12, now + 0.12);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    osc3.start(now + 0.12);
    osc3.stop(now + 0.32);
  } catch {
    // Ignore audio errors
  }
}`,
`export function playSaveSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    
    // Bold, satisfying low confirmation sound
    const playTone = (freq, type, delay, dur, vol) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now + delay);
      
      gain.gain.setValueAtTime(0.001, now + delay);
      gain.gain.exponentialRampToValueAtTime(vol, now + delay + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + dur);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + dur);
    };

    // Deep power chord (C3 + G3 + C4)
    playTone(130.81, 'triangle', 0, 0.4, 0.4); 
    playTone(196.00, 'square', 0, 0.4, 0.15); 
    playTone(261.63, 'sawtooth', 0, 0.4, 0.15); 
    
    // Quick resolve note (D4)
    playTone(293.66, 'triangle', 0.15, 0.4, 0.3);
  } catch {
    // Ignore audio errors
  }
}`
);

content = content.replace(
`export function playPromptSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    
    // Soft, soothing bell tone (A4)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(440.00, now);
    
    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.exponentialRampToValueAtTime(0.2, now + 0.05);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.4);
  } catch {
    // Ignore audio errors
  }
}`,
`export function playPromptSound() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    
    // Bold, brave attention tone
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'square'; // Stronger waveform
    osc1.frequency.setValueAtTime(220.00, now); // Lower frequency (A3)
    
    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.exponentialRampToValueAtTime(0.25, now + 0.05);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(329.63, now); // E4 (perfect fifth)
    
    gain2.gain.setValueAtTime(0.001, now);
    gain2.gain.exponentialRampToValueAtTime(0.3, now + 0.05);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    
    osc1.start(now);
    osc1.stop(now + 0.5);
    osc2.start(now);
    osc2.stop(now + 0.5);
  } catch {
    // Ignore audio errors
  }
}`
);

fs.writeFileSync('src/utils/audio.ts', content);
