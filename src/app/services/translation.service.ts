import { Injectable, signal } from '@angular/core';

export type Language = 'en' | 'uk';

export interface Translations {
  // Navigation & Common
  howToPlay: string;
  tutorial: string;
  mainMenu: string;
  stages: string;
  startStage: string;
  playGame: string;
  chooseStage: string;
  bestWithHeadphones: string;
  voicePowered: string;
  webGlAudio: string;

  // Home Page
  gamePill: string;
  makeNoise: string;
  heroTagline: string;
  voicePhysics: string;
  voicePhysicsDesc: string;
  action3D: string;
  action3DDesc: string;
  stagesCount: string;
  stagesCountDesc: string;
  shoutToJump: string;

  // Tutorial Modal
  easyGuide: string;
  howToPlayTitle: string;
  step1Title: string;
  step1Desc: string;
  step2Title: string;
  step2Desc: string;
  step3Title: string;
  step3Desc: string;

  // Levels Page
  worldTour: string;
  chooseYourStage: string;
  platformsCount: string;
  hazardsCount: string;
  soundCheckTip: string;

  // Level Names & Subtitles & Difficulty
  level1Name: string;
  level1Subtitle: string;
  level1Difficulty: string;

  level2Name: string;
  level2Subtitle: string;
  level2Difficulty: string;

  level3Name: string;
  level3Subtitle: string;
  level3Difficulty: string;

  level4Name: string;
  level4Subtitle: string;
  level4Difficulty: string;

  level5Name: string;
  level5Subtitle: string;
  level5Difficulty: string;

  // Gameplay HUD & Modals
  micCalibrate: string;
  voiceVolume: string;
  louderHigherTip: string;
  listening: string;
  jumping: string;
  megaPower: string;
  voiceSetup: string;
  tuneYourJump: string;
  micPermissionInfo: string;
  enableMic: string;
  openingMic: string;
  stayQuiet: string;
  allSetReady: string;
  stageCleared: string;
  niceYump: string;
  conqueredMsg: string;
  playAgain: string;
  stagesMap: string;
  backToStages: string;
  obstacleHitNotice: string;
  fellNotice: string;
}

