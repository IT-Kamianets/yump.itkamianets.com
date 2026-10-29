import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LEVELS } from '../game/levels';

@Component({
  selector: 'app-level-select-page',
  imports: [RouterLink],
  template: `<main class="levels-shell"><header><a routerLink="/" class="logo">YUMP<span>!</span></a><a routerLink="/" class="back">← Home</a></header><section><p class="eyebrow">Choose your jump</p><h1>Levels</h1><div class="levels-grid">@for (level of levels; track level.id) {<a class="level" [routerLink]="['/game', level.id]" [style.--accent]="level.accent"><span class="number">0{{ level.id }}</span><span class="difficulty">{{ level.difficulty }}</span><h2>{{ level.name }}</h2><p>{{ level.subtitle }}</p><b>Play →</b></a>}</div></section></main>`,
  styleUrl: './level-select-page.component.scss',
})
export class LevelSelectPageComponent { readonly levels = LEVELS; }
