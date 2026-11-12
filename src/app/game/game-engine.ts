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
  private readonly targetDistance = 140;

  constructor(private readonly host: HTMLElement, private readonly level: GameLevel) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor('#0a0e27');
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    host.appendChild(this.renderer.domElement);

    this.buildScene();
    this.initParticles();
    this.loadBunnyModel();
    this.resize();
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

  /** Reposition everything at the beginning and clear state */
  reset(): void {
    this.running = false;
    this.score = 0;
    this.distance = 0;
    this.shieldActive = false;
    this.shieldTimer = 0;
    this.invulnerableTimer = 0;
    if (this.shieldMesh) this.shieldMesh.visible = false;
    if (this.shieldGlowMesh) this.shieldGlowMesh.visible = false;

    this.rebuildAllPlatforms();
    this.placeBunnyAtStart();
  }

  dispose(): void {
    this.running = false;
    if (this.animationFrame !== undefined) cancelAnimationFrame(this.animationFrame);
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('keydown', this.handleKeyDown);
    this.audio.dispose();
    this.renderer.dispose();
    this.host.replaceChildren();
  }

  // ---------------------------------------------------------------------------
  // Scene Construction
  // ---------------------------------------------------------------------------

  private buildScene(): void {
    this.scene.fog = new THREE.Fog('#0a0e27', 26, 75);

    // Camera initial framing
    this.camera.position.set(4, 7.6, 14.2);
    this.camera.lookAt(4, 1.8, 0);

    // Dynamic Lighting
    this.scene.add(this.ambientLight);
    this.scene.add(this.hemisphereLight);

    this.dirLight.position.set(6, 14, 10);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.set(1024, 1024);
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 40;
    this.dirLight.shadow.camera.left = -15;
    this.dirLight.shadow.camera.right = 15;
    this.dirLight.shadow.camera.top = 15;
    this.dirLight.shadow.camera.bottom = -10;
    this.scene.add(this.dirLight);

    // Deep Space Backdrop with star grid illusion
    const backdropGeo = new THREE.PlaneGeometry(160, 60);
    const backdropMat = new THREE.MeshBasicMaterial({ color: '#070a1e' });
    const backdrop = new THREE.Mesh(backdropGeo, backdropMat);
    backdrop.position.set(30, 10, -14);
    this.scene.add(backdrop);

    // Build Shield meshes
    this.buildShieldVisuals();

    // Setup Bunny container
    this.bunny.add(this.modelWrapper);
    this.buildFallbackBunny();
    this.scene.add(this.bunny);

    // Initial platform generation
    this.rebuildAllPlatforms();
    this.placeBunnyAtStart();
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
      },
      undefined,
      (err) => {
        console.warn('Could not load bunny GLB model, using arcade fallback:', err);
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

    // Start with safe spawn platform
    this.rightmostX = -3;
    const initialWidth = 9.5;
    const startPlatform = this.createPlatformBlock(0, 0, initialWidth, false, false, false);
    this.platformBlocks.push(startPlatform);
    this.rightmostX = startPlatform.x + startPlatform.width / 2;

    // Generate pool of ~14 forward platforms
    for (let i = 1; i < 14; i++) {
      const p = this.generateNextPlatform(i);
      this.platformBlocks.push(p);
    }
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
  ): PlatformBlock {
    const group = new THREE.Group();
    group.position.set(x, y, 0);

    // Main 3D platform body
    const baseGeo = new THREE.BoxGeometry(width, 0.85, 3.4);
    const baseMat = new THREE.MeshStandardMaterial({
      color: this.level.accent,
      roughness: 0.4,
      metalness: 0.18,
    });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    group.add(baseMesh);

    // Glowing Neon top plate
    const topPlateGeo = new THREE.BoxGeometry(width - 0.08, 0.1, 3.25);
    const topPlateMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      emissive: this.level.accent,
      emissiveIntensity: 0.4,
      roughness: 0.2,
    });
    const topPlate = new THREE.Mesh(topPlateGeo, topPlateMat);
    topPlate.position.y = 0.43;
    group.add(topPlate);

    let hazard: HazardBlock | undefined;
    const coins: CoinItem[] = [];
    let carrot: CarrotItem | undefined;

    // Spawn Hazards (Spikes / Moving blocks)
    if (hasHazard && width > 4.0) {
      const isMoving = this.level.id >= 3 && Math.random() < 0.4;
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
      baseMesh,
      topPlate,
      x,
      y,
      width,
      hazard,
      coins,
      carrot,
    };
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

    // Camera Smooth Tracking
    const targetCamX = this.bunny.position.x + 5.0;
    this.camera.position.x += (targetCamX - this.camera.position.x) * 0.14;
    this.camera.lookAt(this.camera.position.x - 1.2, 2.0, 0);
    this.dirLight.position.x = this.camera.position.x - 1.5;

    // Platform Collisions & Snapping
    const bunnyBottom = this.bunny.position.y;
    for (const block of this.platformBlocks) {
      const top = block.y + 0.425;
      const withinX =
        this.bunny.position.x > block.x - block.width / 2 + 0.15 &&
        this.bunny.position.x < block.x + block.width / 2 - 0.15;

      if (withinX && this.velocityY <= 0 && bunnyBottom <= top + 0.45 && bunnyBottom >= top - 0.35) {
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
            // Unshielded crash
            this.audio.playHit();
            this.onEvent?.('hit');
            this.placeBunnyAtStart();
            return;
          }
        }
      }

      // Check Coins Collision & Bobbing
      for (const coin of block.coins) {
        if (coin.active) {
          coin.mesh.rotation.z += delta * 3.5;
          coin.mesh.position.y = 1.25 + Math.sin(time * 4.5 + coin.phase) * 0.14;

          const dist = Math.hypot(this.bunny.position.x - coin.x, (this.bunny.position.y + 0.7) - coin.y);
          if (dist < 0.9) {
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

    // Pit Fall Check
    if (this.bunny.position.y < -5.5) {
      this.audio.playFall();
      this.onEvent?.('fell');
      this.placeBunnyAtStart();
    }
  }

  /** Recycle leftmost platform that went behind camera */
  private recyclePlatforms(): void {
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
    this.bunny.position.set(-2.0, 1.1, 0);
    this.bunny.rotation.z = 0;
    this.velocityY = 0;
    this.grounded = true;
    this.jumpCooldown = 0.35;

    // Reset camera position
    this.camera.position.set(4, 7.6, 14.2);
    this.camera.lookAt(4, 1.8, 0);
    this.dirLight.position.set(6, 14, 10);
  }

  private resize = (): void => {
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  };
}