const EN: Translations = {
  howToPlay: 'How to Play',
  tutorial: 'TUTORIAL',
  mainMenu: 'MAIN MENU',
  stages: 'STAGES',
  startStage: 'START STAGE',
  playGame: 'PLAY GAME',
  chooseStage: 'CHOOSE A STAGE',
  bestWithHeadphones: 'Tip: Headphones recommended for the cleanest microphone jump detection!',
  voicePowered: 'Voice Physics',
  webGlAudio: 'WebGL 3D + Web Audio API',

  gamePill: '3D VOICE-CONTROLLED PLATFORMER',
  makeNoise: 'MAKE NOISE.',
  heroTagline: 'Guide the hyperactive rabbit across tricky skyline platforms! The louder you scream, sing, or whistle into your microphone, the higher your rabbit leaps!',
  voicePhysics: 'Voice Physics',
  voicePhysicsDesc: 'Louder sound = bigger jump',
  action3D: '3D Action',
  action3DDesc: 'Avoid spikes & gaps',
  stagesCount: '5 Fun Stages',
  stagesCountDesc: 'Beat the final challenge',
  shoutToJump: 'SHOUT TO JUMP!',

  easyGuide: 'EASY 3-STEP GUIDE',
  howToPlayTitle: 'How To Play',
  step1Title: 'Allow Microphone 🎙️',
  step1Desc: 'When starting a stage, tap Enable Microphone. The game only measures your voice volume—no audio is ever recorded or saved.',
  step2Title: 'Quiet Calibration 🤫',
  step2Desc: 'Stay quiet for 2 seconds so the game learns your room noise. This ensures background hum won’t trigger accidental hops!',
  step3Title: 'Make Noise & Leap! 🐰💨',
  step3Desc: 'Talk, shout "YUMP!", hum, or sing. A soft sound makes small precise hops; a loud scream clears wide gap jumps and obstacles!',

  worldTour: 'WORLD TOUR',
  chooseYourStage: 'CHOOSE YOUR STAGE',
  platformsCount: 'Platforms',
  hazardsCount: 'Hazards',
  soundCheckTip: '🔊 Sound check: Speak louder to jump higher. You can re-calibrate your mic anytime!',

  level1Name: 'Tutorial',
  level1Subtitle: 'Find your voice. Wide platforms, small jumps.',
  level1Difficulty: 'Warm up',

  level2Name: 'First Steps',
  level2Subtitle: 'Hold a stronger note to clear larger gaps.',
  level2Difficulty: 'Easy',

  level3Name: 'Obstacles',
  level3Subtitle: 'Jump with intent. Red blocks send you back.',
  level3Difficulty: 'Medium',

  level4Name: 'Precision',
  level4Subtitle: 'Narrow platforms. Keep your volume controlled.',
  level4Difficulty: 'Hard',

  level5Name: 'Final Challenge',
  level5Subtitle: 'Everything at once. Make every jump count.',
  level5Difficulty: 'Final',

  micCalibrate: 'MIC CALIBRATE',
  voiceVolume: 'VOICE VOLUME',
  louderHigherTip: 'LOUDER = HIGHER JUMP!',
  listening: 'Listening… Speak louder to jump!',
  jumping: '🐰 JUMPING!',
  megaPower: '🚀 MEGA JUMP POWER!',
  voiceSetup: 'VOICE SETUP',
  tuneYourJump: 'Tune Your Jump!',
  micPermissionInfo: 'We use your microphone only to measure voice loudness. No audio is ever recorded or saved.',
  enableMic: 'ENABLE MICROPHONE 🎙️',
  openingMic: 'Requesting microphone permission from browser…',
  stayQuiet: 'Stay quiet for 2 seconds while we measure room noise!',
  allSetReady: 'All Set! Your voice is now the jump button!',
  stageCleared: 'STAGE CLEARED!',
  niceYump: 'NICE YUMP!',
  conqueredMsg: 'You conquered {level} using your voice like a champ!',
  playAgain: 'PLAY AGAIN 🔄',
  stagesMap: 'STAGES MAP ➔',
  backToStages: 'Back to Stages',
  obstacleHitNotice: 'Obstacle hit! Try that jump again!',
  fellNotice: 'Whoops! Keep your voice up to clear the gap!',
};

