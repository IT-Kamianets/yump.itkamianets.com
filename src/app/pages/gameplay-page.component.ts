import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, computed, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { GameEngine, GameEvent } from '../game/game-engine';
import { getLevel } from '../game/levels';
import { GameLevel } from '../models/game-level';
import { VoiceInputService } from '../services/voice-input.service';

@Component({
  selector: 'app-gameplay-page',
  imports: [RouterLink, DecimalPipe],
  template: `
    <main class="game-shell" [style.--stage-accent]="level.accent">
      <!-- 3D Canvas Stage -->
      <div #stage class="stage" aria-label="3D game view"></div>

      <!-- Top Arcade Game HUD -->
      <header class="game-hud-top">
        <a routerLink="/levels" class="hud-btn-back">
          <span class="arrow">←</span>
          <span>STAGES</span>
        </a>

        <div class="stage-pill">
          <span class="stage-tag">STAGE 0{{ level.id }}</span>
          <span class="stage-title">{{ level.name }}</span>
        </div>

        <button class="hud-btn-settings" (click)="openCalibration()" aria-label="Microphone settings">
          <span class="icon">🎙️</span>
          <span>MIC CALIBRATE</span>
        </button>
      </header>

      <!-- Bottom Voice Jump Visualizer Cockpit -->
      <aside class="voice-cockpit" [class.is-jumping]="voicePercent() >= 15">
        <div class="cockpit-top">
          <div class="cockpit-label">
            <span class="mic-dot" [class.active]="voice.state() === 'ready'"></span>
            <span>VOICE VOLUME</span>
          </div>
          <span class="cockpit-val">{{ voicePercent() }}%</span>
        </div>

        <!-- Equalizer Sound Wave Bars -->
        <div class="eq-bars">
          <div class="eq-bar" [style.height.%]="getEqHeight(1)"></div>
          <div class="eq-bar" [style.height.%]="getEqHeight(2)"></div>
          <div class="eq-bar" [style.height.%]="getEqHeight(3)"></div>
          <div class="eq-bar" [style.height.%]="getEqHeight(4)"></div>
          <div class="eq-bar" [style.height.%]="getEqHeight(5)"></div>
          <div class="eq-bar" [style.height.%]="getEqHeight(6)"></div>
          <div class="eq-bar" [style.height.%]="getEqHeight(7)"></div>
          <div class="eq-bar" [style.height.%]="getEqHeight(8)"></div>
        </div>

        <!-- Jump Trigger Meter -->
        <div class="cockpit-meter" aria-label="Voice meter">
          <div class="meter-fill" [style.width.%]="voicePercent()"></div>
          <div class="jump-threshold" title="Jump threshold (15%)"></div>
        </div>

        <p class="cockpit-msg">{{ voiceMessage() }}</p>
      </aside>

      <!-- Tip Bubble -->
      <div class="game-tip-pill">
        <span class="tip-sound-icon">🔊</span>
        <span><b>LOUDER</b> = HIGHER JUMP!</span>
      </div>

      <!-- Calibration Modal -->
      @if (modal() === 'calibration') {
        <div class="overlay-backdrop">
          <section class="arcade-dialog" role="dialog" aria-modal="true" aria-labelledby="cal-title">
            <div class="dialog-mascot-wrap">
              <img src="assets/bunny.png" alt="Yump Bunny" class="dialog-mascot" />
            </div>

            <span class="dialog-eyebrow">VOICE SETUP</span>
            <h1 id="cal-title" class="dialog-title">Tune Your Jump!</h1>

            @if (voice.state() === 'idle' || voice.state() === 'denied' || voice.state() === 'unsupported') {
              <p class="dialog-desc">
                {{ voice.message() || 'We use your microphone only to measure voice loudness. No audio is ever recorded or saved.' }}
              </p>
              <button class="btn-arcade cta-modal" (click)="calibrate()">
                <span>ENABLE MICROPHONE 🎙️</span>
              </button>
            }

            @if (voice.state() === 'requesting') {
              <div class="cal-status-box">
                <span class="spinner">⏳</span>
                <p>Requesting microphone permission from browser…</p>
              </div>
            }

            @if (voice.state() === 'calibrating') {
              <div class="cal-status-box">
                <p class="cal-prompt">🤫 <b>Stay quiet for 2 seconds</b> while we measure room noise!</p>
                <div class="cal-progress-track">
                  <div class="cal-progress-bar" [style.width.%]="voice.calibrationProgress() * 100"></div>
                </div>
                <span class="cal-percent">{{ voice.calibrationProgress() * 100 | number:'1.0-0' }}%</span>
              </div>
            }

            @if (voice.state() === 'ready') {
              <div class="cal-status-box ready-box">
                <p class="ready-text">✅ <b>All Set!</b> Your voice is now the jump button!</p>
                <button class="btn-arcade cta-modal" (click)="startLevel()">
                  <span>START STAGE ➔</span>
                </button>
              </div>
            }

            @if (voice.state() === 'denied' || voice.state() === 'unsupported') {
              <a routerLink="/levels" class="dialog-cancel-link">Back to Stages</a>
            }
          </section>
        </div>
      }

      <!-- Results Victory Modal -->
      @if (modal() === 'results') {
        <div class="overlay-backdrop">
          <section class="arcade-dialog result-dialog" role="dialog" aria-modal="true">
            <div class="dialog-mascot-wrap celebration">
              <img src="assets/bunny.png" alt="Happy Bunny" class="dialog-mascot" />
              <div class="confetti-stars">✨ 🏆 ✨</div>
            </div>

            <span class="dialog-eyebrow victory-tag">STAGE CLEARED!</span>
            <h1 class="dialog-title victory-title">NICE YUMP!</h1>
            <p class="dialog-desc">
              You conquered <b>{{ level.name }}</b> using your voice like a champ!
            </p>

            <div class="result-actions">
              <button class="btn-arcade" (click)="restart()">
                <span>PLAY AGAIN 🔄</span>
              </button>
              <a routerLink="/levels" class="btn-arcade btn-arcade-secondary">
                <span>STAGES MAP ➔</span>
              </a>
            </div>
          </section>
        </div>
      }

      <!-- Gameplay In-Game Toast Notice -->
      @if (notice()) {
        <div class="game-notice-toast">
          <span class="toast-icon">💥</span>
          <span>{{ notice() }}</span>
        </div>
      }
    </main>
  `,
  styleUrl: './gameplay-page.component.scss',
})
export class GameplayPageComponent implements AfterViewInit, OnDestroy {
  @ViewChild('stage') stage?: ElementRef<HTMLElement>;

