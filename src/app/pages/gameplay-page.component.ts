import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, computed, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { GameEngine, GameEvent } from '../game/game-engine';
import { getLevel } from '../game/levels';
import { VoiceInputService } from '../services/voice-input.service';

@Component({
  selector: 'app-gameplay-page',
  imports: [RouterLink, DecimalPipe],
  template: `
    <main class="game-shell">
      <div #stage class="stage" aria-label="3D game view"></div>
      <header><a routerLink="/levels" class="back">← Levels</a><div class="level-name"><span>0{{ level.id }}</span>{{ level.name }}</div><button (click)="openCalibration()">Mic settings</button></header>
      <aside class="voice-panel"><div class="voice-top"><span>Voice level</span><b>{{ voicePercent() }}%</b></div><div class="meter" aria-label="Voice volume"><div [style.width.%]="voicePercent()"></div></div><p>{{ voiceMessage() }}</p></aside>
      <div class="tip">Speak to jump<br><span>louder = higher</span></div>
      @if (modal() === 'calibration') {<div class="overlay"><section class="dialog" role="dialog" aria-modal="true" aria-labelledby="cal-title"><p class="eyebrow">Microphone calibration</p><h1 id="cal-title">Tune your <i>jump.</i></h1>@if (voice.state() === 'idle' || voice.state() === 'denied' || voice.state() === 'unsupported') {<p>{{ voice.message() || 'We use your microphone only to measure volume. No speech is recorded.' }}</p><button class="primary" (click)="calibrate()">Enable microphone</button>} @if (voice.state() === 'requesting') {<p>Opening microphone permission…</p>} @if (voice.state() === 'calibrating') {<p>Stay quiet — listening to room noise.</p><div class="cal-line"><i [style.width.%]="voice.calibrationProgress() * 100"></i></div><b>{{ voice.calibrationProgress() * 100 | number:'1.0-0' }}%</b>} @if (voice.state() === 'ready') {<p>All set. Your voice is now the jump button.</p><button class="primary" (click)="startLevel()">Start level →</button>} @if (voice.state() === 'denied' || voice.state() === 'unsupported') {<a routerLink="/levels" class="text-link">Back to levels</a>}</section></div>}
      @if (modal() === 'results') {<div class="overlay"><section class="dialog result" role="dialog" aria-modal="true"><p class="eyebrow">Level complete</p><h1>Nice <i>yump!</i></h1><p>You crossed {{ level.name }} using your voice.</p><div class="result-actions"><button class="primary" (click)="restart()">Play again</button><a routerLink="/levels" class="text-link">Choose level</a></div></section></div>}
      @if (notice()) {<div class="notice">{{ notice() }}</div>}
    </main>
  `,
  styleUrl: './gameplay-page.component.scss',
})
export class GameplayPageComponent implements AfterViewInit, OnDestroy {
  @ViewChild('stage') stage?: ElementRef<HTMLElement>;
  readonly level = getLevel(Number(this.route.snapshot.paramMap.get('id')));
  readonly modal = signal<'calibration' | 'results' | null>('calibration');
  readonly notice = signal('');
  readonly voicePercent = computed(() => Math.round(this.voice.tick() * 100));
  readonly voiceMessage = computed(() => this.voice.state() === 'ready' ? 'Ready — use your voice to jump.' : this.voice.message());
  private engine?: GameEngine;
  private voiceLoop?: number;

  constructor(private readonly route: ActivatedRoute, readonly voice: VoiceInputService) {}
  ngAfterViewInit(): void { this.engine = new GameEngine(this.stage!.nativeElement, this.level); }
  async calibrate(): Promise<void> { await this.voice.beginCalibration(); }
  startLevel(): void { if (this.voice.state() !== 'ready' || !this.engine) return; this.modal.set(null); this.engine.reset(); this.engine.start((event) => this.onGameEvent(event)); this.watchVoice(); }
  openCalibration(): void { this.modal.set('calibration'); }
  restart(): void { this.modal.set('calibration'); this.voice.stop(); this.voice.state.set('idle'); this.voice.message.set(''); }
  ngOnDestroy(): void { if (this.voiceLoop) cancelAnimationFrame(this.voiceLoop); this.engine?.dispose(); this.voice.stop(); }
  private watchVoice = (): void => { const power = this.voice.tick(); if (power > .19) this.engine?.jump(power); this.voiceLoop = requestAnimationFrame(this.watchVoice); };
  private onGameEvent(event: GameEvent): void { if (event === 'won') { if (this.voiceLoop) cancelAnimationFrame(this.voiceLoop); this.modal.set('results'); return; } this.notice.set(event === 'hit' ? 'Obstacle! Try that jump again.' : 'Keep your voice up to clear the gap.'); window.setTimeout(() => this.notice.set(''), 1600); }
}
