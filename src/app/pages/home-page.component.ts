import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home-page',
  imports: [RouterLink],
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
            <span class="icon">❓</span> How to Play
          </button>
        </div>
      </header>

      <!-- Hero Section -->
      <section class="hero-container">
        <div class="hero-content">
          <div class="game-pill">
            <span class="sparkle">✨</span> 3D VOICE-CONTROLLED PLATFORMER
          </div>

          <h1 class="game-title">
            MAKE NOISE.<br />
            <span class="title-highlight">YUMP!</span>
          </h1>

          <p class="hero-tagline">
            Guide the hyperactive rabbit across tricky skyline platforms!
            The <b>louder</b> you scream, sing, or whistle into your microphone,
            the <b>higher</b> your rabbit leaps!
          </p>

          <div class="hero-cta-group">
            <a routerLink="/levels" class="btn-arcade cta-play">
              <span>PLAY GAME</span>
              <span class="btn-arrow">➔</span>
            </a>
            <button class="btn-arcade btn-arcade-secondary cta-guide" (click)="showHowTo.set(true)">
              <span>TUTORIAL</span>
            </button>
          </div>

          <!-- Feature Cards Row -->
          <div class="feature-strip">
            <div class="feat-card">
              <span class="feat-icon">🎙️</span>
              <div>
                <strong>Voice Physics</strong>
                <p>Louder sound = bigger jump</p>
              </div>
            </div>
            <div class="feat-card">
              <span class="feat-icon">🐰</span>
              <div>
                <strong>3D Action</strong>
                <p>Avoid spikes & gaps</p>
              </div>
            </div>
            <div class="feat-card">
              <span class="feat-icon">🏆</span>
              <div>
                <strong>5 Fun Stages</strong>
                <p>Beat the final challenge</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Mascot Showcase -->
        <div class="mascot-display">
          <div class="speech-bubble">
            <span class="shout-text">SHOUT TO JUMP!</span>
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
          <span><b>Tip:</b> Headphones recommended for the cleanest microphone jump detection!</span>
        </div>
        <div class="footer-links">
          <span>WebGL 3D + Web Audio API</span>
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
              <span class="modal-subtitle">EASY 3-STEP GUIDE</span>
              <h2 id="how-title" class="modal-title">How To Play</h2>
            </div>
          </div>

          <div class="tutorial-steps">
            <div class="step-card">
              <div class="step-num">1</div>
              <div class="step-body">
                <h3>Allow Microphone 🎙️</h3>
                <p>When starting a stage, tap <b>Enable Microphone</b>. The game only measures your voice volume—no audio is ever recorded or saved.</p>
              </div>
            </div>

            <div class="step-card">
              <div class="step-num">2</div>
              <div class="step-body">
                <h3>Quiet Calibration 🤫</h3>
                <p>Stay quiet for 2 seconds so the game learns your room noise. This ensures background hum won't trigger accidental hops!</p>
              </div>
            </div>

            <div class="step-card">
              <div class="step-num">3</div>
              <div class="step-body">
                <h3>Make Noise & Leap! 🐰💨</h3>
                <p>Talk, shout "YUMP!", hum, or sing. A soft sound makes small precise hops; a loud scream clears wide gap jumps and obstacles!</p>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <a routerLink="/levels" class="btn-arcade" (click)="showHowTo.set(false)">
              CHOOSE A STAGE ➔
            </a>
          </div>
        </section>
      </div>
    }
  `,
  styleUrl: './home-page.component.scss',
})
export class HomePageComponent {
  readonly showHowTo = signal(false);
}
