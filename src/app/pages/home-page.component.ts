import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home-page',
  imports: [RouterLink],
  template: `
    <main class="home-shell">
      <header><a routerLink="/" class="logo">YUMP<span>!</span></a><button (click)="showHowTo.set(true)">How to play</button></header>
      <section class="hero">
        <p class="eyebrow">A voice-controlled 3D platformer</p>
        <h1>MAKE<br>NOISE.<br><i>YUMP!</i></h1>
        <p class="intro">Guide a tiny rabbit across the skyline. The louder you speak, the higher it jumps.</p>
        <a routerLink="/levels" class="play">Play now <span>→</span></a>
      </section>
      <div class="bunny-art" aria-hidden="true"><div class="ear one"></div><div class="ear two"></div><div class="face"><b></b><i></i><i></i></div></div>
      <footer><span>Voice is your controller</span><span>Use headphones for best results</span></footer>
    </main>
    @if (showHowTo()) {
      <div class="modal-backdrop" role="presentation"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="how-title"><button class="close" (click)="showHowTo.set(false)" aria-label="Close">×</button><p class="eyebrow">How to play</p><h2 id="how-title">Your voice is the jump button.</h2><ol><li><b>Allow</b> microphone access.</li><li><b>Calibrate</b> in a quiet spot for two seconds.</li><li><b>Speak or shout</b> to make the rabbit jump — louder means higher.</li></ol><a routerLink="/levels" class="play" (click)="showHowTo.set(false)">Choose a level <span>→</span></a></section></div>
    }
  `,
  styleUrl: './home-page.component.scss',
})
export class HomePageComponent { readonly showHowTo = signal(false); }
