import * as THREE from 'three';
import { GameLevel } from '../models/game-level';

export type GameEvent = 'won' | 'fell' | 'hit';

export class GameEngine {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(46, 1, 0.1, 100);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly light = new THREE.DirectionalLight('#fff5e0', 2.8);
  private readonly bunny = new THREE.Group();
  private readonly platformMeshes: THREE.Mesh[] = [];
  private readonly obstacleMeshes: THREE.Mesh[] = [];
  private velocityY = 0;
  private readonly runSpeed = 3.05;
  private grounded = true;
  private jumpCooldown = 0;
  private running = false;
  private animationFrame?: number;
  private lastTimestamp = 0;
  private onEvent?: (event: GameEvent) => void;

  constructor(private readonly host: HTMLElement, private readonly level: GameLevel) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor('#0d122b');
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(this.renderer.domElement);
    this.buildScene();
    this.resize();
    window.addEventListener('resize', this.resize);
  }

  /**
   * Begin the game loop and register a callback for game events.
   * Calling start() while already running is a no-op.
   */
  start(onEvent: (event: GameEvent) => void): void {
    if (this.running) return;
    this.onEvent = onEvent;
    this.running = true;
    this.lastTimestamp = performance.now();
    this.animate();
  }

  /**
   * Trigger a jump from voice input.
   * @param voiceForce  Normalised voice amplitude [0, 1].
   *                    0 → min jump (6.6 u/s), 1 → max jump (13.6 u/s).
   */
  jump(voiceForce: number): void {
    if (!this.grounded || this.jumpCooldown > 0) return;
    this.velocityY = 6.6 + Math.min(1, voiceForce) * 7.2;
    this.grounded = false;
    this.jumpCooldown = 0.25;
  }

  /** Reposition the bunny at the start and stop the game loop. Call before start(). */
  reset(): void {
    this.running = false;
    this.placeBunnyAtStart();
  }

  dispose(): void {
    this.running = false;
    if (this.animationFrame !== undefined) cancelAnimationFrame(this.animationFrame);
    window.removeEventListener('resize', this.resize);
    this.renderer.dispose();
    this.host.replaceChildren();
  }

  // ---------------------------------------------------------------------------
  // Scene construction
  // ---------------------------------------------------------------------------

  private buildScene(): void {
    this.scene.fog = new THREE.Fog('#0d122b', 24, 65);
    this.camera.position.set(4, 7.8, 14.5);
    this.camera.lookAt(4, 1.8, 0);

    // Warm ambient and hemisphere lights for arcade vibrancy
    const hemisphere = new THREE.HemisphereLight('#c4e2ff', '#141838', 2.0);
    this.scene.add(hemisphere);

    this.light.position.set(4, 12, 8);
    this.light.castShadow = true;
    this.light.shadow.mapSize.set(1024, 1024);
    this.scene.add(this.light);

    // Sky backdrop with subtle space tones
    const backdrop = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 45),
      new THREE.MeshBasicMaterial({ color: '#090d24' }),
    );
    backdrop.position.set(25, 8, -8);
    this.scene.add(backdrop);

    // Build Level Platforms
    this.level.platforms.forEach((platform, idx) => {
      // Main platform block
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(platform.width, 0.75, 3.4),
        new THREE.MeshStandardMaterial({
          color: this.level.accent,
          roughness: 0.45,
          metalness: 0.15,
        }),
      );
      mesh.position.set(platform.x, platform.y, 0);
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      mesh.userData['spec'] = platform;
      this.platformMeshes.push(mesh);
      this.scene.add(mesh);

      // Platform neon top glowing plate
      const topPlate = new THREE.Mesh(
        new THREE.BoxGeometry(platform.width - 0.05, 0.08, 3.25),
        new THREE.MeshStandardMaterial({
          color: '#ffffff',
          emissive: this.level.accent,
          emissiveIntensity: 0.35,
          roughness: 0.2,
        }),
      );
      topPlate.position.set(platform.x, platform.y + 0.38, 0);
      this.scene.add(topPlate);

      // If final goal platform, add victory carrot trophy
      if (idx === this.level.platforms.length - 1) {
        this.buildGoalTrophy(platform.x, platform.y + 0.75);
      }
    });

    // Build Obstacles (Spikes / Red Hazard Blocks)
    this.level.obstacles.forEach((obstacle) => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(obstacle.width, obstacle.height, 2.2),
        new THREE.MeshStandardMaterial({
          color: '#ff2a6d',
          emissive: '#aa0033',
          emissiveIntensity: 0.4,
          roughness: 0.3,
        }),
      );
      mesh.position.set(obstacle.x, obstacle.height / 2 + 0.37, 0);
      mesh.castShadow = true;
      mesh.userData['spec'] = obstacle;
      this.obstacleMeshes.push(mesh);
      this.scene.add(mesh);
    });

    this.buildBunny();
    this.placeBunnyAtStart();
  }

  /** Create celebratory carrot trophy on final platform */
  private buildGoalTrophy(x: number, y: number): void {
    const trophy = new THREE.Group();
    // Carrot cone
    const carrotGeo = new THREE.ConeGeometry(0.35, 1.1, 16);
    const carrotMat = new THREE.MeshStandardMaterial({ color: '#ff7700', roughness: 0.3 });
    const carrot = new THREE.Mesh(carrotGeo, carrotMat);
    carrot.rotation.x = Math.PI; // point down
    carrot.position.y = 0.55;
    trophy.add(carrot);

    // Leaves
    const leafGeo = new THREE.ConeGeometry(0.12, 0.45, 8);
    const leafMat = new THREE.MeshStandardMaterial({ color: '#33cc33', roughness: 0.3 });
    for (let i = 0; i < 3; i++) {
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.position.set((i - 1) * 0.12, 1.15, 0);
      leaf.rotation.z = (i - 1) * 0.3;
      trophy.add(leaf);
    }

    trophy.position.set(x, y, 0);
    this.scene.add(trophy);
  }

  /** Build expressive, cute 3D bunny mascot */
  private buildBunny(): void {
    const fur = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.65 });
    const innerPink = new THREE.MeshStandardMaterial({ color: '#ff9abf', roughness: 0.5 });
    const darkEye = new THREE.MeshStandardMaterial({ color: '#16192b', roughness: 0.1 });
    const eyeHighlight = new THREE.MeshBasicMaterial({ color: '#ffffff' });

    // Body
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.62, 22, 18), fur);
    body.scale.set(1, 1.12, 0.88);
    body.position.y = 0.55;
    body.castShadow = true;

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.46, 20, 16), fur);
    head.position.set(0.42, 1.18, 0);
    head.castShadow = true;

    // Big expressive eyes
    const eyeGeo = new THREE.SphereGeometry(0.16, 16, 12);
    const eyeL = new THREE.Mesh(eyeGeo, darkEye);
    eyeL.position.set(0.72, 1.28, -0.2);
    const eyeR = eyeL.clone();
    eyeR.position.z = 0.2;

    // White shine gleam on eyes
    const shineGeo = new THREE.SphereGeometry(0.05, 8, 8);
    const shineL = new THREE.Mesh(shineGeo, eyeHighlight);
    shineL.position.set(0.82, 1.34, -0.22);
    const shineR = shineL.clone();
    shineR.position.z = 0.18;

    // Nose
    const noseGeo = new THREE.SphereGeometry(0.07, 10, 8);
    const nose = new THREE.Mesh(noseGeo, innerPink);
    nose.position.set(0.84, 1.14, 0);

    // Front Teeth
    const toothGeo = new THREE.BoxGeometry(0.06, 0.1, 0.08);
    const tooth = new THREE.Mesh(toothGeo, eyeHighlight);
    tooth.position.set(0.81, 1.04, 0);

    // Big Ears
    const earGeo = new THREE.CapsuleGeometry(0.13, 0.68, 6, 14);
    const leftEar = new THREE.Mesh(earGeo, fur);
    leftEar.position.set(0.24, 1.82, -0.2);
    leftEar.rotation.z = -0.2;

    const leftInner = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.52, 6, 10), innerPink);
    leftInner.position.set(0.25, 1.82, -0.19);
    leftInner.rotation.z = -0.2;

    const rightEar = leftEar.clone();
    rightEar.position.z = 0.2;
    rightEar.rotation.z = 0.2;

    const rightInner = leftInner.clone();
    rightInner.position.z = 0.19;
    rightInner.rotation.z = 0.2;

    // Fluffy tail
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 12), innerPink);
    tail.position.set(-0.58, 0.65, 0);

    [body, head, eyeL, eyeR, shineL, shineR, nose, tooth, leftEar, leftInner, rightEar, rightInner, tail].forEach(
      (part) => {
        part.castShadow = true;
        this.bunny.add(part);
      },
    );

    this.scene.add(this.bunny);
  }

  // ---------------------------------------------------------------------------
  // Game loop
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
    this.jumpCooldown = Math.max(0, this.jumpCooldown - delta);

    // Move bunny right and apply gravity
    this.bunny.position.x += this.runSpeed * delta;
    this.velocityY -= 17.5 * delta;
    this.bunny.position.y += this.velocityY * delta;
    this.grounded = false;
    this.bunny.rotation.z = Math.max(-0.32, Math.min(0.32, -this.velocityY * 0.035));

    // Dynamic camera smooth follow
    const targetCamX = this.bunny.position.x + 5.2;
    this.camera.position.x += (targetCamX - this.camera.position.x) * 0.12;
    this.camera.lookAt(this.camera.position.x - 1.2, 2.0, 0);
    this.light.position.x = this.camera.position.x - 1.5;

    // Platform collision — snap onto top surface when falling
    for (const platform of this.platformMeshes) {
      const spec = platform.userData['spec'] as { x: number; y: number; width: number };
      const top = spec.y + 0.375;
      const withinX =
        this.bunny.position.x > spec.x - spec.width / 2 + 0.2 &&
        this.bunny.position.x < spec.x + spec.width / 2 - 0.2;
      if (
        withinX &&
        this.velocityY <= 0 &&
        this.bunny.position.y <= top + 0.85 &&
        this.bunny.position.y >= top + 0.15
      ) {
        this.bunny.position.y = top + 0.85;
        this.velocityY = 0;
        this.grounded = true;
        this.bunny.rotation.z = 0;
      }
    }

    // Obstacle collision — touching a red block respawns the bunny
    for (const obstacle of this.obstacleMeshes) {
      const spec = obstacle.userData['spec'] as { x: number; width: number; height: number };
      const halfW = spec.width / 2 + 0.34;
      const withinX = Math.abs(this.bunny.position.x - spec.x) < halfW;
      const belowTop = this.bunny.position.y < spec.height + 0.85;
      if (withinX && belowTop) {
        this.onEvent?.('hit');
        this.placeBunnyAtStart();
        return;
      }
    }

    // Win — bunny clears the end of the last platform
    const goal = this.level.platforms[this.level.platforms.length - 1];
    if (this.bunny.position.x > goal.x + goal.width / 2 - 0.2) {
      this.running = false;
      this.onEvent?.('won');
      return;
    }

    // Fall — bunny dropped below the scene
    if (this.bunny.position.y < -5) {
      this.onEvent?.('fell');
      this.placeBunnyAtStart();
    }
  }

  /** Teleport the bunny back to the start position, keeping physics clean. */
  private placeBunnyAtStart(): void {
    this.bunny.position.set(-2.4, 1.05, 0);
    this.bunny.rotation.z = 0;
    this.velocityY = 0;
    this.grounded = true;
    this.jumpCooldown = 0.4;

    // Reset camera position to initial framing
    this.camera.position.set(4, 7.8, 14.5);
    this.camera.lookAt(4, 1.8, 0);
    this.light.position.set(4, 12, 8);
  }

  private resize = (): void => {
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  };
}
