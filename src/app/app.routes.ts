import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/home-page.component').then((m) => m.HomePageComponent),
  },
  {
    path: 'levels',
    loadComponent: () =>
      import('./pages/level-select-page.component').then((m) => m.LevelSelectPageComponent),
  },
  {
    path: 'game/:id',
    loadComponent: () =>
      import('./pages/gameplay-page.component').then((m) => m.GameplayPageComponent),
  },
  { path: '**', redirectTo: '' },
];
