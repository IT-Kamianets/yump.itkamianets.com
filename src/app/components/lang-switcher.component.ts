import { Component, ElementRef, HostListener, inject, signal } from '@angular/core';
import { Language, TranslationService } from '../services/translation.service';

@Component({
  selector: 'app-lang-switcher',
  template: `
    <div class="lang-switcher-wrap">
      <button
        class="lang-flag-btn"
        (click)="toggleDropdown($event)"
        [attr.aria-expanded]="isOpen()"
        [attr.aria-label]="'Change language, current: ' + (i18n.currentLang() === 'uk' ? 'Ukrainian' : 'English')"
      >
        <span class="flag-icon">{{ i18n.currentLang() === 'uk' ? '🇺🇦' : '🇬🇧' }}</span>
      </button>

      @if (isOpen()) {
        <div class="lang-dropdown" role="menu">
          <button
            class="lang-option"
            [class.active]="i18n.currentLang() === 'uk'"
            (click)="selectLang('uk')"
            role="menuitem"
          >
            <span class="flag">🇺🇦</span>
            <span class="label">Українська</span>
            @if (i18n.currentLang() === 'uk') {
              <span class="check">✓</span>
            }
          </button>

          <button
            class="lang-option"
            [class.active]="i18n.currentLang() === 'en'"
            (click)="selectLang('en')"
            role="menuitem"
          >
            <span class="flag">🇬🇧</span>
            <span class="label">English</span>
            @if (i18n.currentLang() === 'en') {
              <span class="check">✓</span>
            }
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .lang-switcher-wrap {
      position: relative;
      display: inline-block;
      z-index: 100;
    }

    .lang-flag-btn {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.12);
      border: 2px solid rgba(255, 255, 255, 0.25);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(10px);
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.35);
      transition: transform 0.18s ease, background 0.18s ease, border-color 0.18s ease;

      &:hover {
        transform: scale(1.08);
        background: rgba(255, 255, 255, 0.22);
        border-color: #a3ff2e;
        box-shadow: 0 0 16px rgba(163, 255, 46, 0.4);
      }

      &:active {
        transform: scale(0.95);
      }

      .flag-icon {
        font-size: 1.45rem;
        line-height: 1;
        display: block;
        filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
      }
    }

    .lang-dropdown {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      min-width: 160px;
      background: linear-gradient(180deg, #1f2754 0%, #13193c 100%);
      border: 2px solid rgba(255, 255, 255, 0.22);
      border-radius: 16px;
      padding: 6px;
      box-shadow: 0 14px 32px rgba(0, 0, 0, 0.65), 0 0 20px rgba(0, 240, 255, 0.15);
      backdrop-filter: blur(14px);
      display: flex;
      flex-direction: column;
      gap: 4px;
      animation: dropPop 0.18s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    @keyframes dropPop {
      0% {
        opacity: 0;
        transform: translateY(-8px) scale(0.92);
      }
      100% {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .lang-option {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      background: transparent;
      border: 0;
      border-radius: 10px;
      color: #ffffff;
      font-family: var(--font-body);
      font-weight: 600;
      font-size: 0.95rem;
      cursor: pointer;
      width: 100%;
      text-align: left;
      transition: background 0.12s ease, color 0.12s ease;

      .flag {
        font-size: 1.3rem;
      }

      .label {
        flex: 1;
      }

      .check {
        color: #a3ff2e;
        font-weight: 800;
      }

      &:hover {
        background: rgba(255, 255, 255, 0.14);
      }

      &.active {
        background: rgba(163, 255, 46, 0.16);
        color: #a3ff2e;
        border: 1px solid rgba(163, 255, 46, 0.35);
      }
    }
  `],
})
export class LangSwitcherComponent {
  readonly i18n = inject(TranslationService);
  private readonly elRef = inject(ElementRef);
  readonly isOpen = signal(false);

  toggleDropdown(event: Event): void {
    event.stopPropagation();
    this.isOpen.update((v) => !v);
  }

  selectLang(lang: Language): void {
    this.i18n.setLanguage(lang);
    this.isOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (!this.elRef.nativeElement.contains(event.target)) {
      this.isOpen.set(false);
    }
  }
}
