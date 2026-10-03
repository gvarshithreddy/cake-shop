// ============================================================================
// Cute Procedural Web Audio Sound Engine for "Our Little Cake Shop"
// 100% Procedural synthesis - Zero external audio files required
// ============================================================================

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private windSource: AudioBufferSourceNode | null = null;
  private noiseBuf: AudioBuffer | null = null;

  private isMuted: boolean = false;
  private bgmTimer: any = null;
  private bgmStage: number = 0; // 0: lobby/baking, 1: wish/candles, 2: celebration
  private bgmStep: number = 0;
  private penNoteIdx: number = 0;
  private lastStretchTime: number = 0;

  constructor() {
    // Lazy initialization on first user interaction
    const unlock = () => {
      this.init();
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('click', unlock);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    window.addEventListener('click', unlock);
  }

  public init() {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();

      // Master Gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 1, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // SFX Bus
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      this.sfxGain.connect(this.masterGain);

      // Music Bus
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.setValueAtTime(0.065, this.ctx.currentTime);
      this.musicGain.connect(this.masterGain);

      // Wind Bus for candle blowing
      this.windGain = this.ctx.createGain();
      this.windGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.windGain.connect(this.masterGain);

      this.initNoiseBuffer();
      this.initWindSynth();
      this.startBgm();
    } catch (e) {
      console.warn('AudioContext not available', e);
    }
  }

  private initNoiseBuffer() {
    if (!this.ctx) return;
    const len = this.ctx.sampleRate * 2;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    let lastOut = 0;
    // Generate gentle pink-ish noise
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.02 * white) / 1.02;
      data[i] = lastOut * 3.5;
    }
  }

  private initWindSynth() {
    if (!this.ctx || !this.noiseBuf || !this.windGain) return;
    this.windSource = this.ctx.createBufferSource();
    this.windSource.buffer = this.noiseBuf;
    this.windSource.loop = true;

    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.setValueAtTime(450, this.ctx.currentTime);
    this.windFilter.Q.setValueAtTime(1.5, this.ctx.currentTime);

    this.windSource.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windSource.start();
  }

  public setMute(muted: boolean) {
    this.isMuted = muted;
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.linearRampToValueAtTime(muted ? 0 : 1, now + 0.06);
  }

  public toggleMute(): boolean {
    this.setMute(!this.isMuted);
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  // --------------------------------------------------------------------------
  // Ambient Procedural Music (Lo-Fi Cozy Marimba / Music Box)
  // --------------------------------------------------------------------------
  public setBgmMode(mode: 'baking' | 'wish' | 'celebration') {
    this.bgmStage = mode === 'wish' ? 1 : mode === 'celebration' ? 2 : 0;
  }

  public startBgm() {
    if (this.bgmTimer) return;
    // Notes for cozy progressions
    // Mode 0: Bakery Waltz (C - Em - F - G pentatonic arpeggio)
    const bakingMelody = [
      261.63, 329.63, 392.00, 523.25, 392.00, 329.63, // C
      329.63, 392.00, 493.88, 659.25, 493.88, 392.00, // Em
      349.23, 440.00, 523.25, 698.46, 523.25, 440.00, // F
      392.00, 493.88, 587.33, 783.99, 587.33, 493.88  // G
    ];
    // Mode 1: Dreamy Wish (Higher delicate music box in F Major)
    const wishMelody = [
      523.25, 659.25, 783.99, 1046.50, 783.99,
      587.33, 698.46, 880.00, 1174.66, 880.00,
      659.25, 783.99, 987.77, 1318.51, 987.77,
      523.25, 659.25, 783.99, 1046.50, 659.25
    ];
    // Mode 2: Joyful Celebration (Festive sparkling waltz)
    const partyMelody = [
      523.25, 659.25, 783.99, 1046.50, 1318.51, 1046.50,
      587.33, 698.46, 880.00, 1174.66, 1396.91, 1174.66,
      659.25, 783.99, 987.77, 1318.51, 1567.98, 1318.51,
      783.99, 987.77, 1174.66, 1567.98, 1760.00, 1567.98
    ];

    this.bgmTimer = setInterval(() => {
      if (this.isMuted || !this.ctx || this.ctx.state !== 'running') return;
      const melody = this.bgmStage === 1 ? wishMelody : this.bgmStage === 2 ? partyMelody : bakingMelody;
      const freq = melody[this.bgmStep % melody.length];
      this.bgmStep++;

      // Play soft marimba note
      this.playMarimbaTone(freq, this.bgmStage === 1 ? 0.35 : 0.28, 0.45);

      // Play subtle bass root note on downbeats
      if (this.bgmStep % 6 === 1) {
        const bassFreq = freq / 2;
        this.playSoftBass(bassFreq, 0.2, 0.7);
      }
    }, 280);
  }

  private playMarimbaTone(freq: number, vol = 0.3, dur = 0.4) {
    if (!this.ctx || !this.musicGain) return;
    const now = this.ctx.currentTime;

    // Carrier oscillator: warm triangle
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now);

    // Subtle overtone for sparkle
    const osc2 = this.ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2, now);

    // Warm low-pass filter
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(950, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    const gain2 = this.ctx.createGain();
    gain2.gain.setValueAtTime(vol * 0.25, now);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + dur * 0.6);

    osc.connect(filter);
    osc2.connect(gain2);
    gain2.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    osc.start(now);
    osc2.start(now);
    osc.stop(now + dur);
    osc2.stop(now + dur);
  }

  private playSoftBass(freq: number, vol = 0.2, dur = 0.6) {
    if (!this.ctx || !this.musicGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(now);
    osc.stop(now + dur);
  }

  // --------------------------------------------------------------------------
  // UI & General Sounds
  // --------------------------------------------------------------------------
  // 2. Bubbly UI Click
  public click() {
    if (this.isMuted || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(780, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + 0.038);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.045);
  }

  // 3. Welcoming Doorbell Chime when buddy joins
  public join() {
    if (this.isMuted || !this.ctx || !this.sfxGain) return;
    const notes = [659.25, 830.61, 987.77]; // E5 -> G#5 -> B5
    notes.forEach((f, i) => {
      setTimeout(() => {
        if (!this.ctx || !this.sfxGain) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, now);

        const osc2 = this.ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(f * 2, now);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.35, now + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

        osc.connect(gain);
        osc2.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now);
        osc2.start(now);
        osc.stop(now + 0.46);
        osc2.stop(now + 0.46);
      }, i * 110);
    });
  }

  // --------------------------------------------------------------------------
  // Cake Creation & Body Shaping
  // --------------------------------------------------------------------------
  // 4. Magical Sparkle Flourish + Rising Poof when 2D outline closes
  public shapeComplete() {
    if (this.isMuted || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    // Rising harp arpeggio: C5, E5, G5, C6, E6
    const arpeg = [523.25, 659.25, 783.99, 1046.50, 1318.51];
    arpeg.forEach((f, i) => {
      setTimeout(() => {
        if (!this.ctx || !this.sfxGain) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, t);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.3, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.36);
      }, i * 45);
    });

    // Soft sponge rising "poof"
    const poof = this.ctx.createOscillator();
    poof.type = 'triangle';
    poof.frequency.setValueAtTime(140, now);
    poof.frequency.exponentialRampToValueAtTime(320, now + 0.28);

    const poofGain = this.ctx.createGain();
    poofGain.gain.setValueAtTime(0.001, now);
    poofGain.gain.linearRampToValueAtTime(0.38, now + 0.05);
    poofGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    poof.connect(poofGain);
    poofGain.connect(this.sfxGain);
    poof.start(now);
    poof.stop(now + 0.32);
  }

  // 5. Rubbery dough stretch / squish
  public stretch(velocity = 1) {
    if (this.isMuted || !this.ctx || !this.sfxGain) return;
    const now = performance.now();
    if (now - this.lastStretchTime < 90) return;
    this.lastStretchTime = now;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    const startF = 180 + Math.random() * 40;
    const endF = velocity > 0 ? startF * 1.5 : startF * 0.7;
    osc.frequency.setValueAtTime(startF, t);
    osc.frequency.exponentialRampToValueAtTime(endF, t + 0.08);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.085);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.09);
  }

  // Extra Layer Pop
  public layerPop() {
    if (this.isMuted || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(460, now + 0.07);
    osc.frequency.exponentialRampToValueAtTime(310, now + 0.16);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.19);
  }

  // --------------------------------------------------------------------------
  // Filling, Frosting & Undo
  // --------------------------------------------------------------------------
  // 6. Creamy Piping Bag Squeeze
  public filling() {
    if (this.isMuted || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    // Creamy bubble plop
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(210, now + 0.06);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    // Subtle piping nozzle noise
    if (this.noiseBuf) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(900, now);
      filter.Q.setValueAtTime(2.5, now);

      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.08, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      src.connect(filter);
      filter.connect(nGain);
      nGain.connect(this.sfxGain);
      src.start(now);
      src.stop(now + 0.06);
    }

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.075);
  }

  // Fluffy Spatula Frosting Smear
  public frosting() {
    if (this.isMuted || !this.ctx || !this.sfxGain || !this.noiseBuf) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;

    // Filter sweep mimicking spreading fluffy cream
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400, now);
    filter.frequency.linearRampToValueAtTime(950, now + 0.04);
    filter.frequency.linearRampToValueAtTime(350, now + 0.1);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.16, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    src.start(now);
    src.stop(now + 0.12);
  }

  // Reverse suction bloink for undo
  public undo() {
    if (this.isMuted || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(680, now + 0.08);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.095);
  }

  // --------------------------------------------------------------------------
  // 7. Unique Personality Sounds for Each Topping
  // --------------------------------------------------------------------------
  public topping(e: string) {
    if (this.isMuted || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    switch (e) {
      case '🌸': {
        // Flower: Crystal bloom chime
        [1046.50, 1567.98].forEach((f, i) => {
          const osc = this.ctx!.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(f, now + i * 0.03);
          const g = this.ctx!.createGain();
          g.gain.setValueAtTime(0.22, now + i * 0.03);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
          osc.connect(g);
          g.connect(this.sfxGain!);
          osc.start(now + i * 0.03);
          osc.stop(now + 0.35);
        });
        break;
      }
      case '🍓': {
        // Strawberry: Bouncy berry plop
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(540, now);
        osc.frequency.exponentialRampToValueAtTime(210, now + 0.08);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.35, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
        osc.connect(g);
        g.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.09);
        break;
      }
      case '🍒': {
        // Cherries: Cute double-plop
        [480, 680].forEach((f, i) => {
          setTimeout(() => {
            if (!this.ctx || !this.sfxGain) return;
            const t = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(f, t);
            osc.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.04);
            const g = this.ctx.createGain();
            g.gain.setValueAtTime(0.3, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.045);
            osc.connect(g);
            g.connect(this.sfxGain);
            osc.start(t);
            osc.stop(t + 0.05);
          }, i * 45);
        });
        break;
      }
      case '🫐': {
        // Blueberry: High tiny water droplet
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1400, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.04);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.24, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
        osc.connect(g);
        g.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.05);
        break;
      }
      case '🍫': {
        // Chocolate: Snap click and solid soft thud
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(190, now);
        osc.frequency.exponentialRampToValueAtTime(70, now + 0.09);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.38, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.095);
        osc.connect(g);
        g.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.1);
        break;
      }
      case '💕': {
        // Hearts: Ascending warm harp flutter
        [783.99, 1046.50, 1318.51].forEach((f, i) => {
          setTimeout(() => {
            if (!this.ctx || !this.sfxGain) return;
            const t = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(f, t);
            const g = this.ctx.createGain();
            g.gain.setValueAtTime(0.24, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
            osc.connect(g);
            g.connect(this.sfxGain);
            osc.start(t);
            osc.stop(t + 0.19);
          }, i * 35);
        });
        break;
      }
      case '✨': {
        // Sparkle: Shimmering fairy glockenspiel cluster
        [1760.00, 2093.00, 2637.02, 3135.96].forEach((f, i) => {
          setTimeout(() => {
            if (!this.ctx || !this.sfxGain) return;
            const t = this.ctx.currentTime;
            const osc = this.ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(f, t);
            const g = this.ctx.createGain();
            g.gain.setValueAtTime(0.18, t);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
            osc.connect(g);
            g.connect(this.sfxGain);
            osc.start(t);
            osc.stop(t + 0.23);
          }, i * 25);
        });
        break;
      }
      default: {
        // Ribbon / Fallback: Delicate silk tap
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.08);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.25, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
        osc.connect(g);
        g.connect(this.sfxGain);
        osc.start(now);
        osc.stop(now + 0.09);
        break;
      }
    }
  }

  // --------------------------------------------------------------------------
  // 8. Melodic Writing Frosting Pen
  // --------------------------------------------------------------------------
  public writing() {
    if (this.isMuted || !this.ctx || !this.sfxGain) return;
    const pentatonic = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];
    const freq = pentatonic[this.penNoteIdx % pentatonic.length];
    this.penNoteIdx++;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  // --------------------------------------------------------------------------
  // Candles: Placement, Lighting, Wind, and Blowing Out
  // --------------------------------------------------------------------------
  // 9. Candle Placement Tap
  public candlePlace() {
    if (this.isMuted || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    // Wick tap click
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(620, now);
    osc.frequency.exponentialRampToValueAtTime(280, now + 0.04);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  // 10. Candle Lit: Match strike friction + flame whoosh + warm glowing chord
  public candleLit() {
    if (this.isMuted || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    // Match friction noise
    if (this.noiseBuf) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.setValueAtTime(2400, now);

      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.2, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      src.connect(f);
      f.connect(nGain);
      nGain.connect(this.sfxGain);
      src.start(now);
      src.stop(now + 0.1);
    }

    // Warm glowing chord (F#4, A#4, C#5, F5)
    const chord = [369.99, 466.16, 554.37, 698.46];
    chord.forEach((freq, idx) => {
      setTimeout(() => {
        if (!this.ctx || !this.sfxGain) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, t);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.28, t + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);

        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.75);
      }, idx * 30);
    });
  }

  // 11. Dynamic blowing wind sound tracking pointer shake speed (air: 0.0 to 1.0)
  public setWind(air: number) {
    if (!this.ctx || !this.windGain || !this.windFilter) return;
    const now = this.ctx.currentTime;
    if (this.isMuted || air <= 0.02) {
      this.windGain.gain.setTargetAtTime(0, now, 0.08);
      return;
    }
    const targetVol = Math.min(0.22, air * 0.24);
    const targetFreq = 300 + air * 650;
    this.windGain.gain.setTargetAtTime(targetVol, now, 0.05);
    this.windFilter.frequency.setTargetAtTime(targetFreq, now, 0.05);
  }

  // Candle Extinguished: Soft puff of air + smoke hiss + descending chime
  public candleOut() {
    if (this.isMuted || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    // Soft puff noise
    if (this.noiseBuf) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.setValueAtTime(800, now);
      f.Q.setValueAtTime(1.2, now);

      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.3, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      src.connect(f);
      f.connect(nGain);
      nGain.connect(this.sfxGain);
      src.start(now);
      src.stop(now + 0.2);
    }

    // Descending chime
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(987.77, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.22);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  // --------------------------------------------------------------------------
  // Step Transitions & Finale Fanfare
  // --------------------------------------------------------------------------
  // 12. Joyful Marimba Success Fanfare after completing each step
  public stepSuccess() {
    if (this.isMuted || !this.ctx || !this.sfxGain) return;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((f, i) => {
      setTimeout(() => {
        if (!this.ctx || !this.sfxGain) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, t);

        const osc2 = this.ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(f * 2, t);

        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.001, t);
        g.gain.linearRampToValueAtTime(0.35, t + 0.015);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);

        osc.connect(g);
        osc2.connect(g);
        g.connect(this.sfxGain);
        osc.start(t);
        osc2.start(t);
        osc.stop(t + 0.4);
        osc2.stop(t + 0.4);
      }, i * 75);
    });
  }

  // 13. Grand Music Box Celebration Fanfare when game finishes (Stage 10)
  public gameEnd() {
    if (this.isMuted || !this.ctx || !this.sfxGain) return;
    this.setBgmMode('celebration');

    // Cascade of joyful celebration chimes
    const fanfare = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1567.98];
    fanfare.forEach((f, i) => {
      setTimeout(() => {
        if (!this.ctx || !this.sfxGain) return;
        const t = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, t);

        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.001, t);
        g.gain.linearRampToValueAtTime(0.36, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);

        osc.connect(g);
        g.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.6);
      }, i * 90);
    });
  }

  // Chat notification chime
  public chatChime() {
    if (this.isMuted || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.06);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.095);
  }

  // Soft hand-clap for every cooperative cream click
  public playClap() {
    if (this.isMuted || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    // Two very short filtered noise bursts create a soft, cute clap.
    if (this.noiseBuf) {
      [0, 0.035].forEach((offset, i) => {
        const src = this.ctx!.createBufferSource();
        src.buffer = this.noiseBuf!;
        const filter = this.ctx!.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(i ? 1250 : 980, now + offset);
        filter.Q.setValueAtTime(1.1, now + offset);
        const gain = this.ctx!.createGain();
        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.linearRampToValueAtTime(0.22, now + offset + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.075);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(this.sfxGain!);
        src.start(now + offset);
        src.stop(now + offset + 0.08);
      });
    }

    const thump = this.ctx.createOscillator();
    thump.type = 'triangle';
    thump.frequency.setValueAtTime(170, now);
    thump.frequency.exponentialRampToValueAtTime(85, now + 0.06);
    const tg = this.ctx.createGain();
    tg.gain.setValueAtTime(0.13, now);
    tg.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    thump.connect(tg);
    tg.connect(this.sfxGain);
    thump.start(now);
    thump.stop(now + 0.075);
  }

  // Sparkly burst sound for the final cooperative cream celebration
  public playBurst() {
    if (this.isMuted || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;

    // Bright ascending chime followed by a soft pop.
    [0, 0.045, 0.09].forEach((offset, i) => {
      const osc = this.ctx!.createOscillator();
      osc.type = i === 2 ? 'sine' : 'triangle';
      const start = 520 + i * 180;
      osc.frequency.setValueAtTime(start, now + offset);
      osc.frequency.exponentialRampToValueAtTime(start * 1.45, now + offset + 0.16);
      const gain = this.ctx!.createGain();
      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.16, now + offset + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.22);
      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(now + offset);
      osc.stop(now + offset + 0.24);
    });

    if (this.noiseBuf) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(1800, now);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.12, now + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.sfxGain);
      src.start(now);
      src.stop(now + 0.2);
    }
  }

  // Viscous Cream Ooze sound with squelch and bubbling drop
  public playCreamOoze(progress = 0.5) {
    if (this.isMuted || !this.ctx || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    const startF = 260 + progress * 140;
    const endF = 110 + progress * 60;
    osc.frequency.setValueAtTime(startF, now);
    osc.frequency.exponentialRampToValueAtTime(endF, now + 0.08);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.095);

    if (this.noiseBuf) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(450 + progress * 500, now);

      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.18 + progress * 0.1, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

      src.connect(f);
      f.connect(nGain);
      nGain.connect(this.sfxGain);
      src.start(now);
      src.stop(now + 0.085);
    }
  }

}

export const sound = new SoundEngine();
