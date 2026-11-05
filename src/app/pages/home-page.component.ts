import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslationService } from '../services/translation.service';
import { LangSwitcherComponent } from '../components/lang-switcher.component';

@Component({
  selector: 'app-home-page',
  imports: [RouterLink, LangSwitcherComponent],
  template: `
    <main class="home-shell">
      <!-- Starry ambient particles background -->
      <div class="stars-backdrop" aria-hidden="true"></div>

      <!-- Header Navigation -->
      <header class="top-nav">
        <a routerLink="/" class="logo-badge">
          <img src="assets/bunny-icon.png" alt="YUMP!" class="nav-bunny-icon" />
          <span class="logo-text">YUMP<span class="excl">!</span></span>
        </a>

        <div class="nav-actions">
          <button class="nav-btn" (click)="showHowTo.set(true)" aria-label="Open how to play tutorial">
            <span class="icon">❓</span> {{ i18n.t.howToPlay }}
          </button>
          <app-lang-switcher />
        </div>
      </header>

      <!-- Hero Section -->
      <section class="hero-container">
        <div class="hero-content">
          <div class="game-pill">
            <span class="sparkle">✨</span> {{ i18n.t.gamePill }}
          </div>

          <h1 class="game-title">
            {{ i18n.t.makeNoise }}<br />
            <span class="title-highlight">YUMP!</span>
          </h1>

          <p class="hero-tagline">
            {{ i18n.t.heroTagline }}
          </p>

          <div class="hero-cta-group">
            <a routerLink="/levels" class="btn-arcade cta-play">
              <span>{{ i18n.t.playGame }}</span>
              <span class="btn-arrow">➔</span>
            </a>
            <button class="btn-arcade btn-arcade-secondary cta-guide" (click)="showHowTo.set(true)">
              <span>{{ i18n.t.tutorial }}</span>
            </button>
          </div>

          <!-- Feature Cards Row -->
          <div class="feature-strip">
            <div class="feat-card">
              <span class="feat-icon">🎙️</span>
              <div>
                <strong>{{ i18n.t.voicePhysics }}</strong>
                <p>{{ i18n.t.voicePhysicsDesc }}</p>
              </div>
            </div>
            <div class="feat-card">
              <span class="feat-icon">🐰</span>
              <div>
                <strong>{{ i18n.t.action3D }}</strong>
                <p>{{ i18n.t.action3DDesc }}</p>
              </div>
            </div>
            <div class="feat-card">
              <span class="feat-icon">🏆</span>
              <div>
                <strong>{{ i18n.t.stagesCount }}</strong>
                <p>{{ i18n.t.stagesCountDesc }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Mascot Showcase -->
        <div class="mascot-display">
          <div class="speech-bubble">
            <span class="shout-text">{{ i18n.t.shoutToJump }}</span>
            <div class="sound-bars">
              <span class="bar bar-1"></span>
              <span class="bar bar-2"></span>
              <span class="bar bar-3"></span>
              <span class="bar bar-4"></span>
              <span class="bar bar-5"></span>
            </div>
          </div>

          <div class="bunny-glow-wrap">
            <div class="bunny-radial-glow"></div>
            <img
              src="assets/bunny.png"
              alt="Yump the jumping bunny mascot"
              class="mascot-image"
            />
          </div>
        </div>
      </section>

      <!-- Bottom Audio Hint Strip -->
      <footer class="home-footer">
        <div class="footer-tip">
          <span class="tip-icon">🎧</span>
          <span>{{ i18n.t.bestWithHeadphones }}</span>
        </div>
        <div class="footer-links">
          <span>{{ i18n.t.webGlAudio }}</span>
        </div>
      </footer>
    </main>

    <!-- How to Play Comic Modal -->
    @if (showHowTo()) {
      <div class="modal-backdrop" role="presentation" (click)="showHowTo.set(false)">
        <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="how-title" (click)="$event.stopPropagation()">
          <button class="btn-close" (click)="showHowTo.set(false)" aria-label="Close dialog">✕</button>

          <div class="modal-header">
            <img src="assets/bunny-icon.png" alt="Bunny" class="modal-bunny-pic" />
            <div>
              <span class="modal-subtitle">{{ i18n.t.easyGuide }}</span>
              <h2 id="how-title" class="modal-title">{{ i18n.t.howToPlayTitle }}</h2>
            </div>
          </div>

          <div class="tutorial-steps">
            <div class="step-card">
              <div class="step-num">1</div>
              <div class="step-body">
                <h3>{{ i18n.t.step1Title }}</h3>
                <p>{{ i18n.t.step1Desc }}</p>
              </div>
            </div>

            <div class="step-card">
              <div class="step-num">2</div>
              <div class="step-body">
                <h3>{{ i18n.t.step2Title }}</h3>
                <p>{{ i18n.t.step2Desc }}</p>
              </div>
            </div>

            <div class="step-card">
              <div class="step-num">3</div>
              <div class="step-body">
                <h3>{{ i18n.t.step3Title }}</h3>
                <p>{{ i18n.t.step3Desc }}</p>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <a routerLink="/levels" class="btn-arcade" (click)="showHowTo.set(false)">
              {{ i18n.t.chooseStage }} ➔
            </a>
          </div>
        </section>
      </div>
    }
  `,
  styleUrl: './home-page.component.scss',
})
export class HomePageComponent {
  readonly i18n = inject(TranslationService);
  readonly showHowTo = signal(false);
}
