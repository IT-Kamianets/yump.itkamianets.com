import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LEVELS } from '../game/levels';
import { TranslationService } from '../services/translation.service';
import { LangSwitcherComponent } from '../components/lang-switcher.component';

@Component({
  selector: 'app-level-select-page',
  imports: [RouterLink, LangSwitcherComponent],
  template: `
    <main class="levels-shell">
      <div class="stars-backdrop" aria-hidden="true"></div>

      <!-- Top Navigation -->
      <header class="levels-header">
        <a routerLink="/" class="btn-back">
          <span class="back-arrow">←</span>
          <span>{{ i18n.t.mainMenu }}</span>
        </a>

        <div class="header-center">
          <span class="eyebrow">{{ i18n.t.worldTour }}</span>
          <h1 class="header-title">{{ i18n.t.chooseYourStage }}</h1>
        </div>

        <div class="header-actions">
          <app-lang-switcher />
          <div class="header-mascot">
            <img src="assets/bunny-icon.png" alt="Bunny Mascot" class="mascot-avatar" />
          </div>
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
                <span class="stage-num-badge">{{ i18n.t.stages }} 0{{ level.id }}</span>
                <span class="stars-badge">
                  @if (level.id === 1) { ⭐ }
                  @if (level.id === 2) { ⭐⭐ }
                  @if (level.id === 3) { ⭐⭐⭐ }
                  @if (level.id === 4) { ⭐⭐⭐⭐ }
                  @if (level.id === 5) { 👑 BOSS }
                </span>
              </div>

              <div class="card-body">
                <h2 class="level-name">{{ getLevelName(level.id) }}</h2>
                <span class="difficulty-tag">{{ getLevelDiff(level.id) }}</span>
                <p class="level-desc">{{ getLevelSubtitle(level.id) }}</p>
              </div>

              <!-- Mini stage info metrics -->
              <div class="stage-stats">
                <div class="stat-pill">
                  <span class="stat-icon">🟩</span>
                  <span>{{ level.platforms.length }} {{ i18n.t.platformsCount }}</span>
                </div>
                <div class="stat-pill">
                  <span class="stat-icon">⚠️</span>
                  <span>{{ level.obstacles.length }} {{ i18n.t.hazardsCount }}</span>
                </div>
              </div>

              <div class="card-footer">
                <span class="play-label">{{ i18n.t.startStage }}</span>
                <span class="play-arrow">➔</span>
              </div>
            </a>
          }
        </div>
      </section>

      <!-- Bottom Audio Tip -->
      <footer class="levels-footer">
        <p>{{ i18n.t.soundCheckTip }}</p>
      </footer>
    </main>
  `,
  styleUrl: './level-select-page.component.scss',
})
export class LevelSelectPageComponent {
  readonly i18n = inject(TranslationService);
  readonly levels = LEVELS;

  getLevelName(id: number): string {
    const t = this.i18n.t;
    switch (id) {
      case 1: return t.level1Name;
      case 2: return t.level2Name;
      case 3: return t.level3Name;
      case 4: return t.level4Name;
      case 5: return t.level5Name;
      default: return this.levels[id - 1]?.name || `Stage ${id}`;
    }
  }

  getLevelSubtitle(id: number): string {
    const t = this.i18n.t;
    switch (id) {
      case 1: return t.level1Subtitle;
      case 2: return t.level2Subtitle;
      case 3: return t.level3Subtitle;
      case 4: return t.level4Subtitle;
      case 5: return t.level5Subtitle;
      default: return this.levels[id - 1]?.subtitle || '';
    }
  }

  getLevelDiff(id: number): string {
    const t = this.i18n.t;
    switch (id) {
      case 1: return t.level1Difficulty;
      case 2: return t.level2Difficulty;
      case 3: return t.level3Difficulty;
      case 4: return t.level4Difficulty;
      case 5: return t.level5Difficulty;
      default: return this.levels[id - 1]?.difficulty || '';
    }
  }
}
