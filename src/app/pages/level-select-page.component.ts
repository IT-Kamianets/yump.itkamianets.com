import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LEVELS } from '../game/levels';

@Component({
  selector: 'app-level-select-page',
  imports: [RouterLink],
  template: `
    <main class="levels-shell">
      <div class="stars-backdrop" aria-hidden="true"></div>

      <!-- Top Navigation -->
      <header class="levels-header">
        <a routerLink="/" class="btn-back">
          <span class="back-arrow">←</span>
          <span>MAIN MENU</span>
        </a>

        <div class="header-center">
          <span class="eyebrow">WORLD TOUR</span>
          <h1 class="header-title">CHOOSE YOUR STAGE</h1>
        </div>

        <div class="header-mascot">
          <img src="assets/bunny-icon.png" alt="Bunny Mascot" class="mascot-avatar" />
        </div>
      </header>

      <!-- Stages Grid -->
      <section class="stages-container">
        <div class="levels-grid">
          @for (level of levels; track level.id) {
            <a
              class="level-card"
              [routerLink]="['/game', level.id]"
              [style.--accent]="level.accent"
            >
              <div class="card-glow" aria-hidden="true"></div>

              <div class="card-top">
                <span class="stage-num-badge">STAGE {{ level.id }}</span>
                <span class="stars-badge">
                  @if (level.id === 1) { ⭐ }
                  @if (level.id === 2) { ⭐⭐ }
                  @if (level.id === 3) { ⭐⭐⭐ }
                  @if (level.id === 4) { ⭐⭐⭐⭐ }
                  @if (level.id === 5) { 👑 BOSS }
                </span>
              </div>

              <div class="card-body">
                <h2 class="level-name">{{ level.name }}</h2>
                <span class="difficulty-tag">{{ level.difficulty }}</span>
                <p class="level-desc">{{ level.subtitle }}</p>
              </div>

              <!-- Mini stage info metrics -->
              <div class="stage-stats">
                <div class="stat-pill">
                  <span class="stat-icon">🟩</span>
                  <span>{{ level.platforms.length }} Platforms</span>
                </div>
                <div class="stat-pill">
                  <span class="stat-icon">⚠️</span>
                  <span>{{ level.obstacles.length }} Hazards</span>
                </div>
              </div>

              <div class="card-footer">
                <span class="play-label">START STAGE</span>
                <span class="play-arrow">➔</span>
              </div>
            </a>
          }
        </div>
      </section>

      <!-- Bottom Audio Tip -->
      <footer class="levels-footer">
        <p>🔊 Sound check: Speak louder to jump higher. You can re-calibrate your mic anytime!</p>
      </footer>
    </main>
  `,
  styleUrl: './level-select-page.component.scss',
})
export class LevelSelectPageComponent {
  readonly levels = LEVELS;
}