const UK: Translations = {
  howToPlay: 'Як грати',
  tutorial: 'ТУТОРІАЛ',
  mainMenu: 'ГОЛОВНЕ МЕНЮ',
  stages: 'РІВНІ',
  startStage: 'ПОЧАТИ РІВЕНЬ',
  playGame: 'ГРАТИ',
  chooseStage: 'ОБРАТИ РІВЕНЬ',
  bestWithHeadphones: 'Порада: Використовуй навушники для найточнішого розпізнавання голосу!',
  voicePowered: 'Голосова фізика',
  webGlAudio: 'WebGL 3D + Web Audio API',

  gamePill: '3D ПЛАТФОРМЕР З ГОЛОСОВИМ КЕРУВАННЯМ',
  makeNoise: 'РОБИ ГАЛАС.',
  heroTagline: 'Керуй невгамовним зайчиком на складних платформах! Що гучніше ти кричиш, співаєш або свистиш у мікрофон, то вище стрибає твій зайчик!',
  voicePhysics: 'Голосова фізика',
  voicePhysicsDesc: 'Гучніший звук = вищий стрибок',
  action3D: '3D Пригода',
  action3DDesc: 'Уникай шипів та прірв',
  stagesCount: '5 Веселих Рівнів',
  stagesCountDesc: 'Подолай фінальний виклик',
  shoutToJump: 'КРИЧИ, ЩОБ СТРИБАТИ!',

  easyGuide: 'ПРОСТА ІНСТРУКЦІЯ У 3 КРОКИ',
  howToPlayTitle: 'Як грати',
  step1Title: 'Дозволь мікрофон 🎙️',
  step1Desc: 'На початку рівня натисни «Увімкнути мікрофон». Гра лише вимірює рівень гучності — жоден звук не записується і не зберігається.',
  step2Title: 'Тихе калібрування 🤫',
  step2Desc: 'Помовчи 2 секунди, щоб гра налаштувалася на тишу твоєї кімнати. Так фоновий шум не викликатиме випадкових стрибків!',
  step3Title: 'Шуми та стрибай! 🐰💨',
  step3Desc: 'Говори, кричи «ЮМП!», мугикай або співай. Тихий звук — малий стрибок, а гучний вигук долає великі прірви та перешкоди!',

  worldTour: 'ТУР РІВНЯМИ',
  chooseYourStage: 'ОБЕРИ СВІЙ РІВЕНЬ',
  platformsCount: 'Платформ',
  hazardsCount: 'Перешкод',
  soundCheckTip: '🔊 Перевірка звуку: Говори гучніше, щоб стрибати вище. Калібрувати мікрофон можна будь-коли!',

  level1Name: 'Навчання',
  level1Subtitle: 'Знайди свій голос. Широкі платформи, маленькі стрибки.',
  level1Difficulty: 'Розминка',

  level2Name: 'Перші кроки',
  level2Subtitle: 'Тримай сильніший звук, щоб долати ширші прогалини.',
  level2Difficulty: 'Легко',

  level3Name: 'Перешкоди',
  level3Subtitle: 'Стрибай упевнено! Червоні блоки відкидають назад.',
  level3Difficulty: 'Середній',

  level4Name: 'Точність',
  level4Subtitle: 'Вузькі платформи. Контролюй гучність свого голосу.',
  level4Difficulty: 'Важко',

  level5Name: 'Фінальний виклик',
  level5Subtitle: 'Усе й одразу. Нехай кожен стрибок буде влучним!',
  level5Difficulty: 'Фінал',

  micCalibrate: 'МІКРОФОН',
  voiceVolume: 'ГУЧНІСТЬ ГОЛОСУ',
  louderHigherTip: 'ГУЧНІШЕ = ВИЩИЙ СТРИБОК!',
  listening: 'Слухаємо… Говори гучніше, щоб стрибнути!',
  jumping: '🐰 СТРИБОК!',
  megaPower: '🚀 МЕГА СТРИБОК!',
  voiceSetup: 'НАЛАШТУВАННЯ ГОЛОСУ',
  tuneYourJump: 'Налаштуй свій стрибок!',
  micPermissionInfo: 'Ми використовуємо мікрофон тільки для вимірювання гучності. Аудіо ніколи не записується і не зберігається.',
  enableMic: 'УВІМКНУТИ МІКРОФОН 🎙️',
  openingMic: 'Запитуємо дозвіл на доступ до мікрофона…',
  stayQuiet: 'Помовчи 2 секунди, поки ми вимірюємо рівень шуму кімнати!',
  allSetReady: 'Усе готово! Твій голос тепер — кнопка стрибка!',
  stageCleared: 'РІВЕНЬ ПРОЙДЕНО!',
  niceYump: 'КРУТИЙ ЮМП!',
  conqueredMsg: 'Ти підкорив рівень {level} силою свого голосу як справжній чемпіон!',
  playAgain: 'ЩЕ РАЗ 🔄',
  stagesMap: 'ДО РІВНІВ ➔',
  backToStages: 'Назад до рівнів',
  obstacleHitNotice: 'Удар об перешкоду! Спробуй стрибок ще раз!',
  fellNotice: 'Ой! Тримай голос голосніше, щоб не впасти!',
};

@Injectable({ providedIn: 'root' })
export class TranslationService {
  private readonly STORAGE_KEY = 'yump_lang';
  readonly currentLang = signal<Language>(this.getInitialLang());

  get t(): Translations {
    return this.currentLang() === 'uk' ? UK : EN;
  }

  setLanguage(lang: Language): void {
    this.currentLang.set(lang);
    try {
      localStorage.setItem(this.STORAGE_KEY, lang);
    } catch {}
  }

  toggleLanguage(): void {
    this.setLanguage(this.currentLang() === 'en' ? 'uk' : 'en');
  }

  private getInitialLang(): Language {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY) as Language;
      if (saved === 'en' || saved === 'uk') return saved;
      const navLang = navigator.language?.toLowerCase() || '';
      if (navLang.startsWith('uk') || navLang.startsWith('ua')) return 'uk';
    } catch {}
    return 'uk'; // Default to Ukrainian
  }
}
