// ==============================================================================
// EFECTO DE SONIDO TERRORÍFICO - RISA MALVADA DE HALLOWEEN (WEB AUDIO API)
// ==============================================================================

let lastPlayTime = 0;

/**
 * Reproduce una risa malvada y siniestra de terror ("MUA-HA-HA-HA-HAAA")
 * sintetizada en tiempo real mediante la Web Audio API nativa sin dependencias externas.
 */
export function playEvilLaugh(): void {
  const now = Date.now();
  // Evitar disparos repetidos inmediatos al mover el mouse continuamente (cooldown de 1.8s)
  if (now - lastPlayTime < 1800) {
    return;
  }
  lastPlayTime = now;

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const t = ctx.currentTime;

    // Control maestro de ganancia
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.35, t);
    master.connect(ctx.destination);

    // Eco siniestro tipo cueva / castillo encantado
    const delay = ctx.createDelay();
    delay.delayTime.setValueAtTime(0.22, t);
    const delayGain = ctx.createGain();
    delayGain.gain.setValueAtTime(0.4, t);
    delay.connect(delayGain);
    delayGain.connect(delay);
    delay.connect(master);

    // Ambiente de ultratumba / trueno grave sordo de fondo
    const thunderOsc = ctx.createOscillator();
    const thunderGain = ctx.createGain();
    const thunderFilter = ctx.createBiquadFilter();
    thunderOsc.type = 'sawtooth';
    thunderOsc.frequency.setValueAtTime(65, t);
    thunderOsc.frequency.exponentialRampToValueAtTime(32, t + 2.5);
    thunderFilter.type = 'lowpass';
    thunderFilter.frequency.setValueAtTime(140, t);
    thunderGain.gain.setValueAtTime(0.01, t);
    thunderGain.gain.linearRampToValueAtTime(0.18, t + 0.3);
    thunderGain.gain.exponentialRampToValueAtTime(0.001, t + 2.8);
    thunderOsc.connect(thunderFilter);
    thunderFilter.connect(thunderGain);
    thunderGain.connect(master);
    thunderOsc.start(t);
    thunderOsc.stop(t + 2.9);

    // Secuencia de carcajadas demoníacas descendentes: "MUA... HA... HA... HA... HA... HAAARRGH"
    const laughNotes = [
      { start: 0.08, dur: 0.24, fStart: 210, fEnd: 155, pitchMod: 1.0 },
      { start: 0.38, dur: 0.22, fStart: 235, fEnd: 170, pitchMod: 1.0 },
      { start: 0.66, dur: 0.22, fStart: 210, fEnd: 150, pitchMod: 1.0 },
      { start: 0.94, dur: 0.24, fStart: 185, fEnd: 130, pitchMod: 1.0 },
      { start: 1.24, dur: 0.28, fStart: 160, fEnd: 110, pitchMod: 1.0 },
      { start: 1.58, dur: 0.32, fStart: 135, fEnd: 90,  pitchMod: 1.0 },
      { start: 1.96, dur: 0.65, fStart: 115, fEnd: 60,  pitchMod: 1.0 },
    ];

    laughNotes.forEach(({ start, dur, fStart, fEnd }) => {
      const startTime = t + start;
      const stopTime = startTime + dur;

      // 1. Oscilador vocal principal rasposo
      const osc1 = ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(fStart, startTime);
      osc1.frequency.exponentialRampToValueAtTime(fEnd, stopTime);

      // 2. Oscilador gutural grave secundario (doble voz monstruosa)
      const osc2 = ctx.createOscillator();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(fStart * 0.5, startTime);
      osc2.frequency.exponentialRampToValueAtTime(fEnd * 0.5, stopTime);

      // 3. Vibrato siniestro rápido (carcajada temblorosa)
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(8.5, startTime);
      lfoGain.gain.setValueAtTime(16, startTime);
      lfo.connect(osc1.frequency);
      lfo.start(startTime);
      lfo.stop(stopTime);

      // 4. Filtro formante vocal (emula cavidad bucal gritando "HA")
      const formant = ctx.createBiquadFilter();
      formant.type = 'bandpass';
      formant.frequency.setValueAtTime(680, startTime);
      formant.Q.setValueAtTime(3.2, startTime);

      // 5. Envolvente de volumen (ataque rápido y decaimiento)
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.42, startTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, stopTime);

      osc1.connect(formant);
      osc2.connect(formant);
      formant.connect(gain);
      gain.connect(master);
      gain.connect(delay); // Reverberación siniestra

      osc1.start(startTime);
      osc1.stop(stopTime + 0.05);
      osc2.start(startTime);
      osc2.stop(stopTime + 0.05);
    });

  } catch (err) {
    console.warn('[HALLOWEEN] Error al reproducir risa malvada:', err);
  }
}

/**
 * Determina si nos encontramos en el mes de octubre (mes 9 en JavaScript 0-indexado)
 */
export function isOctoberMonth(): boolean {
  // Permite anulación manual mediante localStorage si se desea probar en otros meses
  const manualSetting = localStorage.getItem('sm_dental_halloween_theme');
  if (manualSetting === 'true') return true;
  if (manualSetting === 'false') return false;

  const now = new Date();
  return now.getMonth() === 9; // 0 = Enero, ..., 9 = Octubre
}