  readonly level: GameLevel;
  readonly modal = signal<'calibration' | 'results' | null>('calibration');
  readonly notice = signal('');
  readonly voicePercent = computed(() => Math.round(this.voice.tick() * 100));
  readonly voiceMessage = computed(() => {
    if (this.voice.state() !== 'ready') return this.voice.message();
    const pct = this.voicePercent();
    if (pct >= 50) return '🚀 MEGA JUMP POWER!';
    if (pct >= 15) return '🐰 JUMPING!';
    return 'Listening… Speak louder to jump!';
  });

  private engine?: GameEngine;
  private voiceLoop?: number;

  constructor(private readonly route: ActivatedRoute, readonly voice: VoiceInputService) {
    this.level = getLevel(Number(this.route.snapshot.paramMap.get('id')));
  }

  ngAfterViewInit(): void {
    this.engine = new GameEngine(this.stage!.nativeElement, this.level);
  }

  async calibrate(): Promise<void> {
    await this.voice.beginCalibration();
  }

  startLevel(): void {
    if (this.voice.state() !== 'ready' || !this.engine) return;
    this.stopVoiceLoop();
    this.modal.set(null);
    this.engine.reset();
    this.engine.start((event) => this.onGameEvent(event));
    this.startVoiceLoop();
  }

  openCalibration(): void {
    this.modal.set('calibration');
  }

  restart(): void {
    this.stopVoiceLoop();
    this.engine?.dispose();
    this.engine = new GameEngine(this.stage!.nativeElement, this.level);
    this.voice.stop();
    this.voice.state.set('idle');
    this.voice.message.set('');
    this.modal.set('calibration');
  }

  ngOnDestroy(): void {
    this.stopVoiceLoop();
    this.engine?.dispose();
    this.voice.stop();
  }

  getEqHeight(index: number): number {
    const power = this.voice.tick();
    if (power < 0.05) return 8;
    const wave = Math.sin(index * 1.2 + performance.now() * 0.015);
    const multiplier = 0.6 + 0.4 * wave;
    return Math.min(100, Math.max(12, power * 100 * multiplier));
  }

  private startVoiceLoop(): void {
    const loop = (): void => {
      const power = this.voice.tick();
      if (power >= 0.15) {
        this.engine?.jump(power);
      }
      this.voiceLoop = requestAnimationFrame(loop);
    };
    this.voiceLoop = requestAnimationFrame(loop);
  }

  private stopVoiceLoop(): void {
    if (this.voiceLoop !== undefined) {
      cancelAnimationFrame(this.voiceLoop);
      this.voiceLoop = undefined;
    }
  }

  private onGameEvent(event: GameEvent): void {
    if (event === 'won') {
      this.stopVoiceLoop();
      this.modal.set('results');
      return;
    }
    const msg = event === 'hit'
      ? 'Obstacle hit! Try that jump again!'
      : 'Whoops! Keep your voice up to clear the gap!';
    this.notice.set(msg);
    window.setTimeout(() => this.notice.set(''), 1800);
  }
}
