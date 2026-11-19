import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GameLevel } from '../models/game-level';
import { AudioManager } from './audio-manager';

export type GameEvent = 'won' | 'fell' | 'hit' | 'coin' | 'carrot' | 'shield-break' | 'shield-expire';

interface Particle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
  active: boolean;
}

interface PlatformBlock {
  group: THREE.Group;
  baseMesh: THREE.Mesh;
  topPlate: THREE.Mesh;
  x: number;
  y: number;
  width: number;
  hazard?: HazardBlock;
  coins: CoinItem[];
  carrot?: CarrotItem;
}

interface HazardBlock {
  mesh: THREE.Mesh;
  x: number;
  y: number;
  width: number;
  height: number;
  isMoving: boolean;
  moveSpeed: number;
  moveRange: number;
  initialY: number;
}

interface CoinItem {
  mesh: THREE.Mesh;
  x: number;
  y: number;
  baseY: number;
  phase: number;
  active: boolean;
}

interface CarrotItem {
  group: THREE.Group;
  x: number;
  y: number;
  baseY: number;
  phase: number;
  active: boolean;
}

export interface LevelThemeConfig {
  skyGradient: [string, string, string];
  clearColor: string;
  fogColor: string;
  fogNear: number;
  fogFar: number;
  ambientColor: string;
  ambientIntensity: number;
  hemiSkyColor: string;
  hemiGroundColor: string;
  hemiIntensity: number;
  dirLightColor: string;
  dirLightIntensity: number;
  earthColor: string;
  earthStrataColor: string;
  grassColor: string;
  grassEmissive: string;
  grassTrimColor: string;
  hasFlowers: boolean;
  celestialType: 'sun' | 'moon' | 'sunset' | 'planet' | 'aurora-moon';
  celestialColor: string;
  celestialEmissive: string;
  celestialSize: number;
  celestialY: number;
  hasRings?: boolean;
  mountainsFarColor: string;
  mountainsNearColor: string;
  mountainsPeakStyle: 'rolling' | 'cyber' | 'canyon' | 'crystal' | 'alpine';
  hasClouds: boolean;
  hasStars: boolean;
  hasAurora: boolean;
}

export class GameEngine {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(46, 1, 0.1, 120);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly dirLight = new THREE.DirectionalLight('#fff5e0', 2.8);
  private readonly ambientLight = new THREE.AmbientLight('#ffffff', 0.9);
  private readonly hemisphereLight = new THREE.HemisphereLight('#c4e2ff', '#141838', 1.8);

  private readonly bunny = new THREE.Group();
  private readonly modelWrapper = new THREE.Group();
  private fallbackBunny?: THREE.Group;
  private mixer?: THREE.AnimationMixer;

  // Audio effects
  private readonly audio = new AudioManager();

  // Shield Visuals
  private shieldMesh!: THREE.Mesh;
  private shieldGlowMesh!: THREE.Mesh;

  // Particle pool
  private readonly particles: Particle[] = [];

  // Platforms and items pool
  private readonly platformBlocks: PlatformBlock[] = [];
  private rightmostX = 0;

  // Physics & Movement
  private velocityY = 0;
  private readonly runSpeed = 3.6;
  private grounded = true;
  private jumpCooldown = 0;
  private running = false;
  private animationFrame?: number;
  private lastTimestamp = 0;
  private onEvent?: (event: GameEvent) => void;

  // Game state
  public score = 0;
  public distance = 0;
  public shieldActive = false;
  public shieldTimer = 0;
  private invulnerableTimer = 0;
  private squashTime = 0;

  // Materials & Geometries cache
  public readonly theme: LevelThemeConfig;
  private backdropMesh?: THREE.Mesh;
  private celestialMesh?: THREE.Mesh;
  private farMountainGroup = new THREE.Group();
  private nearMountainGroup = new THREE.Group();
  private clouds: THREE.Group[] = [];
  private starsMesh?: THREE.Points;
  private auroraMesh?: THREE.Mesh;
  private skyTexture?: THREE.CanvasTexture;
  private goalTrophy?: THREE.Group;
  private checkeredTex?: THREE.CanvasTexture;
  private bannerTex?: THREE.CanvasTexture;
  private coinGeometry = new THREE.CylinderGeometry(0.32, 0.32, 0.08, 16);
  private coinMaterial = new THREE.MeshStandardMaterial({
    color: '#ffd214',
    emissive: '#ff9900',
    emissiveIntensity: 0.5,
    roughness: 0.25,
    metalness: 0.85,
  });

  private hazardMaterial = new THREE.MeshStandardMaterial({
    color: '#ff2a6d',
    emissive: '#aa0033',
    emissiveIntensity: 0.45,
    roughness: 0.3,
  });

  private particleGeo = new THREE.SphereGeometry(0.08, 8, 8);

  // Level goal distance
  public get targetDistance(): number {
    if (this.level.id === 1) return 90;
    if (this.level.id === 2) return 120;
    return 140;
  }

  constructor(
    private readonly host: HTMLElement,
    private readonly level: GameLevel,
    private readonly onReady?: () => void,
  ) {
    this.theme = this.getLevelTheme(level.id);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(this.theme.clearColor);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.position = 'absolute';
    this.renderer.domElement.style.inset = '0';
    host.appendChild(this.renderer.domElement);

    this.buildScene();
    this.initParticles();
    this.loadBunnyModel();
    this.resize();
    this.renderer.render(this.scene, this.camera);
    window.addEventListener('resize', this.resize);
    window.addEventListener('keydown', this.handleKeyDown);
  }

