export interface PlatformSpec {
  x: number;
  y: number;
  width: number;
}

export interface ObstacleSpec {
  x: number;
  height: number;
  width: number;
}

export interface GameLevel {
  id: number;
  name: string;
  subtitle: string;
  difficulty: string;
  accent: string;
  platforms: PlatformSpec[];
  obstacles: ObstacleSpec[];
}
