import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { GameEngine, GameEvent } from '../game/game-engine';
import { getLevel } from '../game/levels';
import { GameLevel } from '../models/game-level';
import { VoiceInputService } from '../services/voice-input.service';
import { TranslationService } from '../services/translation.service';
import { LangSwitcherComponent } from '../components/lang-switcher.component';

@Component({
  selector: 'app-gameplay-page',
  imports: [RouterLink, DecimalPipe, LangSwitcherComponent],
  template: `
    <main class="game-shell" [style.--stage-accent]="level.accent">
      <!-- 3D Canvas Stage -->
      <div #stage class="stage" aria-label="3D game view"></div>

      <!-- Top Arcade Game HUD -->
      <header class="game-hud-top">
        <a routerLink="/levels" class="hud-btn-back">
          <span class="arrow">←</span>
          <span>{{ i18n.t.stages }}</span>
        </a>

        <div class="stage-pill">
          <span class="stage-tag">{{ i18n.t.stages }} 0{{ level.id }}</span>
          <span class="stage-title">{{ getLevelName(level.id) }}</span>
        </div>

        <div class="hud-top-right">
          <button class="hud-btn-settings" (click)="openCalibration()" aria-label="Microphone settings">
            <span class="icon">🎙️</span>
            <span>{{ i18n.t.micCalibrate }}</span>
          </button>
          <app-lang-switcher />
        </div>
      </header>

      <!-- Bottom Voice Jump Visualizer Cockpit -->
      <aside class="voice-cockpit" [class.is-jumping]="voicePercent() >= 15">
        <div class="cockpit-top">
          <div class="cockpit-label">
            <span class="mic-dot" [class.active]="voice.state() === 'ready'"></span>
            <span>{{ i18n.t.voiceVolume }}</span>
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
        <span><b>{{ i18n.t.louderHigherTip }}</b></span>
      </div>

      <!-- Calibration Modal -->
      @if (modal() === 'calibration') {
        <div class="overlay-backdrop">
          <section class="arcade-dialog" role="dialog" aria-modal="true" aria-labelledby="cal-title">
            <div class="dialog-mascot-wrap">
              <img src="assets/bunny.png" alt="Yump Bunny" class="dialog-mascot" />
            </div>

            <span class="dialog-eyebrow">{{ i18n.t.voiceSetup }}</span>
            <h1 id="cal-title" class="dialog-title">{{ i18n.t.tuneYourJump }}</h1>

            @if (voice.state() === 'idle' || voice.state() === 'denied' || voice.state() === 'unsupported') {
              <p class="dialog-desc">
                {{ voice.message() || i18n.t.micPermissionInfo }}
              </p>
              <button class="btn-arcade cta-modal" (click)="calibrate()">
                <span>{{ i18n.t.enableMic }}</span>
              </button>
            }

            @if (voice.state() === 'requesting') {
              <div class="cal-status-box">
                <span class="spinner">⏳</span>
                <p>{{ i18n.t.openingMic }}</p>
              </div>
            }

            @if (voice.state() === 'calibrating') {
              <div class="cal-status-box">
                <p class="cal-prompt">🤫 <b>{{ i18n.t.stayQuiet }}</b></p>
                <div class="cal-progress-track">
                  <div class="cal-progress-bar" [style.width.%]="voice.calibrationProgress() * 100"></div>
                </div>
                <span class="cal-percent">{{ voice.calibrationProgress() * 100 | number:'1.0-0' }}%</span>
              </div>
            }

            @if (voice.state() === 'ready') {
              <div class="cal-status-box ready-box">
                <p class="ready-text">✅ <b>{{ i18n.t.allSetReady }}</b></p>
                <button class="btn-arcade cta-modal" (click)="startLevel()">
                  <span>{{ i18n.t.startStage }} ➔</span>
                </button>
              </div>
            }

            @if (voice.state() === 'denied' || voice.state() === 'unsupported') {
              <a routerLink="/levels" class="dialog-cancel-link">{{ i18n.t.backToStages }}</a>
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

            <span class="dialog-eyebrow victory-tag">{{ i18n.t.stageCleared }}</span>
            <h1 class="dialog-title victory-title">{{ i18n.t.niceYump }}</h1>
            <p class="dialog-desc">
              {{ getConqueredText() }}
            </p>

            <div class="result-actions">
              <button class="btn-arcade" (click)="restart()">
                <span>{{ i18n.t.playAgain }}</span>
              </button>
              <a routerLink="/levels" class="btn-arcade btn-arcade-secondary">
                <span>{{ i18n.t.stagesMap }}</span>
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

  readonly i18n = inject(TranslationService);
  readonly level: GameLevel;
  readonly modal = signal<'calibration' | 'results' | null>('calibration');
  readonly notice = signal('');
  readonly voicePercent = computed(() => Math.round(this.voice.tick() * 100));
  readonly voiceMessage = computed(() => {
    if (this.voice.state() !== 'ready') return this.voice.message();
    const pct = this.voicePercent();
    if (pct >= 50) return this.i18n.t.megaPower;
    if (pct >= 15) return this.i18n.t.jumping;
    return this.i18n.t.listening;
  });

  private engine?: GameEngine;
  private voiceLoop?: number;

  constructor(private readonly route: ActivatedRoute, readonly voice: VoiceInputService) {
    this.level = getLevel(Number(this.route.snapshot.paramMap.get('id')));
  }

  getLevelName(id: number): string {
    const t = this.i18n.t;
    switch (id) {
      case 1: return t.level1Name;
      case 2: return t.level2Name;
      case 3: return t.level3Name;
      case 4: return t.level4Name;
      case 5: return t.level5Name;
      default: return this.level.name;
    }
  }

  getConqueredText(): string {
    return this.i18n.t.conqueredMsg.replace('{level}', this.getLevelName(this.level.id));
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
      ? this.i18n.t.obstacleHitNotice
      : this.i18n.t.fellNotice;
    this.notice.set(msg);
    window.setTimeout(() => this.notice.set(''), 1800);
  }
}
