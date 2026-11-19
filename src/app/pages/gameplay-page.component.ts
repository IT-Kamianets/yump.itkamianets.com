import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
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
      <!-- 3D Canvas Stage (Click / Tap to jump fallback) -->
      <div #stage class="stage" aria-label="3D game view" (click)="onStageTap()"></div>

      <!-- Top Arcade Game HUD -->
      <header class="game-hud-top">
        <div class="hud-top-left">
          <a routerLink="/levels" class="hud-btn-back">
            <span class="arrow">←</span>
            <span>{{ i18n.t.stages }}</span>
          </a>

          <div class="stage-pill">
            <span class="stage-tag">{{ i18n.t.stages }} 0{{ level.id }}</span>
            <span class="stage-title">{{ getLevelName(level.id) }}</span>
          </div>
        </div>

        <!-- Center Score & Power-Up Stats -->
        <div class="hud-center-stats">
          <!-- Coins Counter -->
          <div class="hud-stat-pill coin-pill" title="Collected coins">
            <span class="pill-icon">🪙</span>
            <span class="pill-val">{{ currentScore() }}</span>
          </div>

          <!-- Carrot Shield Active Indicator -->
          @if (shieldActive()) {
            <div class="hud-stat-pill shield-pill" title="Carrot Shield active!">
              <span class="pill-icon">🥕</span>
              <span class="pill-tag">{{ i18n.t.shieldActive }}</span>
              <span class="pill-val">{{ shieldSeconds() }}s</span>
            </div>
          }

          <!-- Distance meters -->
          <div class="hud-stat-pill distance-pill" title="Run distance">
            <span class="pill-icon">🏃</span>
            <span class="pill-val">{{ currentDistance() }} / {{ targetDistance() }} {{ i18n.t.distanceMeters }}</span>
          </div>
        </div>

        <div class="hud-top-right">
          <button class="hud-btn-settings" (click)="openCalibration()" aria-label="Microphone settings">
            <span class="icon">🎙️</span>
            <span>{{ i18n.t.micCalibrate }}</span>
          </button>
          <app-lang-switcher />
        </div>
      </header>

      <!-- Tutorial Live Instruction Card Popup -->
      @if (isTutorial() && currentTutorialStep(); as step) {
        <div class="tutorial-live-card">
          <div class="tut-icon-badge">{{ step.icon }}</div>
          <div class="tut-text-body">
            <span class="tut-step-tag">{{ step.stepTag }}</span>
            <h3 class="tut-step-title">{{ step.title }}</h3>
            <p class="tut-step-desc">{{ step.desc }}</p>
          </div>
        </div>
      }

      <!-- Stage Goal Progress Bar (shown on all stages except Tutorial) -->
      @if (!isTutorial()) {
        <div class="stage-progress-card" role="progressbar" [attr.aria-valuenow]="levelProgressPercent()" aria-valuemin="0" aria-valuemax="100">
          <div class="progress-meta">
            <span class="progress-node start-node">
              <span class="node-icon">🚩</span>
              <span class="node-label">0m</span>
            </span>

            <div class="progress-center-badge" [style.--accent]="level.accent">
              <span class="progress-stage-name">{{ getLevelName(level.id) }}</span>
              <span class="progress-pct">{{ levelProgressPercent() }}%</span>
            </div>

            <span class="progress-node goal-node" [class.near-goal]="levelProgressPercent() >= 80">
              <span class="node-icon">🏆</span>
              <span class="node-label">{{ targetDistance() }}{{ i18n.t.distanceMeters }}</span>
            </span>
          </div>

          <div class="progress-track">
            <div
              class="progress-fill"
              [style.width.%]="levelProgressPercent()"
              [style.background]="level.accent"
              [style.box-shadow]="'0 0 16px ' + level.accent"
            ></div>
            <div
              class="progress-runner-pin"
              [style.left.%]="levelProgressPercent()"
              [style.border-color]="level.accent"
              title="You are here!"
            >
              <span class="runner-emoji">🐰</span>
            </div>
          </div>
        </div>
      }

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

      <!-- Tip Bubble (Louder = Higher + tap fallback) -->
      <div class="game-tip-pill" (click)="onStageTap()">
        <span class="tip-sound-icon">🔊</span>
        <span><b>{{ i18n.t.louderHigherTip }}</b></span>
      </div>

      <!-- Calibration Modal -->
      @if (modal() === 'calibration') {
        <div class="overlay-backdrop" role="presentation" (click)="closeModalAndPlay()">
          <section class="arcade-dialog" role="dialog" aria-modal="true" aria-labelledby="cal-title" (click)="$event.stopPropagation()">
            <button class="dialog-close-btn" (click)="closeModalAndPlay()" aria-label="Close dialog">✕</button>

            <div class="dialog-mascot-wrap">
              <img src="assets/bunny.png" alt="Yump Bunny" class="dialog-mascot" />
            </div>

            <span class="dialog-eyebrow">{{ i18n.t.voiceSetup }}</span>
            <h1 id="cal-title" class="dialog-title">{{ i18n.t.tuneYourJump }}</h1>

            @if (voice.state() === 'idle' || voice.state() === 'denied' || voice.state() === 'unsupported') {
              <p class="dialog-desc">
                {{ voice.message() || i18n.t.micPermissionInfo }}
              </p>
              <div class="cal-actions-stack">
                <button class="btn-arcade cta-modal" (click)="calibrate()">
                  <span>{{ i18n.t.enableMic }}</span>
                </button>
                <button class="btn-arcade btn-arcade-secondary cta-modal" (click)="startLevelWithoutMic()">
                  <span>{{ i18n.t.playGame }} (Space / Tap)</span>
                </button>
              </div>
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
                <div class="cal-footer-row">
                  <span class="cal-percent">{{ voice.calibrationProgress() * 100 | number:'1.0-0' }}%</span>
                  <button class="btn-skip-cal" (click)="skipAndPlay()">
                    {{ i18n.t.skipCalibration }}
                  </button>
                </div>
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

            <div class="victory-stats-banner">
              <div class="vic-stat">
                <span class="vic-stat-label">{{ i18n.t.coins }}</span>
                <span class="vic-stat-val">🪙 {{ currentScore() }}</span>
              </div>
              <div class="vic-stat">
                <span class="vic-stat-label">{{ i18n.t.distanceMeters }}</span>
                <span class="vic-stat-val">🏃 {{ currentDistance() }}m</span>
              </div>
            </div>

            <div class="result-actions">
              @if (hasNextLevel()) {
                <button class="btn-arcade btn-arcade-next" (click)="goToNextLevel()">
                  <span>{{ i18n.t.nextStage }}</span>
                </button>
              }
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

      <!-- Defeat Game Over Modal -->
      @if (modal() === 'gameover') {
        <div class="overlay-backdrop">
          <section class="arcade-dialog gameover-dialog" role="dialog" aria-modal="true" aria-labelledby="gameover-title">
            <div class="dialog-mascot-wrap dizzy">
              <img src="assets/bunny.png" alt="Dizzy Bunny" class="dialog-mascot" />
              <div class="dizzy-stars">💥 💫 💥</div>
            </div>

            <span class="dialog-eyebrow failure-tag">{{ i18n.t.stageFailed }}</span>
            <h1 id="gameover-title" class="dialog-title failure-title">{{ i18n.t.tryAgainTitle }}</h1>
            <p class="dialog-desc">
              {{ defeatReason() === 'hit' ? i18n.t.gameOverHitDesc : i18n.t.gameOverFellDesc }}
            </p>

            <div class="gameover-stats-banner">
              <div class="gov-stat">
                <span class="gov-stat-label">{{ i18n.t.distanceCovered }}</span>
                <span class="gov-stat-val">🏃 {{ currentDistance() }} / {{ targetDistance() }}m</span>
              </div>
              <div class="gov-stat">
                <span class="gov-stat-label">{{ i18n.t.coinsCollected }}</span>
                <span class="gov-stat-val">🪙 {{ currentScore() }}</span>
              </div>
            </div>

            <div class="result-actions">
              <button class="btn-arcade btn-arcade-retry" (click)="retryLevel()">
                <span>{{ i18n.t.retryStage }}</span>
              </button>
              <a routerLink="/levels" class="btn-arcade btn-arcade-secondary">
                <span>{{ i18n.t.exitToStages }}</span>
              </a>
            </div>
          </section>
        </div>
      }

      <!-- Arcade Asset Loading Screen Overlay -->
      @if (isLoading()) {
        <div class="game-loading-overlay" [class.fade-out]="loadingProgress() === 100">
          <div class="loading-card">
            <div class="loading-bunny-wrap">
              <img src="assets/bunny.png" alt="YUMP Bunny" class="loading-bunny" />
              <div class="bunny-shadow"></div>
            </div>

            <div class="loading-brand">
              <h2 class="loading-logo">YUMP!</h2>
              <span class="loading-stage-badge">
                {{ i18n.t.stages }} 0{{ level.id }} • {{ getLevelName(level.id) }}
              </span>
            </div>

            <div class="loading-bar-track">
              <div class="loading-bar-fill" [style.width.%]="loadingProgress()">
                <div class="bar-shine"></div>
              </div>
            </div>

            <div class="loading-meta">
              <span class="loading-tip">{{ currentLoadingTip() }}</span>
              <span class="loading-pct">{{ loadingProgress() }}%</span>
            </div>
          </div>
        </div>
      }

      <!-- Gameplay In-Game Toast Notice -->
      @if (notice()) {
        <div class="game-notice-toast" [class.carrot-toast]="isCarrotNotice()">
          <span class="toast-icon">{{ noticeIcon() }}</span>
          <span>{{ notice() }}</span>
        </div>
      }
    </main>
  `,
  styleUrl: './gameplay-page.component.scss',
})
export class GameplayPageComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('stage') stage?: ElementRef<HTMLElement>;

  readonly i18n = inject(TranslationService);
  level: GameLevel;
  readonly isLoading = signal(true);
  readonly loadingProgress = signal(18);
  readonly currentTipIndex = signal(0);
  private loadingTimer?: number;
  private tipTimer?: number;

  readonly modal = signal<'calibration' | 'results' | 'gameover' | null>('calibration');
  readonly defeatReason = signal<'hit' | 'fell'>('hit');
  readonly notice = signal('');
  readonly noticeIcon = signal('💥');
  readonly isCarrotNotice = signal(false);

  readonly currentLoadingTip = computed(() => {
    const t = this.i18n.t;
    const tips = [
      t.loadingTip1,
      t.loadingTip2,
      t.loadingTip3,
      t.loadingTip4,
      t.loadingTip5,
    ];
    return tips[this.currentTipIndex() % tips.length];
  });

  // Dynamic game stats signals
  readonly currentScore = signal(0);
  readonly currentDistance = signal(0);
  readonly shieldActive = signal(false);
  readonly shieldSeconds = signal(0);
  readonly voicePercent = signal(0);

  readonly isTutorial = computed(() => this.level.id === 1);
  readonly targetDistance = computed(() => (this.level.id === 1 ? 90 : this.level.id === 2 ? 120 : 140));
  readonly hasNextLevel = computed(() => this.level.id < 5);
  readonly nextLevelId = computed(() => this.level.id + 1);

  readonly levelProgressPercent = computed(() => {
    const target = this.targetDistance();
    if (!target) return 0;
    return Math.min(100, Math.max(0, Math.round((this.currentDistance() / target) * 100)));
  });

  /** Dynamic tutorial steps shown while running */
  readonly currentTutorialStep = computed(() => {
    if (!this.isTutorial()) return null;
    const d = this.currentDistance();
    const t = this.i18n.t;

    if (d < 15) {
      return {
        icon: '🎙️',
        stepTag: 'КРОК 1 / 6',
        title: t.tutorialStep1Title,
        desc: t.tutorialStep1Desc,
      };
    }
    if (d < 32) {
      return {
        icon: '🪙',
        stepTag: 'КРОК 2 / 6',
        title: t.tutorialStep2Title,
        desc: t.tutorialStep2Desc,
      };
    }
    if (d < 49) {
      return {
        icon: '🚀',
        stepTag: 'КРОК 3 / 6',
        title: t.tutorialStep3Title,
        desc: t.tutorialStep3Desc,
      };
    }
    if (d < 69) {
      return {
        icon: '🥕',
        stepTag: 'КРОК 4 / 6',
        title: t.tutorialStep4Title,
        desc: t.tutorialStep4Desc,
      };
    }
    if (d < 89) {
      return {
        icon: '🛡️',
        stepTag: 'КРОК 5 / 6',
        title: t.tutorialStep5Title,
        desc: t.tutorialStep5Desc,
      };
    }
    return {
      icon: '🏆',
      stepTag: 'ФІНІШ!',
      title: t.tutorialStep6Title,
      desc: t.tutorialStep6Desc,
    };
  });

  readonly voiceMessage = computed(() => {
    if (this.voice.state() !== 'ready') return this.i18n.t.tapOrShout;
    const pct = this.voicePercent();
    if (pct >= 55) return this.i18n.t.megaPower;
    if (pct >= 15) return this.i18n.t.jumping;
    return this.i18n.t.listening;
  });

  private engine?: GameEngine;
  private gameSyncLoop?: number;
  private calCheckTimer?: number;
  private routeSub?: Subscription;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    readonly voice: VoiceInputService,
  ) {
    this.level = getLevel(Number(this.route.snapshot.paramMap.get('id')));
    // If mic is already calibrated and ready (e.g. continuing to level 2), dismiss modal immediately
    if (this.voice.state() === 'ready') {
      this.modal.set(null);
    }
  }

  ngOnInit(): void {
    this.startLoadingSimulation();
    this.routeSub = this.route.paramMap.subscribe((params) => {
      const newId = Number(params.get('id'));
      if (newId && newId !== this.level.id) {
        this.level = getLevel(newId);
        this.initStageForLevel();
      }
    });
  }

  private startLoadingSimulation(): void {
    this.stopLoadingSimulation();
    this.tipTimer = window.setInterval(() => {
      this.currentTipIndex.update((i) => (i + 1) % 5);
    }, 700);

    let prog = 18;
    this.loadingTimer = window.setInterval(() => {
      if (prog < 90) {
        prog += Math.floor(Math.random() * 14 + 10);
        this.loadingProgress.set(Math.min(90, prog));
      }
    }, 160);
  }

  private stopLoadingSimulation(): void {
    if (this.loadingTimer) {
      window.clearInterval(this.loadingTimer);
      this.loadingTimer = undefined;
    }
    if (this.tipTimer) {
      window.clearInterval(this.tipTimer);
      this.tipTimer = undefined;
    }
  }

  onAssetsReady(): void {
    this.loadingProgress.set(100);
    window.setTimeout(() => {
      this.isLoading.set(false);
      this.stopLoadingSimulation();
      if (this.voice.state() === 'ready' && this.modal() === null) {
        this.startLevel();
      }
    }, 380);
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
    this.engine = new GameEngine(this.stage!.nativeElement, this.level, () => this.onAssetsReady());
    // Fallback if loading takes longer than 2.2s
    window.setTimeout(() => {
      if (this.isLoading()) {
        this.onAssetsReady();
      }
    }, 2200);
  }

  goToNextLevel(): void {
    const nextId = this.nextLevelId();
    this.modal.set(null);
    this.router.navigate(['/game', nextId]);
  }

  private initStageForLevel(): void {
    this.isLoading.set(true);
    this.loadingProgress.set(22);
    this.startLoadingSimulation();
    this.stopGameLoop();
    this.engine?.dispose();
    if (this.stage?.nativeElement) {
      this.engine = new GameEngine(this.stage.nativeElement, this.level, () => this.onAssetsReady());
    }
    this.currentScore.set(0);
    this.currentDistance.set(0);
    this.shieldActive.set(false);
    this.shieldSeconds.set(0);
    if (this.voice.state() === 'ready') {
      this.modal.set(null);
    } else {
      this.modal.set('calibration');
    }
    // Fallback if loading takes longer than 2.2s
    window.setTimeout(() => {
      if (this.isLoading()) {
        this.onAssetsReady();
      }
    }, 2200);
  }

  async calibrate(): Promise<void> {
    await this.voice.beginCalibration();
    if (this.calCheckTimer) window.clearInterval(this.calCheckTimer);
    this.calCheckTimer = window.setInterval(() => {
      if (this.voice.state() === 'ready') {
        if (this.calCheckTimer) {
          window.clearInterval(this.calCheckTimer);
          this.calCheckTimer = undefined;
        }
        if (this.modal() === 'calibration') {
          window.setTimeout(() => this.startLevel(), 300);
        }
      }
    }, 80);
  }

  closeModalAndPlay(): void {
    if (this.calCheckTimer) {
      window.clearInterval(this.calCheckTimer);
      this.calCheckTimer = undefined;
    }
    this.modal.set(null);
    if (this.voice.state() !== 'ready') {
      this.voice.skipCalibration();
    }
    this.startLevel();
  }

  skipAndPlay(): void {
    if (this.calCheckTimer) {
      window.clearInterval(this.calCheckTimer);
      this.calCheckTimer = undefined;
    }
    this.modal.set(null);
    this.voice.skipCalibration();
    this.startLevel();
  }

  /** Tap / click jump fallback */
  onStageTap(): void {
    if (this.modal() === null && this.engine) {
      this.engine.jump(0.7);
    }
  }

  startLevelWithoutMic(): void {
    this.modal.set(null);
    this.stopGameLoop();
    if (this.engine) {
      this.engine.reset();
      this.engine.start((event) => this.onGameEvent(event));
    }
    this.startGameLoop();
  }

  startLevel(): void {
    this.modal.set(null);
    if (this.voice.state() !== 'ready') {
      this.voice.skipCalibration();
    }
    this.stopGameLoop();
    if (this.engine) {
      this.engine.reset();
      this.engine.start((event) => this.onGameEvent(event));
    }
    this.startGameLoop();
  }

  openCalibration(): void {
    this.modal.set('calibration');
  }

  retryLevel(): void {
    this.modal.set(null);
    this.stopGameLoop();
    if (this.engine) {
      this.engine.reset();
      this.engine.start((event) => this.onGameEvent(event));
    }
    this.currentScore.set(0);
    this.currentDistance.set(0);
    this.shieldActive.set(false);
    this.shieldSeconds.set(0);
    this.startGameLoop();
  }

  restart(): void {
    this.stopGameLoop();
    this.engine?.dispose();
    this.engine = new GameEngine(this.stage!.nativeElement, this.level, () => this.onAssetsReady());
    this.currentScore.set(0);
    this.currentDistance.set(0);
    this.shieldActive.set(false);
    this.shieldSeconds.set(0);
    this.modal.set('calibration');
  }

  ngOnDestroy(): void {
    this.stopLoadingSimulation();
    this.routeSub?.unsubscribe();
    if (this.calCheckTimer) {
      window.clearInterval(this.calCheckTimer);
      this.calCheckTimer = undefined;
    }
    this.stopGameLoop();
    this.engine?.dispose();
    this.voice.stop();
  }

  getEqHeight(index: number): number {
    const power = this.voicePercent() / 100;
    if (power < 0.05) return 8;
    const wave = Math.sin(index * 1.2 + performance.now() * 0.015);
    const multiplier = 0.6 + 0.4 * wave;
    return Math.min(100, Math.max(12, power * 100 * multiplier));
  }

  private startGameLoop(): void {
    const loop = (): void => {
      // 1. Voice input polling
      if (this.voice.state() === 'ready') {
        const power = this.voice.tick();
        this.voicePercent.set(Math.round(power * 100));
        if (power >= 0.15) {
          this.engine?.jump(power);
        }
      }

      // 2. Sync UI stats from Engine
      if (this.engine) {
        this.currentScore.set(this.engine.score);
        this.currentDistance.set(this.engine.distance);
        this.shieldActive.set(this.engine.shieldActive);
        this.shieldSeconds.set(Math.ceil(this.engine.shieldTimer));
      }

      this.gameSyncLoop = requestAnimationFrame(loop);
    };
    this.gameSyncLoop = requestAnimationFrame(loop);
  }

  private stopGameLoop(): void {
    if (this.gameSyncLoop !== undefined) {
      cancelAnimationFrame(this.gameSyncLoop);
      this.gameSyncLoop = undefined;
    }
  }

  private onGameEvent(event: GameEvent): void {
    if (event === 'won') {
      this.stopGameLoop();
      this.modal.set('results');
      return;
    }

    if (event === 'carrot') {
      this.noticeIcon.set('🥕');
      this.isCarrotNotice.set(true);
      this.notice.set(this.i18n.t.carrotBuffNotice);
      window.setTimeout(() => this.notice.set(''), 2400);
      return;
    }

    if (event === 'shield-break') {
      this.noticeIcon.set('🛡️');
      this.isCarrotNotice.set(false);
      this.notice.set(this.i18n.t.shieldBrokenNotice);
      window.setTimeout(() => this.notice.set(''), 2400);
      return;
    }

    if (event === 'hit' || event === 'fell') {
      this.stopGameLoop();
      this.defeatReason.set(event);
      this.modal.set('gameover');
      return;
    }
  }
}