  /** Handle space bar or up arrow jump as keyboard fallback */
  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      this.jump(0.65);
    }
  };

  /** Start the game loop */
  start(onEvent: (event: GameEvent) => void): void {
    if (this.running) return;
    this.onEvent = onEvent;
    this.running = true;
    this.lastTimestamp = performance.now();
    this.animate();
  }

  /**
   * Trigger a jump from voice input.
   * @param voiceForce Normalised voice amplitude [0, 1].
   * Louder scream = exponentially higher jump!
   */
  jump(voiceForce: number): void {
    if (!this.grounded || this.jumpCooldown > 0) return;

    // Formula: min jump (7.0 u/s) to mega leap (15.8 u/s) based on loudness
    const clampedForce = Math.max(0, Math.min(1, voiceForce));
    this.velocityY = 7.0 + Math.pow(clampedForce, 0.85) * 8.8;
    this.grounded = false;
    this.jumpCooldown = 0.22;

    // Procedural stretch when launching into air
    this.modelWrapper.scale.set(0.8, 1.25, 0.8);

    // Audio chirp
    this.audio.playJump();
  }

  /** Rebuild all platforms from scratch and safely reposition the bunny on the starter platform */
  public restartLevel(): void {
    this.rebuildAllPlatforms();
    this.placeBunnyAtStart();
    this.distance = 0;
    this.velocityY = 0;
    this.grounded = true;
    this.jumpCooldown = 0.4;
    this.invulnerableTimer = 0.6;
    this.shieldActive = false;
    this.shieldTimer = 0;
    if (this.shieldMesh) this.shieldMesh.visible = false;
    if (this.shieldGlowMesh) this.shieldGlowMesh.visible = false;
  }

  /** Reposition everything at the beginning and clear state */
  reset(): void {
    this.running = false;
    this.score = 0;
    this.restartLevel();
  }

  dispose(): void {
    this.running = false;
    if (this.animationFrame !== undefined) cancelAnimationFrame(this.animationFrame);
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('keydown', this.handleKeyDown);
    this.audio.dispose();
    this.skyTexture?.dispose();
    this.checkeredTex?.dispose();
    this.bannerTex?.dispose();
    this.renderer.dispose();
    this.host.replaceChildren();
  }

  private getLevelTheme(id: number): LevelThemeConfig {
    switch (id) {
      case 1:
        // Level 1 (Tutorial): Sunny Cartoon Morning Meadow
        return {
          skyGradient: ['#2980b9', '#6dd5fa', '#d8f4ff'],
          clearColor: '#6dd5fa',
          fogColor: '#bbf0ff',
          fogNear: 36,
          fogFar: 95,
          ambientColor: '#ffffff',
          ambientIntensity: 1.25,
          hemiSkyColor: '#cdeeff',
          hemiGroundColor: '#553311',
          hemiIntensity: 1.4,
          dirLightColor: '#fffdf0',
          dirLightIntensity: 2.8,
          earthColor: '#5a3d28',
          earthStrataColor: '#3e2817',
          grassColor: '#44bd32',
          grassEmissive: '#1b5e20',
          grassTrimColor: '#3bb129',
          hasFlowers: true,
          celestialType: 'sun',
          celestialColor: '#fff6b7',
          celestialEmissive: '#ffd214',
          celestialSize: 5.5,
          celestialY: 17,
          mountainsFarColor: '#529ab8',
          mountainsNearColor: '#42784d',
          mountainsPeakStyle: 'rolling',
          hasClouds: true,
          hasStars: false,
          hasAurora: false,
        };
      case 2:
        // Level 2: Cyber Twilight Oasis
        return {
          skyGradient: ['#040716', '#09163a', '#0a3556'],
          clearColor: '#060b1e',
          fogColor: '#0c1938',
          fogNear: 30,
          fogFar: 82,
          ambientColor: '#7fe3ff',
          ambientIntensity: 0.9,
          hemiSkyColor: '#00e5ff',
          hemiGroundColor: '#0b1024',
          hemiIntensity: 1.6,
          dirLightColor: '#a6f0ff',
          dirLightIntensity: 2.2,
          earthColor: '#1e2638',
          earthStrataColor: '#131926',
          grassColor: '#00d29d',
          grassEmissive: '#00f0ff',
          grassTrimColor: '#00b894',
          hasFlowers: false,
          celestialType: 'moon',
          celestialColor: '#9be8ff',
          celestialEmissive: '#00d5ff',
          celestialSize: 4.8,
          celestialY: 16,
          mountainsFarColor: '#0c1a3b',
          mountainsNearColor: '#092849',
          mountainsPeakStyle: 'cyber',
          hasClouds: false,
          hasStars: true,
          hasAurora: false,
        };
      case 3:
        // Level 3: Sunset Canyon
        return {
          skyGradient: ['#1f0624', '#781534', '#e2583e'],
          clearColor: '#240a1b',
          fogColor: '#361122',
          fogNear: 32,
          fogFar: 85,
          ambientColor: '#ffd0b0',
          ambientIntensity: 1.1,
          hemiSkyColor: '#ff9f43',
          hemiGroundColor: '#3a1410',
          hemiIntensity: 1.5,
          dirLightColor: '#ffeedd',
          dirLightIntensity: 2.6,
          earthColor: '#683424',
          earthStrataColor: '#481f14',
          grassColor: '#e5a93b',
          grassEmissive: '#ff9f1a',
          grassTrimColor: '#cc8a22',
          hasFlowers: false,
          celestialType: 'sunset',
          celestialColor: '#ffb347',
          celestialEmissive: '#ff3838',
          celestialSize: 7.0,
          celestialY: 11,
          mountainsFarColor: '#521c27',
          mountainsNearColor: '#6b241c',
          mountainsPeakStyle: 'canyon',
          hasClouds: true,
          hasStars: false,
          hasAurora: false,
        };
      case 4:
        // Level 4: Cosmic Violet Nebula
        return {
          skyGradient: ['#070212', '#1c0733', '#481566'],
          clearColor: '#0a0319',
          fogColor: '#140828',
          fogNear: 28,
          fogFar: 78,
          ambientColor: '#dfb0ff',
          ambientIntensity: 0.95,
          hemiSkyColor: '#be2edd',
          hemiGroundColor: '#150824',
          hemiIntensity: 1.7,
          dirLightColor: '#f3d9fa',
          dirLightIntensity: 2.3,
          earthColor: '#221634',
          earthStrataColor: '#150d22',
          grassColor: '#a855f7',
          grassEmissive: '#c084fc',
          grassTrimColor: '#9333ea',
          hasFlowers: false,
          celestialType: 'planet',
          celestialColor: '#e0aaff',
          celestialEmissive: '#9d4edd',
          celestialSize: 5.2,
          celestialY: 15,
          hasRings: true,
          mountainsFarColor: '#210b38',
          mountainsNearColor: '#341154',
          mountainsPeakStyle: 'crystal',
          hasClouds: false,
          hasStars: true,
          hasAurora: false,
        };
      case 5:
      default:
        // Level 5: Emerald Aurora Peaks
        return {
          skyGradient: ['#02050e', '#051426', '#092536'],
          clearColor: '#040a16',
          fogColor: '#071526',
          fogNear: 32,
          fogFar: 82,
          ambientColor: '#a8ffea',
          ambientIntensity: 1.1,
          hemiSkyColor: '#00f5d4',
          hemiGroundColor: '#08161c',
          hemiIntensity: 1.8,
          dirLightColor: '#e6fff9',
          dirLightIntensity: 2.6,
          earthColor: '#1b2531',
          earthStrataColor: '#101821',
          grassColor: '#10b981',
          grassEmissive: '#34d399',
          grassTrimColor: '#059669',
          hasFlowers: false,
          celestialType: 'aurora-moon',
          celestialColor: '#e6ffff',
          celestialEmissive: '#70e000',
          celestialSize: 4.6,
          celestialY: 16,
          mountainsFarColor: '#0a1e2f',
          mountainsNearColor: '#0f2d42',
          mountainsPeakStyle: 'alpine',
          hasClouds: false,
          hasStars: true,
          hasAurora: true,
        };
    }
  }

  // ---------------------------------------------------------------------------
  // Scene Construction
  // ---------------------------------------------------------------------------

  private buildScene(): void {
    // 1. Dynamic Fog from theme
    this.scene.fog = new THREE.Fog(this.theme.fogColor, this.theme.fogNear, this.theme.fogFar);

    // 2. Camera initial framing - comfortably framing the bunny and platforms
    this.camera.position.set(4, 2.9, 10.4);
    this.camera.lookAt(3.0, 1.4, 0);

    // 3. Dynamic Lighting from theme
    this.ambientLight.color.set(this.theme.ambientColor);
    this.ambientLight.intensity = this.theme.ambientIntensity;
    this.scene.add(this.ambientLight);

    this.hemisphereLight.color.set(this.theme.hemiSkyColor);
    this.hemisphereLight.groundColor.set(this.theme.hemiGroundColor);
    this.hemisphereLight.intensity = this.theme.hemiIntensity;
    this.scene.add(this.hemisphereLight);

    this.dirLight.color.set(this.theme.dirLightColor);
    this.dirLight.intensity = this.theme.dirLightIntensity;
    this.dirLight.position.set(5, 12, 9);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.set(1024, 1024);
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 40;
    this.dirLight.shadow.camera.left = -15;
    this.dirLight.shadow.camera.right = 15;
    this.dirLight.shadow.camera.top = 15;
    this.dirLight.shadow.camera.bottom = -10;
    this.scene.add(this.dirLight);

    // 4. Custom Atmospheric 3D Backdrop for each level
    this.buildBackground();

    // 5. Build Shield meshes
    this.buildShieldVisuals();

    // 6. Setup Bunny container
    this.bunny.add(this.modelWrapper);
    this.buildFallbackBunny();
    this.scene.add(this.bunny);

    // 7. Initial platform generation
    this.rebuildAllPlatforms();
    this.placeBunnyAtStart();
  }

  /** Build rich, level-specific animated 3D sky, celestial body, mountains, and ambiance */
  private buildBackground(): void {
    const theme = this.theme;

    // 1. Sky Backdrop Plane with Canvas Gradient
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, theme.skyGradient[0]);
    grad.addColorStop(0.55, theme.skyGradient[1]);
    grad.addColorStop(1, theme.skyGradient[2]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 256);

    this.skyTexture = new THREE.CanvasTexture(canvas);
    const skyGeo = new THREE.PlaneGeometry(360, 110);
    const skyMat = new THREE.MeshBasicMaterial({
      map: this.skyTexture,
      depthWrite: false,
    });
    this.backdropMesh = new THREE.Mesh(skyGeo, skyMat);
    this.backdropMesh.position.set(4, 22, -38);
    this.scene.add(this.backdropMesh);

    // 2. Celestial Orb (Sun / Moon / Sunset / Gas Giant)
    const celGeo = new THREE.SphereGeometry(theme.celestialSize, 24, 20);
    const celMat = new THREE.MeshBasicMaterial({
      color: theme.celestialColor,
    });
    this.celestialMesh = new THREE.Mesh(celGeo, celMat);
    this.celestialMesh.position.set(10, theme.celestialY, -33);
    this.scene.add(this.celestialMesh);

    // Sun / Moon Glow Corona or Planetary Rings
    if (theme.celestialType === 'sun' || theme.celestialType === 'sunset') {
      const haloGeo = new THREE.RingGeometry(theme.celestialSize * 1.05, theme.celestialSize * 1.45, 32);
      const haloMat = new THREE.MeshBasicMaterial({
        color: theme.celestialEmissive,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
      });
      const halo = new THREE.Mesh(haloGeo, haloMat);
      halo.position.set(10, theme.celestialY, -33.1);
      this.scene.add(halo);
    } else if (theme.hasRings) {
      const ringGeo = new THREE.RingGeometry(theme.celestialSize * 1.25, theme.celestialSize * 2.05, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: theme.celestialEmissive,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI * 0.35;
      ring.rotation.y = Math.PI * 0.1;
      ring.position.set(10, theme.celestialY, -33);
      this.scene.add(ring);
    }

    // 3. Parallax Mountains & Hills
    this.buildMountains();

    // 4. Floating Clouds (Level 1 & 3)
    if (theme.hasClouds) {
      this.buildClouds();
    }

    // 5. Starfield Particles (Level 2, 4, 5)
    if (theme.hasStars) {
      this.buildStars();
    }

    // 6. Aurora Borealis Ribbon (Level 5)
    if (theme.hasAurora) {
      this.buildAurora();
    }
  }

  private buildMountains(): void {
    const theme = this.theme;

    // Far mountain ridge (z = -28)
    this.farMountainGroup = new THREE.Group();
    const farMat = new THREE.MeshStandardMaterial({
      color: theme.mountainsFarColor,
      roughness: 0.95,
      metalness: 0.05,
    });
    for (let x = -50; x <= 220; x += 14) {
      const peakH = 15 + Math.sin(x * 0.12) * 4;
      const peakGeo = new THREE.ConeGeometry(7 + Math.sin(x * 0.2) * 2, peakH, 4);
      const peak = new THREE.Mesh(peakGeo, farMat);
      peak.rotation.y = Math.PI * 0.25;
      peak.position.set(x, peakH * 0.5 - 2, -28);
      this.farMountainGroup.add(peak);
    }
    this.scene.add(this.farMountainGroup);

    // Near mountain / hill ridge (z = -19)
    this.nearMountainGroup = new THREE.Group();
    const nearMat = new THREE.MeshStandardMaterial({
      color: theme.mountainsNearColor,
      roughness: 0.9,
      metalness: 0.08,
    });
    for (let x = -45; x <= 220; x += 11) {
      const hillH = 9 + Math.cos(x * 0.15) * 3;
      const hillGeo = new THREE.ConeGeometry(5.5 + Math.sin(x * 0.3) * 1.5, hillH, 5);
      const hill = new THREE.Mesh(hillGeo, nearMat);
      hill.rotation.y = Math.PI * 0.2;
      hill.position.set(x, hillH * 0.5 - 2, -19);
      this.nearMountainGroup.add(hill);
    }
    this.scene.add(this.nearMountainGroup);
  }

  private buildClouds(): void {
    this.clouds = [];
    const cloudMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.85,
      transparent: true,
      opacity: 0.85,
    });

    for (let i = 0; i < 14; i++) {
      const cloud = new THREE.Group();
      const s1 = new THREE.Mesh(new THREE.SphereGeometry(1.6, 10, 8), cloudMat);
      const s2 = new THREE.Mesh(new THREE.SphereGeometry(2.2, 10, 8), cloudMat);
      s2.position.set(1.5, 0.2, 0);
      const s3 = new THREE.Mesh(new THREE.SphereGeometry(1.5, 10, 8), cloudMat);
      s3.position.set(-1.4, -0.1, 0);
      const s4 = new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 8), cloudMat);
      s4.position.set(0.6, 1.1, 0.2);

      cloud.add(s1, s2, s3, s4);
      const startX = -20 + i * 16 + (Math.random() * 8 - 4);
      const startY = 11 + Math.random() * 8;
      const startZ = -15 - Math.random() * 8;
      cloud.position.set(startX, startY, startZ);
      cloud.userData = { speed: 0.4 + Math.random() * 0.6 };
      this.clouds.push(cloud);
      this.scene.add(cloud);
    }
  }

  private buildStars(): void {
    const starsGeo = new THREE.BufferGeometry();
    const starCount = 70;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 260;
      positions[i * 3 + 1] = 6 + Math.random() * 28;
      positions[i * 3 + 2] = -33 - Math.random() * 4;
    }
    starsGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const starsMat = new THREE.PointsMaterial({
      color: '#ffffff',
      size: 0.45,
      transparent: true,
      opacity: 0.85,
    });
    this.starsMesh = new THREE.Points(starsGeo, starsMat);
    this.scene.add(this.starsMesh);
  }

  private buildAurora(): void {
    const auroraGeo = new THREE.PlaneGeometry(280, 18, 32, 6);
    const pos = auroraGeo.getAttribute('position');
    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      pos.setY(i, pos.getY(i) + Math.sin(vx * 0.08) * 3.5 + Math.cos(vx * 0.15) * 1.5);
    }
    auroraGeo.computeVertexNormals();
    const auroraMat = new THREE.MeshBasicMaterial({
      color: '#00f5d4',
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.auroraMesh = new THREE.Mesh(auroraGeo, auroraMat);
    this.auroraMesh.position.set(10, 22, -31);
    this.scene.add(this.auroraMesh);
  }

  /** Glowing futuristic shield bubble around the rabbit */
  private buildShieldVisuals(): void {
    const shieldGeo = new THREE.SphereGeometry(1.25, 24, 20);
    const shieldMat = new THREE.MeshStandardMaterial({
      color: '#00f0ff',
      emissive: '#00d0ff',
      emissiveIntensity: 0.7,
      transparent: true,
      opacity: 0.35,
      roughness: 0.1,
      metalness: 0.3,
      depthWrite: false,
    });
    this.shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    this.shieldMesh.position.set(0, 0.9, 0);
    this.shieldMesh.visible = false;
    this.bunny.add(this.shieldMesh);

    // Outer faint pulse aura
    const outerGeo = new THREE.SphereGeometry(1.36, 16, 14);
    const outerMat = new THREE.MeshBasicMaterial({
      color: '#a3ff2e',
      wireframe: true,
      transparent: true,
      opacity: 0.25,
    });
    this.shieldGlowMesh = new THREE.Mesh(outerGeo, outerMat);
    this.shieldGlowMesh.position.set(0, 0.9, 0);
    this.shieldGlowMesh.visible = false;
    this.bunny.add(this.shieldGlowMesh);
  }

  /** Load User's custom 3D Bunny GLB Model */
  private loadBunnyModel(): void {
    const loader = new GLTFLoader();
    loader.load(
      'assets/bunny-model.glb',
      (gltf) => {
        // Compute bounding box to normalize scale and center ground contact
        const box = new THREE.Box3().setFromObject(gltf.scene);
        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);

        // Normalize rabbit height to ~1.65 units
        const targetHeight = 1.65;
        const scale = targetHeight / (size.y || 1);
        gltf.scene.scale.setScalar(scale);

        // Center on X and Z, and place feet right on y=0
        gltf.scene.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);

        // Rotate rabbit so it faces right (+X direction of running)
        gltf.scene.rotation.y = Math.PI * 0.5;

        // Enable shadows on all sub-meshes
        gltf.scene.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        // Animations if available
        if (gltf.animations && gltf.animations.length > 0) {
          this.mixer = new THREE.AnimationMixer(gltf.scene);
          const action = this.mixer.clipAction(gltf.animations[0]);
          action.play();
        }

        // Swap out fallback bunny with loaded GLB model
        if (this.fallbackBunny) {
          this.modelWrapper.remove(this.fallbackBunny);
          this.fallbackBunny = undefined;
        }
        this.modelWrapper.add(gltf.scene);

        // Render preview if game not running yet
        if (!this.running) {
          this.renderer.render(this.scene, this.camera);
        }
        this.onReady?.();
      },
      undefined,
      (err) => {
        console.warn('Could not load bunny GLB model, using arcade fallback:', err);
        if (!this.running) {
          this.renderer.render(this.scene, this.camera);
        }
        this.onReady?.();
      },
    );
  }

  /** Expressive low-poly fallback bunny displayed before GLB loads */
  private buildFallbackBunny(): void {
    this.fallbackBunny = new THREE.Group();
    const fur = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 });
    const pink = new THREE.MeshStandardMaterial({ color: '#ff9abf', roughness: 0.5 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: '#16192b', roughness: 0.1 });

    const body = new THREE.Mesh(new THREE.SphereGeometry(0.62, 16, 14), fur);
    body.position.y = 0.6;
    body.scale.set(1, 1.1, 0.9);
    body.castShadow = true;
    this.fallbackBunny.add(body);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.46, 16, 14), fur);
    head.position.set(0.38, 1.25, 0);
    head.castShadow = true;
    this.fallbackBunny.add(head);

    const leftEye = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), eyeMat);
    leftEye.position.set(0.65, 1.34, -0.18);
    const rightEye = leftEye.clone();
    rightEye.position.z = 0.18;
    this.fallbackBunny.add(leftEye, rightEye);

    const earGeo = new THREE.CapsuleGeometry(0.12, 0.65, 6, 10);
    const leftEar = new THREE.Mesh(earGeo, fur);
    leftEar.position.set(0.2, 1.88, -0.2);
    leftEar.rotation.z = -0.2;
    const rightEar = leftEar.clone();
    rightEar.position.z = 0.2;
    this.fallbackBunny.add(leftEar, rightEar);

    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), pink);
    tail.position.set(-0.55, 0.65, 0);
    this.fallbackBunny.add(tail);

    this.modelWrapper.add(this.fallbackBunny);
  }

  // ---------------------------------------------------------------------------
  // Recursive Dynamic Platforms & Items Generation
  // ---------------------------------------------------------------------------

  private rebuildAllPlatforms(): void {
    // Remove existing platforms
    for (const p of this.platformBlocks) {
      this.scene.remove(p.group);
    }
    this.platformBlocks.length = 0;
    this.goalTrophy = undefined;

    if (this.level.id === 1) {
      this.buildLevel1Platforms();
    } else if (this.level.id === 2) {
      this.buildLevel2Platforms();
    } else {
      this.buildGenericPlatforms();
    }
  }

  /** Hand-crafted tutorial platform sequence */
  private buildLevel1Platforms(): void {
    this.rightmostX = -3;
    // Step 1: starter platform (warm up, jump)
    const p1 = this.createPlatformBlock(3, 0, 13, false, false, false);
    this.platformBlocks.push(p1);
    this.rightmostX = p1.x + p1.width / 2;

    // Step 2: Coins platform
    const p2 = this.createPlatformBlock(this.rightmostX + 2.2 + 6, 0.25, 12, false, true, false);
    this.platformBlocks.push(p2);
    this.rightmostX = p2.x + p2.width / 2;

    // Step 3: Wider gap + Carrot Shield platform
    const p3 = this.createPlatformBlock(this.rightmostX + 3.0 + 6, 0.55, 12, false, false, true);
    this.platformBlocks.push(p3);
    this.rightmostX = p3.x + p3.width / 2;

    // Step 4: Spikes hazard platform (test shield or leap over)
    const p4 = this.createPlatformBlock(this.rightmostX + 2.6 + 7, 0.2, 14, true, false, false);
    this.platformBlocks.push(p4);
    this.rightmostX = p4.x + p4.width / 2;

    // Step 5: High leap over chasm + Coin Arc
    const p5Gap = 3.2;
    const p5Width = 13;
    const p5X = this.rightmostX + p5Gap + p5Width / 2;
    const p5 = this.createPlatformBlock(p5X, 0.45, p5Width, false, true, false);
    this.platformBlocks.push(p5);
    this.spawnCoinArc(this.rightmostX + 0.3, p5X - p5Width / 2 - 0.3, 0.8, 1.4, 4);
    this.rightmostX = p5.x + p5.width / 2;

    // Step 6: Grand Victory Runway with Finish Arch & Golden Carrot Trophy
    const p6Gap = 3.4;
    const p6Width = 26;
    const p6X = this.rightmostX + p6Gap + p6Width / 2;
    const p6 = this.createPlatformBlock(p6X, 0.75, p6Width, false, true, false);
    
    // Add Finish Line Arch & Checkered Gate at targetDistance = 90
    const finishArch = this.buildFinishLine(90.0 - p6X, 0.43);
    p6.group.add(finishArch);

    // Golden Carrot Trophy beyond the finish line at x = 93.5
    const trophy = this.buildGoalTrophy(93.5 - p6X, 0.43, false);
    p6.group.add(trophy);

    this.platformBlocks.push(p6);
    this.rightmostX = p6.x + p6.width / 2;

    // Forward backup platforms
    for (let i = 1; i <= 3; i++) {
      const p = this.generateNextPlatform(i + 6);
      this.platformBlocks.push(p);
    }
  }

  /**
   * Stage 02: "First Steps"
   * Rhythm & voice mastery: elevated steps, wider chasms, parabolic coin arcs,
   * stationary & moving hazards, carrot shield power-ups, and the Grand Cyan Crystal Trophy!
   */
  private buildLevel2Platforms(): void {
    this.rightmostX = -3;

    // 1. Starter Launchpad Runway (0m - 14m)
    const p1 = this.createPlatformBlock(3, 0, 13, false, true, false);
    this.platformBlocks.push(p1);
    this.rightmostX = p1.x + p1.width / 2; // 9.5

    // 2. First Chasm & Parabolic Coin Arc (Gap 3.0m, y=0.3, width=11)
    const p2Gap = 3.0;
    const p2Width = 11;
    const p2X = this.rightmostX + p2Gap + p2Width / 2;
    const p2 = this.createPlatformBlock(p2X, 0.3, p2Width, false, true, false);
    this.platformBlocks.push(p2);
    this.spawnCoinArc(this.rightmostX + 0.3, p2X - p2Width / 2 - 0.3, 0.8, 1.2, 3);
    this.rightmostX = p2.x + p2.width / 2;

    // 3. Elevated Ledge + Carrot Shield (Gap 3.2m, y=1.2, width=10)
    const p3Gap = 3.2;
    const p3Width = 10;
    const p3X = this.rightmostX + p3Gap + p3Width / 2;
    const p3 = this.createPlatformBlock(p3X, 1.2, p3Width, false, false, true);
    this.platformBlocks.push(p3);
    this.rightmostX = p3.x + p3.width / 2;

    // 4. Spike Barrier Platform (Gap 2.8m, y=0.5, width=14)
    const p4Gap = 2.8;
    const p4Width = 14;
    const p4X = this.rightmostX + p4Gap + p4Width / 2;
    const p4 = this.createPlatformBlock(p4X, 0.5, p4Width, true, false, false);
    this.platformBlocks.push(p4);
    this.rightmostX = p4.x + p4.width / 2;

    // 5. The Great 4.2m Chasm + High Parabolic Coin Arc (Gap 4.2m, y=0.1, width=12)
    const p5Gap = 4.2;
    const p5Width = 12;
    const p5X = this.rightmostX + p5Gap + p5Width / 2;
    const p5 = this.createPlatformBlock(p5X, 0.1, p5Width, false, true, false);
    this.platformBlocks.push(p5);
    this.spawnCoinArc(this.rightmostX + 0.4, p5X - p5Width / 2 - 0.4, 0.85, 2.2, 4);
    this.rightmostX = p5.x + p5.width / 2;

    // 6. Summit Ledge + Backup Carrot Shield (Gap 3.4m, y=1.5, width=9)
    const p6Gap = 3.4;
    const p6Width = 9;
    const p6X = this.rightmostX + p6Gap + p6Width / 2;
    const p6 = this.createPlatformBlock(p6X, 1.5, p6Width, false, false, true);
    this.platformBlocks.push(p6);
    this.rightmostX = p6.x + p6.width / 2;

    // 7. Moving Hazard Gauntlet (Gap 3.0m, y=0.6, width=13, moving hazard)
    const p7Gap = 3.0;
    const p7Width = 13;
    const p7X = this.rightmostX + p7Gap + p7Width / 2;
    const p7 = this.createPlatformBlock(p7X, 0.6, p7Width, true, false, false, true);
    this.platformBlocks.push(p7);
    this.rightmostX = p7.x + p7.width / 2;

    // 8. Stepping Stone Island (Gap 3.2m, y=1.0, width=7)
    const p8Gap = 3.2;
    const p8Width = 7;
    const p8X = this.rightmostX + p8Gap + p8Width / 2;
    const p8 = this.createPlatformBlock(p8X, 1.0, p8Width, false, true, false);
    this.platformBlocks.push(p8);
    this.rightmostX = p8.x + p8.width / 2;

    // 9. Grand Skyline Finish Runway (Gap 3.4m, y=0.8, width=26)
    const p9Gap = 3.4;
    const p9Width = 26;
    const p9X = this.rightmostX + p9Gap + p9Width / 2;
    const p9 = this.createPlatformBlock(p9X, 0.8, p9Width, false, true, false);

    // Finish Line Arch at x = 120.0
    const finishArch = this.buildFinishLine(120.0 - p9X, 0.43);
    p9.group.add(finishArch);

    // Grand Cyan Crystal Star Trophy at x = 124.0
    const trophy = this.buildGoalTrophy(124.0 - p9X, 0.43, true);
    p9.group.add(trophy);

    this.platformBlocks.push(p9);
    this.rightmostX = p9.x + p9.width / 2;

    // Forward backup platforms
    for (let i = 1; i <= 3; i++) {
      const p = this.generateNextPlatform(i + 10);
      this.platformBlocks.push(p);
    }
  }

  /** Generic procedural platforms for endless / higher stages */
  private buildGenericPlatforms(): void {
    this.rightmostX = -3;
    const initialWidth = 9.5;
    const startPlatform = this.createPlatformBlock(0, 0, initialWidth, false, false, false);
    this.platformBlocks.push(startPlatform);
    this.rightmostX = startPlatform.x + startPlatform.width / 2;

    // Generate up to target distance
    let step = 1;
    while (this.rightmostX < this.targetDistance - 18) {
      const p = this.generateNextPlatform(step++);
      this.platformBlocks.push(p);
    }

    // Grand Finish Runway
    const pFinWidth = 26;
    const pFinX = this.rightmostX + 3.2 + pFinWidth / 2;
    const pFin = this.createPlatformBlock(pFinX, 0.8, pFinWidth, false, true, false);
    const finishArch = this.buildFinishLine(this.targetDistance - pFinX, 0.43);
    pFin.group.add(finishArch);

    const trophy = this.buildGoalTrophy(this.targetDistance + 4.0 - pFinX, 0.43, true);
    pFin.group.add(trophy);

    this.platformBlocks.push(pFin);
    this.rightmostX = pFin.x + pFin.width / 2;

    for (let i = 1; i <= 3; i++) {
      const p = this.generateNextPlatform(step + i);
      this.platformBlocks.push(p);
    }
  }

  /** Spawn a parabolic arc of floating golden coins between two X points */
  private spawnCoinArc(xStart: number, xEnd: number, yBase: number, arcHeight: number, count = 4): void {
    const parentBlock = this.platformBlocks[this.platformBlocks.length - 1];
    if (!parentBlock) return;

    for (let i = 0; i < count; i++) {
      const t = (i + 1) / (count + 1);
      const coinX = THREE.MathUtils.lerp(xStart, xEnd, t);
      const coinY = yBase + Math.sin(t * Math.PI) * arcHeight;

      const coinMesh = new THREE.Mesh(this.coinGeometry, this.coinMaterial);
      coinMesh.castShadow = true;
      coinMesh.rotation.x = Math.PI * 0.5;
      coinMesh.position.set(coinX - parentBlock.x, coinY - parentBlock.y, 0);
      parentBlock.group.add(coinMesh);

      parentBlock.coins.push({
        mesh: coinMesh,
        x: coinX,
        y: coinY,
        baseY: coinY,
        phase: Math.random() * Math.PI * 2,
        active: true,
      });
    }
  }

  private getCheckeredTexture(): THREE.CanvasTexture {
    if (this.checkeredTex) return this.checkeredTex;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#0a0e27';
    ctx.fillRect(0, 0, 256, 64);
    const rows = 2;
    const cols = 8;
    const cellW = 256 / cols;
    const cellH = 64 / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? '#ffffff' : '#14182e';
        ctx.fillRect(c * cellW, r * cellH, cellW, cellH);
      }
    }
    ctx.strokeStyle = '#ffd214';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, 256, 64);
    this.checkeredTex = new THREE.CanvasTexture(canvas);
    this.checkeredTex.magFilter = THREE.NearestFilter;
    this.checkeredTex.minFilter = THREE.LinearFilter;
    return this.checkeredTex;
  }

  private getFinishBannerTexture(): THREE.CanvasTexture {
    if (this.bannerTex) return this.bannerTex;
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#0b1028';
    ctx.fillRect(0, 0, 512, 128);

    // Checkered border top & bottom
    const bCols = 16;
    const bW = 512 / bCols;
    for (let c = 0; c < bCols; c++) {
      ctx.fillStyle = c % 2 === 0 ? '#ffffff' : '#14182e';
      ctx.fillRect(c * bW, 0, bW, 14);
      ctx.fillStyle = c % 2 === 1 ? '#ffffff' : '#14182e';
      ctx.fillRect(c * bW, 128 - 14, bW, 14);
    }

    // Glowing border frame
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 508, 124);

    // Glowing text
    ctx.font = '900 52px "Arial Black", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#ffd214';
    ctx.fillText('🏁 FINISH 🏁', 256, 64);

    this.bannerTex = new THREE.CanvasTexture(canvas);
    this.bannerTex.magFilter = THREE.LinearFilter;
    this.bannerTex.minFilter = THREE.LinearFilter;
    return this.bannerTex;
  }

  /** Finish Line Arch Gate with checkered strip, dual towers, waving flags and glowing overhead banner */
  private buildFinishLine(localX: number, localY: number): THREE.Group {
    const finishGroup = new THREE.Group();
    finishGroup.position.set(localX, localY, 0);

    // 1. Checkered Ground Strip
    const stripGeo = new THREE.PlaneGeometry(1.6, 4.4);
    const stripMat = new THREE.MeshStandardMaterial({
      map: this.getCheckeredTexture(),
      roughness: 0.35,
      metalness: 0.2,
    });
    const strip = new THREE.Mesh(stripGeo, stripMat);
    strip.rotation.x = -Math.PI * 0.5;
    strip.rotation.z = Math.PI * 0.5;
    strip.position.set(0, 0.015, 0);
    strip.receiveShadow = true;
    finishGroup.add(strip);

    // 2. Dual Futuristic Pylons (Left at z = -2.3, Right at z = 2.3)
    const pillarGeo = new THREE.CylinderGeometry(0.18, 0.24, 4.2, 16);
    const pillarMat = new THREE.MeshStandardMaterial({
      color: '#131936',
      roughness: 0.2,
      metalness: 0.8,
    });
    const ringGeo = new THREE.TorusGeometry(0.26, 0.045, 8, 16);
    const ringMat = new THREE.MeshStandardMaterial({
      color: '#ffd214',
      emissive: '#ff9900',
      emissiveIntensity: 0.7,
      metalness: 0.8,
    });
    const beaconGeo = new THREE.SphereGeometry(0.32, 16, 14);
    const beaconMat = new THREE.MeshStandardMaterial({
      color: '#ffd214',
      emissive: '#ffd214',
      emissiveIntensity: 0.9,
    });
    const flagGeo = new THREE.PlaneGeometry(0.85, 0.55);
    const flagMat = new THREE.MeshBasicMaterial({
      map: this.getCheckeredTexture(),
      side: THREE.DoubleSide,
    });

    for (const z of [-2.3, 2.3]) {
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(0, 2.1, z);
      pillar.castShadow = true;
      finishGroup.add(pillar);

      // Glowing rings
      for (const ry of [0.9, 2.1, 3.3]) {
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI * 0.5;
        ring.position.set(0, ry, z);
        finishGroup.add(ring);
      }

      // Top Beacon
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.set(0, 4.3, z);
      finishGroup.add(beacon);

      // Checkered Flag
      const flag = new THREE.Mesh(flagGeo, flagMat);
      flag.position.set(0.42, 4.0, z);
      finishGroup.add(flag);
    }

    // 3. Overhead Crossbar
    const crossbarGeo = new THREE.BoxGeometry(0.35, 0.35, 4.8);
    const crossbarMat = new THREE.MeshStandardMaterial({
      color: '#1a2246',
      roughness: 0.3,
      metalness: 0.7,
    });
    const crossbar = new THREE.Mesh(crossbarGeo, crossbarMat);
    crossbar.position.set(0, 4.15, 0);
    crossbar.castShadow = true;
    finishGroup.add(crossbar);

    // 4. Overhead "🏁 FINISH 🏁" Signboard
    const signGeo = new THREE.BoxGeometry(0.12, 0.95, 4.2);
    const signMat = new THREE.MeshStandardMaterial({
      map: this.getFinishBannerTexture(),
      roughness: 0.25,
      metalness: 0.4,
      emissive: '#0b1028',
      emissiveIntensity: 0.4,
    });
    const sign = new THREE.Mesh(signGeo, signMat);
    sign.position.set(0, 3.45, 0);
    finishGroup.add(sign);

    // 5. Holographic Breakable Finish Ribbon (bunny chest height y = 0.85)
    const ribbonGeo = new THREE.BoxGeometry(0.04, 0.22, 4.6);
    const ribbonMat = new THREE.MeshStandardMaterial({
      color: '#ff2a6d',
      emissive: '#ff0055',
      emissiveIntensity: 0.85,
      transparent: true,
      opacity: 0.8,
    });
    const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat);
    ribbon.position.set(0, 0.85, 0);
    finishGroup.add(ribbon);

    return finishGroup;
  }

  /** Trophy placed at the end of the stage */
  private buildGoalTrophy(x: number, y: number, isStar = false): THREE.Group {
    const trophy = new THREE.Group();
    if (!isStar) {
      // Golden Carrot Trophy for Level 1
      const carrotGeo = new THREE.ConeGeometry(0.48, 1.4, 16);
      const carrotMat = new THREE.MeshStandardMaterial({
        color: '#ff8800',
        emissive: '#ffd214',
        emissiveIntensity: 0.6,
        roughness: 0.2,
        metalness: 0.35,
      });
      const carrot = new THREE.Mesh(carrotGeo, carrotMat);
      carrot.rotation.x = Math.PI;
      carrot.position.y = 0.7;
      trophy.add(carrot);

      const leafGeo = new THREE.ConeGeometry(0.14, 0.55, 8);
      const leafMat = new THREE.MeshStandardMaterial({ color: '#33ff33', roughness: 0.2 });
      for (let i = 0; i < 3; i++) {
        const leaf = new THREE.Mesh(leafGeo, leafMat);
        leaf.position.set((i - 1) * 0.15, 1.5, 0);
        leaf.rotation.z = (i - 1) * 0.32;
        trophy.add(leaf);
      }
    } else {
      // Grand Cyan Crystal Star Trophy for Level 2
      const pedGeo = new THREE.CylinderGeometry(0.55, 0.75, 0.35, 16);
      const pedMat = new THREE.MeshStandardMaterial({
        color: '#0d1d3a',
        roughness: 0.3,
        metalness: 0.8,
      });
      const ped = new THREE.Mesh(pedGeo, pedMat);
      ped.position.y = 0.17;
      trophy.add(ped);

      const ringGeo = new THREE.TorusGeometry(0.62, 0.07, 8, 24);
      const ringMat = new THREE.MeshStandardMaterial({
        color: '#ffd214',
        emissive: '#ff9900',
        emissiveIntensity: 0.5,
        metalness: 0.8,
        roughness: 0.2,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI * 0.5;
      ring.position.y = 0.32;
      trophy.add(ring);

      const crystalGeo = new THREE.OctahedronGeometry(0.65, 0);
      const crystalMat = new THREE.MeshStandardMaterial({
        color: '#73e0ff',
        emissive: '#00d5ff',
        emissiveIntensity: 0.85,
        roughness: 0.1,
        metalness: 0.9,
      });
      const crystal = new THREE.Mesh(crystalGeo, crystalMat);
      crystal.position.y = 1.15;
      crystal.scale.set(0.9, 1.4, 0.9);
      trophy.add(crystal);

      const shardGeo = new THREE.TetrahedronGeometry(0.12, 0);
      const shardMat = new THREE.MeshStandardMaterial({
        color: '#ffffff',
        emissive: '#73e0ff',
        emissiveIntensity: 0.9,
      });
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * Math.PI * 2;
        const shard = new THREE.Mesh(shardGeo, shardMat);
        shard.position.set(Math.cos(angle) * 0.85, 1.15 + Math.sin(angle) * 0.2, Math.sin(angle) * 0.85);
        trophy.add(shard);
      }
    }

    trophy.position.set(x, y, 0);
    this.goalTrophy = trophy;
    return trophy;
  }

  private generateNextPlatform(stepIndex: number): PlatformBlock {
    // Level difficulty scaling
    const isTutorial = this.level.id === 1;
    const minWidth = isTutorial ? 5.5 : Math.max(3.2, 6.0 - this.level.id * 0.55);
    const maxWidth = isTutorial ? 8.5 : Math.max(4.5, 7.5 - this.level.id * 0.4);
    const width = minWidth + Math.random() * (maxWidth - minWidth);

    const minGap = isTutorial ? 1.4 : 1.8 + this.level.id * 0.35;
    const maxGap = isTutorial ? 2.8 : 3.0 + this.level.id * 0.55;
    const gap = minGap + Math.random() * (maxGap - minGap);

    const x = this.rightmostX + gap + width / 2;

    // Gentle undulating height variation
    const heightVariation = isTutorial ? 0.6 : 1.4;
    const y = Math.sin(stepIndex * 0.8) * heightVariation + (Math.random() * 0.4 - 0.2);

    // Collectibles & Hazards chance
    const spawnCoins = Math.random() < 0.65;
    const spawnCarrot = isTutorial ? stepIndex === 3 || stepIndex === 8 : Math.random() < 0.22;
    const allowHazard = isTutorial ? stepIndex >= 4 : stepIndex >= 2 && Math.random() < (0.35 + this.level.id * 0.1);

    const block = this.createPlatformBlock(x, y, width, allowHazard, spawnCoins, spawnCarrot);
    this.rightmostX = x + width / 2;
    return block;
  }

  private createPlatformBlock(
    x: number,
    y: number,
    width: number,
    hasHazard: boolean,
    hasCoins: boolean,
    hasCarrot: boolean,
    isMovingHazard = false,
  ): PlatformBlock {
    const group = new THREE.Group();
    group.position.set(x, y, 0);

    // 1. Earth / Soil Body
    const soilGeo = new THREE.BoxGeometry(width, 0.85, 3.4);
    const soilMat = new THREE.MeshStandardMaterial({
      color: this.theme.earthColor,
      roughness: 0.95,
      metalness: 0.05,
    });
    const soilMesh = new THREE.Mesh(soilGeo, soilMat);
    soilMesh.castShadow = true;
    soilMesh.receiveShadow = true;
    group.add(soilMesh);

    // Darker geological strata on lower portion of soil
    const strataGeo = new THREE.BoxGeometry(width + 0.02, 0.32, 3.42);
    const strataMat = new THREE.MeshStandardMaterial({
      color: this.theme.earthStrataColor,
      roughness: 0.98,
      metalness: 0.02,
    });
    const strataMesh = new THREE.Mesh(strataGeo, strataMat);
    strataMesh.position.y = -0.26;
    strataMesh.receiveShadow = true;
    group.add(strataMesh);

    // 2. Lush Grass Top Cap
    const grassThickness = 0.18;
    const grassGeo = new THREE.BoxGeometry(width + 0.12, grassThickness, 3.52);
    const grassMat = new THREE.MeshStandardMaterial({
      color: this.theme.grassColor,
      emissive: this.theme.grassEmissive,
      emissiveIntensity: 0.2,
      roughness: 0.75,
      metalness: 0.06,
    });
    const grassMesh = new THREE.Mesh(grassGeo, grassMat);
    grassMesh.position.y = 0.425 - grassThickness / 2;
    grassMesh.castShadow = true;
    grassMesh.receiveShadow = true;
    group.add(grassMesh);

    // 3. Scalloped Grass Hanging Tufts along the front edge (facing player)
    const tuftSpacing = 0.65;
    const numTufts = Math.max(2, Math.floor(width / tuftSpacing));
    const tuftGeo = new THREE.ConeGeometry(0.14, 0.22, 4);
    tuftGeo.rotateZ(Math.PI);
    const tuftMat = new THREE.MeshStandardMaterial({
      color: this.theme.grassTrimColor,
      emissive: this.theme.grassEmissive,
      emissiveIntensity: 0.15,
      roughness: 0.8,
    });
    for (let i = 0; i < numTufts; i++) {
      const tuftX = -width / 2 + (i + 0.5) * (width / numTufts);
      const tuft = new THREE.Mesh(tuftGeo, tuftMat);
      tuft.position.set(tuftX, 0.24, 1.76);
      group.add(tuft);
    }

    // 4. Daisy Flowers on safe platforms in Level 1
    if (this.theme.hasFlowers && width >= 5.5 && !hasHazard) {
      this.spawnDaisyClusters(group, width);
    }

    let hazard: HazardBlock | undefined;
    const coins: CoinItem[] = [];
    let carrot: CarrotItem | undefined;

    // Spawn Hazards (Spikes / Moving blocks)
    if (hasHazard && width > 4.0) {
      const isMoving = isMovingHazard || (this.level.id >= 3 && Math.random() < 0.4);
      const hazWidth = 0.6;
      const hazHeight = 0.95;
      const hazGeo = new THREE.BoxGeometry(hazWidth, hazHeight, 2.2);
      const hazMesh = new THREE.Mesh(hazGeo, this.hazardMaterial);
      hazMesh.castShadow = true;
      hazMesh.position.set(0, 0.42 + hazHeight / 2, 0);
      group.add(hazMesh);

      hazard = {
        mesh: hazMesh,
        x: x,
        y: y + 0.42 + hazHeight / 2,
        width: hazWidth,
        height: hazHeight,
        isMoving,
        moveSpeed: 1.8 + Math.random() * 1.5,
        moveRange: 0.6,
        initialY: y + 0.42 + hazHeight / 2,
      };
    }

    // Spawn Coins (Floating spinning golden disks)
    if (hasCoins && !hasHazard) {
      const count = Math.min(3, Math.floor(width / 1.8));
      const step = width / (count + 1);
      for (let i = 1; i <= count; i++) {
        const localX = -width / 2 + step * i;
        const coinMesh = new THREE.Mesh(this.coinGeometry, this.coinMaterial);
        coinMesh.castShadow = true;
        coinMesh.rotation.x = Math.PI * 0.5;
        const baseY = y + 1.25;
        coinMesh.position.set(localX, 1.25, 0);
        group.add(coinMesh);

        coins.push({
          mesh: coinMesh,
          x: x + localX,
          y: baseY,
          baseY: baseY,
          phase: Math.random() * Math.PI * 2,
          active: true,
        });
      }
    }

    // Spawn Carrot Power-Up (Shield buff)
    if (hasCarrot && !hasHazard) {
      const carrotGroup = this.buildCarrotMesh();
      const localX = (Math.random() - 0.5) * (width * 0.5);
      const baseY = y + 1.35;
      carrotGroup.position.set(localX, 1.35, 0);
      group.add(carrotGroup);

      carrot = {
        group: carrotGroup,
        x: x + localX,
        y: baseY,
        baseY: baseY,
        phase: Math.random() * Math.PI * 2,
        active: true,
      };
    }

    this.scene.add(group);

    return {
      group,
      baseMesh: soilMesh,
      topPlate: grassMesh,
      x,
      y,
      width,
      hazard,
      coins,
      carrot,
    };
  }

  private spawnDaisyClusters(group: THREE.Group, width: number): void {
    const flowerGeo = new THREE.SphereGeometry(0.06, 8, 6);
    const flowerMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 });
    const centerMat = new THREE.MeshStandardMaterial({ color: '#ffcc00', roughness: 0.3 });
    const stemMat = new THREE.MeshStandardMaterial({ color: '#2d8a35', roughness: 0.6 });

    const numFlowers = Math.min(3, Math.floor(width / 4.0));
    for (let i = 0; i < numFlowers; i++) {
      const fGroup = new THREE.Group();
      const fx = -width * 0.3 + (i / Math.max(1, numFlowers - 1)) * width * 0.6 + (Math.random() * 0.4 - 0.2);
      const fz = (Math.random() - 0.5) * 1.6;

      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 5), stemMat);
      stem.position.y = 0.48;
      fGroup.add(stem);

      const center = new THREE.Mesh(flowerGeo, centerMat);
      center.position.y = 0.57;
      fGroup.add(center);

      for (let p = 0; p < 4; p++) {
        const petal = new THREE.Mesh(flowerGeo, flowerMat);
        const ang = (p / 4) * Math.PI * 2;
        petal.position.set(Math.cos(ang) * 0.08, 0.57, Math.sin(ang) * 0.08);
        petal.scale.set(1.2, 0.5, 1.2);
        fGroup.add(petal);
      }

      fGroup.position.set(fx, 0, fz);
      group.add(fGroup);
    }
  }

  /** Build 3D Carrot collectible model */
  private buildCarrotMesh(): THREE.Group {
    const carrotGroup = new THREE.Group();

    // Orange tapered body
    const bodyGeo = new THREE.ConeGeometry(0.24, 0.75, 14);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: '#ff7700',
      emissive: '#ff4400',
      emissiveIntensity: 0.35,
      roughness: 0.3,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.rotation.x = Math.PI; // point downwards
    body.castShadow = true;
    carrotGroup.add(body);

    // Green leafy tufts on top
    const leafMat = new THREE.MeshStandardMaterial({ color: '#33dd33', roughness: 0.3 });
    const leafGeo = new THREE.ConeGeometry(0.09, 0.35, 6);
    for (let i = 0; i < 3; i++) {
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.set((i - 1) * 0.08, 0.42, 0);
      leaf.rotation.z = (i - 1) * 0.28;
      carrotGroup.add(leaf);
    }

    return carrotGroup;
  }

  // ---------------------------------------------------------------------------
  // Particle Systems
  // ---------------------------------------------------------------------------

  private initParticles(): void {
    for (let i = 0; i < 40; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0 });
      const mesh = new THREE.Mesh(this.particleGeo, mat);
      mesh.visible = false;
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        active: false,
      });
    }
  }

  private spawnDustParticles(x: number, y: number): void {
    let count = 0;
    for (const p of this.particles) {
      if (!p.active) {
        p.active = true;
        p.mesh.visible = true;
        p.mesh.position.set(x + (Math.random() - 0.5) * 0.4, y + 0.1, (Math.random() - 0.5) * 0.4);
        p.vx = (Math.random() - 0.5) * 2.5;
        p.vy = Math.random() * 1.5 + 0.5;
        p.vz = (Math.random() - 0.5) * 1.5;
        p.life = 0;
        p.maxLife = 0.35 + Math.random() * 0.2;
        (p.mesh.material as THREE.MeshBasicMaterial).color.set('#d0e0ff');
        (p.mesh.material as THREE.MeshBasicMaterial).opacity = 0.7;
        count++;
        if (count >= 7) break;
      }
    }
  }

  private spawnCoinParticles(x: number, y: number): void {
    let count = 0;
    for (const p of this.particles) {
      if (!p.active) {
        p.active = true;
        p.mesh.visible = true;
        p.mesh.position.set(x, y, 0);
        const angle = Math.random() * Math.PI * 2;
        const spd = 2.5 + Math.random() * 3.0;
        p.vx = Math.cos(angle) * spd;
        p.vy = Math.sin(angle) * spd + 1.5;
        p.vz = (Math.random() - 0.5) * 2.0;
        p.life = 0;
        p.maxLife = 0.45;
        (p.mesh.material as THREE.MeshBasicMaterial).color.set('#ffd214');
        (p.mesh.material as THREE.MeshBasicMaterial).opacity = 0.9;
        count++;
        if (count >= 8) break;
      }
    }
  }

  private spawnShieldBreakParticles(x: number, y: number): void {
    let count = 0;
    for (const p of this.particles) {
      if (!p.active) {
        p.active = true;
        p.mesh.visible = true;
        p.mesh.position.set(x, y + 0.8, 0);
        p.vx = (Math.random() - 0.5) * 6.0;
        p.vy = (Math.random() - 0.5) * 6.0;
        p.vz = (Math.random() - 0.5) * 3.0;
        p.life = 0;
        p.maxLife = 0.6;
        (p.mesh.material as THREE.MeshBasicMaterial).color.set('#00f0ff');
        (p.mesh.material as THREE.MeshBasicMaterial).opacity = 0.85;
        count++;
        if (count >= 14) break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Game Loop & Physics Update
  // ---------------------------------------------------------------------------

  private animate = (): void => {
    if (!this.running) return;
    this.animationFrame = requestAnimationFrame(this.animate);
    const now = performance.now();
    const delta = Math.min(0.04, (now - this.lastTimestamp) / 1000);
    this.lastTimestamp = now;

    this.update(delta);
    this.renderer.render(this.scene, this.camera);
  };

  private update(delta: number): void {
    const time = performance.now() * 0.001;

    // Cooldowns & Timers
    this.jumpCooldown = Math.max(0, this.jumpCooldown - delta);
    this.invulnerableTimer = Math.max(0, this.invulnerableTimer - delta);

    if (this.shieldActive) {
      this.shieldTimer -= delta;
      if (this.shieldTimer <= 0) {
        this.shieldActive = false;
        this.shieldMesh.visible = false;
        this.shieldGlowMesh.visible = false;
        this.onEvent?.('shield-expire');
      } else {
        // Shield pulse & blink when about to expire
        this.shieldMesh.visible = this.shieldTimer > 2.0 || Math.floor(this.shieldTimer * 8) % 2 === 0;
        this.shieldGlowMesh.visible = this.shieldMesh.visible;
        const pulse = 1.0 + Math.sin(time * 9) * 0.06;
        this.shieldMesh.scale.setScalar(pulse);
        this.shieldGlowMesh.scale.setScalar(pulse * 1.08);
      }
    }

    // Bunny Forward Movement & Gravity
    this.bunny.position.x += this.runSpeed * delta;
    this.distance = Math.max(0, Math.floor(this.bunny.position.x));

    this.velocityY -= 18.5 * delta;
    this.bunny.position.y += this.velocityY * delta;
    this.grounded = false;

    // Squash & stretch recovery spring
    this.squashTime = Math.max(0, this.squashTime - delta * 4.5);
    const currentScaleY = THREE.MathUtils.lerp(1.0, 0.7, this.squashTime);
    const currentScaleXZ = THREE.MathUtils.lerp(1.0, 1.25, this.squashTime);
    this.modelWrapper.scale.set(currentScaleXZ, currentScaleY, currentScaleXZ);

    // Tilt bunny according to jump velocity
    const targetTilt = Math.max(-0.35, Math.min(0.35, -this.velocityY * 0.032));
    this.bunny.rotation.z += (targetTilt - this.bunny.rotation.z) * 0.2;

    // Model animation mixer update
    if (this.mixer) {
      this.mixer.update(delta);
    }

    // Camera Smooth Tracking - stable height so jumps feel epic and high
    const targetCamX = this.bunny.position.x + 3.8;
    this.camera.position.x += (targetCamX - this.camera.position.x) * 0.14;
    this.camera.position.y = 2.9;
    this.camera.position.z = 10.4;
    this.camera.lookAt(this.camera.position.x - 1.0, 1.4, 0);
    this.dirLight.position.x = this.camera.position.x + 1.2;

    // Background parallax & elements tracking
    if (this.backdropMesh) {
      this.backdropMesh.position.x = this.camera.position.x;
    }
    if (this.celestialMesh) {
      this.celestialMesh.position.x = this.camera.position.x * 0.95 + 10;
    }
    if (this.farMountainGroup) {
      this.farMountainGroup.position.x = this.camera.position.x * 0.15;
    }
    if (this.nearMountainGroup) {
      this.nearMountainGroup.position.x = this.camera.position.x * 0.35;
    }
    if (this.starsMesh) {
      this.starsMesh.position.x = this.camera.position.x * 0.98;
    }
    if (this.auroraMesh) {
      this.auroraMesh.position.x = this.camera.position.x * 0.96;
      this.auroraMesh.rotation.z = Math.sin(time * 0.6) * 0.04;
    }
    for (const cloud of this.clouds) {
      cloud.position.x += delta * (cloud.userData['speed'] || 0.5);
      if (cloud.position.x < this.camera.position.x - 45) {
        cloud.position.x = this.camera.position.x + 45 + Math.random() * 10;
      }
    }

    // Platform Collisions & Snapping
    const bunnyBottom = this.bunny.position.y;
    for (const block of this.platformBlocks) {
      const top = block.y + 0.425;
      const withinX =
        this.bunny.position.x >= block.x - block.width / 2 - 0.25 &&
        this.bunny.position.x <= block.x + block.width / 2 + 0.25;

      if (withinX && this.velocityY <= 0 && bunnyBottom <= top + 0.65 && bunnyBottom >= top - 0.8) {
        // Landing event
        if (!this.grounded && this.velocityY < -2.0) {
          this.audio.playLand();
          this.spawnDustParticles(this.bunny.position.x, top);
          this.squashTime = 1.0;
        }
        this.bunny.position.y = top;
        this.velocityY = 0;
        this.grounded = true;
        this.bunny.rotation.z = 0;
      }

      // Check Hazard Collisions
      if (block.hazard) {
        const haz = block.hazard;
        // Moving obstacle logic
        if (haz.isMoving) {
          haz.mesh.position.y = 0.42 + haz.height / 2 + Math.sin(time * haz.moveSpeed) * haz.moveRange;
          haz.y = block.y + haz.mesh.position.y;
        }

        const withinHazX = Math.abs(this.bunny.position.x - haz.x) < haz.width / 2 + 0.35;
        const withinHazY = Math.abs(this.bunny.position.y + 0.7 - haz.y) < haz.height / 2 + 0.6;

        if (withinHazX && withinHazY && this.invulnerableTimer <= 0) {
          if (this.shieldActive) {
            // Carrot Shield saves the rabbit!
            this.shieldActive = false;
            this.shieldMesh.visible = false;
            this.shieldGlowMesh.visible = false;
            this.invulnerableTimer = 0.9;
            this.audio.playShieldBreak();
            this.spawnShieldBreakParticles(this.bunny.position.x, this.bunny.position.y);
            this.onEvent?.('shield-break');
          } else {
            // Unshielded crash - stop game and show defeat modal
            this.running = false;
            this.audio.playHit();
            this.onEvent?.('hit');
            return;
          }
        }
      }

      // Check Coins Collision & Bobbing
      for (const coin of block.coins) {
        if (coin.active) {
          coin.mesh.rotation.z += delta * 3.5;
          const bob = Math.sin(time * 4.5 + coin.phase) * 0.12;
          coin.mesh.position.y = (coin.baseY - block.y) + bob;
          coin.y = coin.baseY + bob;

          const dist = Math.hypot(this.bunny.position.x - coin.x, (this.bunny.position.y + 0.7) - coin.y);
          if (dist < 0.95) {
            coin.active = false;
            coin.mesh.visible = false;
            this.score++;
            this.audio.playCoinCollect();
            this.spawnCoinParticles(coin.x, coin.y);
            this.onEvent?.('coin');
          }
        }
      }

      // Check Carrot Power-Up Collision & Bobbing
      if (block.carrot && block.carrot.active) {
        const carrot = block.carrot;
        carrot.group.rotation.y += delta * 2.8;
        carrot.group.position.y = 1.35 + Math.sin(time * 3.5 + carrot.phase) * 0.15;

        const dist = Math.hypot(this.bunny.position.x - carrot.x, (this.bunny.position.y + 0.7) - carrot.y);
        if (dist < 1.05) {
          carrot.active = false;
          carrot.group.visible = false;
          this.shieldActive = true;
          this.shieldTimer = 8.0;
          this.shieldMesh.visible = true;
          this.shieldGlowMesh.visible = true;
          this.audio.playCarrotCollect();
          this.spawnCoinParticles(carrot.x, carrot.y);
          this.onEvent?.('carrot');
        }
      }
    }

    // Goal Trophy animation
    if (this.goalTrophy) {
      this.goalTrophy.rotation.y += delta * 1.6;
    }

    // Recycle platforms going off-screen to the right
    this.recyclePlatforms();

    // Update active particles
    this.updateParticles(delta);

    // Goal Cleared Check
    if (this.bunny.position.x >= this.targetDistance) {
      this.running = false;
      this.audio.playWin();
      this.onEvent?.('won');
      return;
    }

    // Pit Fall Check - stop game and show defeat modal
    if (this.bunny.position.y < -5.5) {
      this.running = false;
      this.audio.playFall();
      this.onEvent?.('fell');
      return;
    }
  }

  /** Recycle leftmost platform that went behind camera */
  private recyclePlatforms(): void {
    // In crafted stages (levels 1 & 2), do not cull early stages to keep the world visible and stable
    if (this.level.id <= 2) return;

    const cullX = this.camera.position.x - 18;
    for (let i = 0; i < this.platformBlocks.length; i++) {
      const block = this.platformBlocks[i];
      if (block.x + block.width / 2 < cullX) {
        // Remove old platform from scene
        this.scene.remove(block.group);

        // Generate brand new platform at the front
        const newBlock = this.generateNextPlatform(Math.floor(this.rightmostX / 7));
        this.platformBlocks[i] = newBlock;
      }
    }
  }

  private updateParticles(delta: number): void {
    for (const p of this.particles) {
      if (p.active) {
        p.life += delta;
        if (p.life >= p.maxLife) {
          p.active = false;
          p.mesh.visible = false;
        } else {
          p.mesh.position.x += p.vx * delta;
          p.mesh.position.y += p.vy * delta;
          p.mesh.position.z += p.vz * delta;
          p.vy -= 9.8 * delta;
          const ratio = 1 - p.life / p.maxLife;
          (p.mesh.material as THREE.MeshBasicMaterial).opacity = ratio * 0.8;
          p.mesh.scale.setScalar(ratio);
        }
      }
    }
  }

  /** Reset bunny back to start */
  private placeBunnyAtStart(): void {
    const isTutorial = this.level.id === 1;
    const startX = isTutorial ? 1.0 : -1.0;
    this.bunny.position.set(startX, 0.45, 0);
    this.bunny.rotation.z = 0;
    this.velocityY = 0;
    this.grounded = true;
    this.jumpCooldown = 0.35;

    // Reset camera position directly framing the bunny and starting platforms
    this.camera.position.set(startX + 3.8, 2.9, 10.4);
    this.camera.lookAt(startX + 0.8, 1.4, 0);
    this.dirLight.position.set(startX + 5, 12, 9);
    if (this.backdropMesh) {
      this.backdropMesh.position.x = this.camera.position.x;
    }
    if (this.celestialMesh) {
      this.celestialMesh.position.x = this.camera.position.x * 0.95 + 10;
    }
    if (this.farMountainGroup) {
      this.farMountainGroup.position.x = this.camera.position.x * 0.15;
    }
    if (this.nearMountainGroup) {
      this.nearMountainGroup.position.x = this.camera.position.x * 0.35;
    }
  }

  private resize = (): void => {
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, true);
  };
}
