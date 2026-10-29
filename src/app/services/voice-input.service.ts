import { Injectable, signal } from '@angular/core';

export type MicrophoneState = 'idle' | 'requesting' | 'calibrating' | 'ready' | 'denied' | 'unsupported';

@Injectable({ providedIn: 'root' })
export class VoiceInputService {
  readonly state = signal<MicrophoneState>('idle');
  readonly volume = signal(0);
  readonly calibrationProgress = signal(0);
  readonly noiseFloor = signal(0.02);
  readonly message = signal('');

  private context?: AudioContext;
  private analyser?: AnalyserNode;
  private stream?: MediaStream;
  private samples: number[] = [];
  private smoothing = 0;
  private lastSampleAt = 0;

  async beginCalibration(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.state.set('unsupported');
      this.message.set('This browser cannot access a microphone.');
      return;
    }

    this.state.set('requesting');
    this.message.set('Requesting microphone access…');
    try {
      this.stop();
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      this.context = new AudioContext();
      const source = this.context.createMediaStreamSource(this.stream);
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = .75;
      source.connect(this.analyser);
      this.samples = [];
      this.smoothing = 0;
      this.calibrationProgress.set(0);
      this.state.set('calibrating');
      this.message.set('Stay quiet for two seconds.');
      const started = performance.now();
      const collect = (now: number) => {
        if (this.state() !== 'calibrating') return;
        const raw = this.readRawVolume();
        this.samples.push(raw);
        this.setSmoothed(raw);
        const progress = Math.min(1, (now - started) / 2000);
        this.calibrationProgress.set(progress);
        if (progress < 1) requestAnimationFrame(collect);
        else this.finishCalibration();
      };
      requestAnimationFrame(collect);
    } catch {
      this.state.set('denied');
      this.message.set('Microphone access was not granted. You can still view the level, but jumps need a microphone.');
    }
  }

  tick(): number {
    if (this.state() !== 'ready') return 0;
    const now = performance.now();
    if (now - this.lastSampleAt > 14) {
      this.lastSampleAt = now;
      this.setSmoothed(this.readRawVolume());
    }
    const voiceReference = this.noiseFloor() + .16;
    return Math.max(0, Math.min(1, (this.smoothing - this.noiseFloor()) / (voiceReference - this.noiseFloor())));
  }

  stop(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = undefined;
    this.analyser = undefined;
    this.context?.close().catch(() => undefined);
    this.context = undefined;
  }

  private finishCalibration(): void {
    const average = this.samples.reduce((total, value) => total + value, 0) / Math.max(1, this.samples.length);
    this.noiseFloor.set(Math.min(.12, Math.max(.008, average + .008)));
    this.state.set('ready');
    this.message.set('Ready. Speak louder to jump higher.');
  }

  private readRawVolume(): number {
    if (!this.analyser) return 0;
    const data = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteTimeDomainData(data);
    const rms = Math.sqrt(data.reduce((sum, sample) => sum + ((sample - 128) / 128) ** 2, 0) / data.length);
    return rms;
  }

  private setSmoothed(raw: number): void {
    this.smoothing = this.smoothing * .82 + raw * .18;
    this.volume.set(this.smoothing);
  }
}
