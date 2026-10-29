import { GameLevel } from '../models/game-level';

export const LEVELS: GameLevel[] = [
  {
    id: 1,
    name: 'Tutorial',
    subtitle: 'Find your voice. Wide platforms, small jumps.',
    difficulty: 'Warm up',
    accent: '#c9f559',
    platforms: [
      { x: 0, y: 0, width: 7 }, { x: 8, y: .4, width: 7 }, { x: 16, y: 0, width: 7 },
      { x: 24, y: .8, width: 8 }, { x: 33, y: 0, width: 8 },
    ],
    obstacles: [],
  },
  {
    id: 2,
    name: 'First Steps',
    subtitle: 'Hold a stronger note to clear larger gaps.',
    difficulty: 'Easy',
    accent: '#73e0ff',
    platforms: [
      { x: 0, y: 0, width: 6 }, { x: 8, y: .5, width: 5 }, { x: 15, y: 1.1, width: 5 },
      { x: 23, y: .2, width: 6 }, { x: 32, y: 1, width: 7 },
    ],
    obstacles: [],
  },
  {
    id: 3,
    name: 'Obstacles',
    subtitle: 'Jump with intent. Red blocks send you back.',
    difficulty: 'Medium',
    accent: '#ffd45a',
    platforms: [
      { x: 0, y: 0, width: 6 }, { x: 7.5, y: 0, width: 6 }, { x: 15, y: .7, width: 6 },
      { x: 23, y: 0, width: 6 }, { x: 31, y: 1, width: 7 },
    ],
    obstacles: [{ x: 8.5, height: 1.1, width: .55 }, { x: 24, height: 1.2, width: .65 }],
  },
  {
    id: 4,
    name: 'Precision',
    subtitle: 'Narrow platforms. Keep your volume controlled.',
    difficulty: 'Hard',
    accent: '#ff94d2',
    platforms: [
      { x: 0, y: 0, width: 5 }, { x: 7, y: .7, width: 3.5 }, { x: 12, y: 1.4, width: 3.5 },
      { x: 18, y: .4, width: 3.2 }, { x: 24, y: 1.3, width: 3.5 }, { x: 31, y: .2, width: 6 },
    ],
    obstacles: [{ x: 13.1, height: .9, width: .45 }, { x: 25, height: 1.2, width: .5 }],
  },
  {
    id: 5,
    name: 'Final Challenge',
    subtitle: 'Everything at once. Make every jump count.',
    difficulty: 'Final',
    accent: '#b59cff',
    platforms: [
      { x: 0, y: 0, width: 5.5 }, { x: 7, y: .9, width: 4 }, { x: 13, y: .1, width: 4.3 },
      { x: 20, y: 1.4, width: 3.4 }, { x: 26, y: .4, width: 3.5 }, { x: 33, y: 1, width: 7 },
    ],
    obstacles: [{ x: 8.2, height: 1.1, width: .55 }, { x: 21, height: 1.2, width: .5 }, { x: 34.2, height: 1.4, width: .6 }],
  },
];

export const getLevel = (id: number): GameLevel => LEVELS.find((level) => level.id === id) ?? LEVELS[0];
