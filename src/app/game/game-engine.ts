import * as THREE from 'three';
import { GameLevel } from '../models/game-level';

export type GameEvent = 'won' | 'fell' | 'hit';

export class GameEngine {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
  private readonly renderer: THREE.WebGLRenderer;
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
    this.renderer.setClearColor('#111514');
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
    this.velocityY = 6.6 + Math.min(1, voiceForce) * 7;
    this.grounded = false;
    this.jumpCooldown = 0.26;
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
    this.scene.fog = new THREE.Fog('#111514', 17, 45);
    this.camera.position.set(8, 8.2, 15);
    this.camera.lookAt(8, 1, 0);

    const hemisphere = new THREE.HemisphereLight('#d6ffff', '#172220', 1.9);
    this.scene.add(hemisphere);
    const light = new THREE.DirectionalLight('#fff3c4', 2.5);
    light.position.set(6, 12, 8);
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    this.scene.add(light);

    const backdrop = new THREE.Mesh(
      new THREE.PlaneGeometry(90, 35),
      new THREE.MeshBasicMaterial({ color: '#111e1d' }),
    );
    backdrop.position.set(19, 8, -6);
    this.scene.add(backdrop);

    this.level.platforms.forEach((platform) => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(platform.width, 0.75, 3.3),
        new THREE.MeshStandardMaterial({ color: this.level.accent, roughness: 0.72, metalness: 0.08 }),
      );
      mesh.position.set(platform.x, platform.y, 0);
      mesh.receiveShadow = true;
      mesh.castShadow = true;
      mesh.userData['spec'] = platform;
      this.platformMeshes.push(mesh);
      this.scene.add(mesh);
    });

    this.level.obstacles.forEach((obstacle) => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(obstacle.width, obstacle.height, 2.15),
        new THREE.MeshStandardMaterial({ color: '#fc6f62', roughness: 0.5 }),
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

  private buildBunny(): void {
    const fur = new THREE.MeshStandardMaterial({ color: '#f2f0e7', roughness: 0.85 });
    const pink = new THREE.MeshStandardMaterial({ color: '#ffb7c5', roughness: 0.9 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.62, 22, 18), fur);
    body.scale.set(1, 1.12, 0.85);
    body.position.y = 0.55;
    body.castShadow = true;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.44, 20, 16), fur);
    head.position.set(0.4, 1.15, 0);
    head.castShadow = true;
    const ear = new THREE.CapsuleGeometry(0.12, 0.6, 5, 12);
    const leftEar = new THREE.Mesh(ear, fur);
    leftEar.position.set(0.22, 1.76, -0.18);
    leftEar.rotation.z = -0.18;
    const rightEar = leftEar.clone();
    rightEar.position.z = 0.18;
    rightEar.rotation.z = 0.18;
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.23, 12, 10), pink);
    tail.position.set(-0.58, 0.65, 0);
    [body, head, leftEar, rightEar, tail].forEach((part) => {
      part.castShadow = true;
      this.bunny.add(part);
    });
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
    this.bunny.rotation.z = Math.max(-0.3, Math.min(0.3, -this.velocityY * 0.035));

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
      const halfW = spec.width / 2 + 0.34; // 0.34 ≈ bunny body half-width
      const withinX = Math.abs(this.bunny.position.x - spec.x) < halfW;
      const belowTop = this.bunny.position.y < spec.height + 0.85;
      if (withinX && belowTop) {
        this.onEvent?.('hit');
        this.placeBunnyAtStart(); // respawn without stopping the loop
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
      this.placeBunnyAtStart(); // respawn without stopping the loop
    }
  }

  /** Teleport the bunny back to the start position, keeping physics clean. */
  private placeBunnyAtStart(): void {
    this.bunny.position.set(-2.4, 1.05, 0);
    this.bunny.rotation.z = 0;
    this.velocityY = 0;
    this.grounded = true;
    this.jumpCooldown = 0.4; // brief grace period so the player can react
  }

  private resize = (): void => {
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  };
}
