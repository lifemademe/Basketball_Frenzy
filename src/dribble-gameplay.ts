import * as ENGINE from '@gnsx/genesys.js';
import * as THREE from 'three';

import { DribbleBall } from './dribble-ball.js';
import { DribbleImpactBurst } from './dribble-impact-burst.js';
import { DribbleOverlay } from './dribble-overlay.js';
import { DribbleJuiceHud, DribbleLivesDisplay, DribbleTimingMeter } from './dribble-status-hud.js';
import { DribbleTarget } from './dribble-target.js';

type DribbleGameState = 'playing' | 'paused' | 'gameOver';

@ENGINE.GameClass()
export class DribbleGameplayManager extends ENGINE.Actor {
  private ball: DribbleBall | null = null;
  private scoreDisplay: ENGINE.NumberDisplay | null = null;
  private livesDisplay: DribbleLivesDisplay | null = null;
  private crosshair: ENGINE.Crosshair | null = null;
  private timingMeter: DribbleTimingMeter | null = null;
  private juiceHud: DribbleJuiceHud | null = null;
  private comboDisplay: ENGINE.Badge | null = null;
  private hitFeedback: ENGINE.Badge | null = null;
  private overlay: DribbleOverlay | null = null;
  private spawnTimer = 0.9;
  private elapsedTime = 0;
  private score = 0;
  private lives = 3;
  private combo = 0;
  private frenzyCharge = 0;
  private frenzyTimeRemaining = 0;
  private gameState: DribbleGameState = 'playing';
  private feedbackTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly lanes = [-0.95, 0, 0.95];
  private readonly frenzyHitsRequired = 6;
  private readonly frenzyDuration = 8;

  public handleLeftClick(): void {
    if (this.gameState !== 'playing') return;
    const ballState = this.ball?.getState();
    if (ballState?.side === 'left') this.ball?.boostLeft();
    else this.ball?.transferToLeft();
  }

  public handleRightClick(): void {
    if (this.gameState !== 'playing') return;
    const ballState = this.ball?.getState();
    if (ballState?.side === 'right') this.ball?.boostRight();
    else this.ball?.transferToRight();
  }

  public togglePause(): void {
    if (this.gameState === 'gameOver') {
      return;
    }

    if (this.gameState === 'paused') {
      this.resumeRun();
    } else {
      this.pauseRun();
    }
  }

  public restartRun(): void {
    const world = this.getWorld();
    if (!world) {
      return;
    }

    for (const target of world.getActors(DribbleTarget)) {
      target.destroy();
    }
    for (const burst of world.getActors(DribbleImpactBurst)) {
      burst.destroy();
    }

    this.gameState = 'playing';
    this.spawnTimer = 0.7;
    this.elapsedTime = 0;
    this.score = 0;
    this.lives = 3;
    this.combo = 0;
    this.frenzyCharge = 0;
    this.frenzyTimeRemaining = 0;
    this.ball?.reset();
    this.ball?.setGameplayActive(true);
    this.scoreDisplay?.setValue(0, false);
    this.scoreDisplay?.setTrend(null);
    this.livesDisplay?.setLives(this.lives);
    this.comboDisplay?.hide();
    this.hitFeedback?.hide();
    this.timingMeter?.setTiming(0, false, false);
    this.juiceHud?.setFrenzy(0, 0, false);
    this.overlay?.hide();
    this.setHudVisible(true);
    world.inputManager.requestPointerLock({ unadjustedMovement: true });
  }

  public override tickPrePhysics(deltaTime: number): void {
    super.tickPrePhysics(deltaTime);
    if (this.gameState !== 'playing') {
      return;
    }

    this.elapsedTime += deltaTime;
    this.updateFrenzy(deltaTime);
    this.spawnTimer -= deltaTime;
    if (this.spawnTimer <= 0) {
      this.spawnTarget();
      const baseInterval = Math.max(0.5, 1.08 - this.elapsedTime * 0.004);
      this.spawnTimer = THREE.MathUtils.randFloat(baseInterval * 0.8, baseInterval * 1.15);
    }

    this.updateTimingMeter();
    this.checkBallTargetHits();
  }

  protected override doBeginPlay(): void {
    super.doBeginPlay();
    this.setupArena();
    void this.setupHud();
  }

  protected override doEndPlay(): void {
    if (this.feedbackTimer) {
      clearTimeout(this.feedbackTimer);
      this.feedbackTimer = null;
    }
    this.scoreDisplay?.destroy();
    this.livesDisplay?.destroy();
    this.crosshair?.destroy();
    this.timingMeter?.destroy();
    this.juiceHud?.destroy();
    this.comboDisplay?.destroy();
    this.hitFeedback?.destroy();
    this.overlay?.destroy();
    this.scoreDisplay = null;
    this.livesDisplay = null;
    this.crosshair = null;
    this.timingMeter = null;
    this.juiceHud = null;
    this.comboDisplay = null;
    this.hitFeedback = null;
    this.overlay = null;
    super.doEndPlay();
  }

  private setupArena(): void {
    const world = this.getWorld();
    if (!world || this.ball) {
      return;
    }

    world.addBox({
      position: new THREE.Vector3(0, -0.08, -7),
      width: 3.6,
      height: 0.16,
      depth: 30,
      color: 0x2f3437,
    }).setName('Dribble Court Floor');

    world.addBox({
      position: new THREE.Vector3(0, 0.02, -1.85),
      width: 0.12,
      height: 0.04,
      depth: 0.8,
      color: 0xf5f5f5,
    }).setName('Center Bounce Mark');

    for (const laneX of this.lanes) {
      world.addBox({
        position: new THREE.Vector3(laneX, 0.02, -8),
        width: 0.035,
        height: 0.04,
        depth: 30,
        color: laneX === 0 ? 0xd7ff43 : 0x8e8e93,
      }).setName(`Lane Guide ${laneX}`);
    }

    this.addHand(world, 'Left Hand', this.lanes[0], 0x4a90e2);
    this.addHand(world, 'Right Hand', this.lanes[2], 0xff9f0a);
    this.addLights(world);

    this.ball = DribbleBall.create({ name: 'Dribble Ball' });
    world.addActor(this.ball);
  }

  private async setupHud(): Promise<void> {
    const world = this.getWorld();
    if (!world || this.scoreDisplay) {
      return;
    }

    this.scoreDisplay = new ENGINE.NumberDisplay(world.uiManager, {
      position: 'top-left',
      label: 'Score',
      initialValue: 0,
      animate: true,
      iconHtml: '<span>PTS</span>',
    });
    this.livesDisplay = new DribbleLivesDisplay(world.uiManager, {
      position: 'top-right',
      initialLives: this.lives,
      maxLives: 3,
    });
    this.crosshair = new ENGINE.Crosshair(world.uiManager, {
      ...ENGINE.Crosshair.presets.bracket,
      size: 42,
      color: '#d7ff43',
      accentColor: '#ffffff',
    });
    this.timingMeter = new DribbleTimingMeter(world.uiManager, {
      position: 'bottom-center',
    });
    this.juiceHud = new DribbleJuiceHud(world.uiManager, {
      position: 'top-center',
    });
    this.comboDisplay = new ENGINE.Badge(world.uiManager, {
      ...ENGINE.Badge.presets.yellowLarge,
      position: 'bottom-right',
      visible: false,
      label: 'COMBO x2',
      dot: true,
    });
    this.hitFeedback = new ENGINE.Badge(world.uiManager, {
      ...ENGINE.Badge.presets.greenLarge,
      position: 'bottom-left',
      visible: false,
      label: '+10',
      dot: true,
    });
    this.overlay = new DribbleOverlay(world.uiManager, {
      onResume: () => this.resumeRun(),
      onRestart: () => this.restartRun(),
    });

    await Promise.all([
      this.scoreDisplay.initialize(),
      this.livesDisplay.initialize(),
      this.crosshair.initialize(),
      this.timingMeter.initialize(),
      this.juiceHud.initialize(),
      this.comboDisplay.initialize(),
      this.hitFeedback.initialize(),
      this.overlay.initialize(),
    ]);
    this.scoreDisplay.setPosition({
      'width': 'auto',
      'height': 'auto',
      'padding': '0',
      'border-color': 'transparent',
      'background-color': 'transparent',
      'box-shadow': 'none',
      'pointer-events': 'none',
    }, '.ui-number-display');
    this.syncUiState();
  }

  private addHand(world: ENGINE.World, name: string, x: number, color: THREE.ColorRepresentation): void {
    if (world.getActorByName(name)) {
      return;
    }

    const palm = world.addSphere({
      position: new THREE.Vector3(x, 1.32, -1.08),
      radius: 0.18,
      color,
    });
    palm.setName(name);

    const wrist = ENGINE.MeshComponent.create({
      name: 'Wrist Mesh',
      geometry: new THREE.CapsuleGeometry(0.08, 0.42, 8, 16),
      material: new THREE.MeshStandardMaterial({ color, roughness: 0.65 }),
      position: new THREE.Vector3(0, -0.18, 0.18),
      rotation: new THREE.Euler(Math.PI * 0.62, 0, 0),
    });
    palm.addComponent(wrist);
  }

  private addLights(world: ENGINE.World): void {
    const keyLight = ENGINE.Actor.create({
      name: 'Dribble Key Light',
      rootComponent: ENGINE.DirectionalLightComponent.create({
        color: 0xffffff,
        intensity: 3.2,
        castShadow: true,
        position: new THREE.Vector3(-4, 7, 4),
      }),
    });
    keyLight.rootComponent.lookAt(new THREE.Vector3(0, 0, -7));

    const ambient = ENGINE.Actor.create({
      name: 'Dribble Ambient Light',
      rootComponent: ENGINE.AmbientLightComponent.create({
        color: 0x9fb7ff,
        intensity: 0.72,
      }),
    });

    world.addActors(keyLight, ambient);
  }

  private spawnTarget(): void {
    const world = this.getWorld();
    if (!world) {
      return;
    }

    const bonusTarget = Math.random() < 0.065;
    const kindRoll = Math.random();
    const kind = bonusTarget
      ? 'bonus'
      : this.frenzyTimeRemaining > 0
        ? 'score'
      : this.lives < 3 && kindRoll < 0.12
        ? 'health'
        : kindRoll < 0.72
          ? 'score'
          : 'hazard';
    const availableLanes = kind === 'bonus' ? [this.lanes[0], this.lanes[2]] : this.lanes;
    const laneX = availableLanes[Math.floor(Math.random() * availableLanes.length)];
    const speedBonus = Math.min(2.6, this.elapsedTime * 0.025);
    const target = DribbleTarget.create({
      name: kind === 'score'
        ? 'Score Target'
        : kind === 'health'
          ? 'Health Target'
          : kind === 'bonus'
            ? 'Bonus Star Target'
            : 'Hazard Target',
      kind,
      laneX,
      speed: THREE.MathUtils.randFloat(3.2, 4.8) + speedBonus,
      position: new THREE.Vector3(
        laneX,
        kind === 'bonus' ? 2.45 : THREE.MathUtils.randFloat(0.24, 0.68),
        -18,
      ),
    });
    world.addActor(target);
  }

  private updateTimingMeter(): void {
    const world = this.getWorld();
    const ballState = this.ball?.getState();
    if (!world || !ballState || !this.timingMeter) {
      return;
    }

    const transferToCenterTime = DribbleBall.transferDuration * 0.5;
    const centerBounceZ = -1.85;
    const timingTolerance = 0.48;
    const trackingSpan = 4;
    const candidates = world.getActors(DribbleTarget)
      .filter(target => target.kind === 'score' && Math.abs(target.laneX) <= 0.01)
      .map(target => {
        const switchZ = centerBounceZ - target.getApproachSpeed() * transferToCenterTime;
        return target.getWorldPosition().z - switchZ;
      })
      .filter(error => Math.abs(error) <= trackingSpan)
      .sort((a, b) => Math.abs(a) - Math.abs(b));

    const candidate = candidates[0];
    if (candidate === undefined) {
      this.timingMeter.setTiming(0, false, false);
      return;
    }

    const progress = 0.5 + candidate / (trackingSpan * 2);
    const ready = !ballState.isTransferring && !ballState.isBoosting && Math.abs(candidate) <= timingTolerance;
    this.timingMeter.setTiming(progress, true, ready);
  }

  private checkBallTargetHits(): void {
    const world = this.getWorld();
    const ballState = this.ball?.getState();
    if (!world || !ballState) {
      return;
    }

    for (const target of world.getActors(DribbleTarget)) {
      const hitDistance = target.radius + ballState.radius;
      if (target.getWorldPosition().distanceTo(ballState.position) > hitDistance) {
        continue;
      }

      if (!target.consumeHit()) {
        continue;
      }

      const hitPosition = target.getWorldPosition().clone();
      if (target.kind === 'score') {
        this.handleScoreHit(hitPosition);
      } else if (target.kind === 'bonus') {
        this.handleBonusHit(hitPosition);
      } else if (target.kind === 'health') {
        this.handleHealthHit(hitPosition);
      } else {
        this.handleHazardHit(hitPosition);
      }
      target.destroy();

      if (this.gameState === 'gameOver') {
        break;
      }
    }
  }

  private handleScoreHit(position: THREE.Vector3): void {
    this.handleGoodHit(position, 10, false);
  }

  private handleBonusHit(position: THREE.Vector3): void {
    this.handleGoodHit(position, 50, true);
  }

  private handleGoodHit(position: THREE.Vector3, basePoints: number, bonus: boolean): void {
    const world = this.getWorld();
    if (!world) {
      return;
    }

    this.combo = Math.min(this.combo + 1, 8);
    if (this.frenzyTimeRemaining <= 0) {
      this.frenzyCharge += 1;
    }
    const points = basePoints * this.combo;
    this.score += points;
    this.scoreDisplay?.setValue(this.score, true);
    this.updateComboDisplay();
    this.showHitFeedback(`+${points}${this.combo > 1 ? `  COMBO x${this.combo}` : ''}`, 'green');
    this.spawnImpactBurst(position, bonus ? 0xffca3a : 0x59df86);
    if (this.frenzyCharge >= this.frenzyHitsRequired && this.frenzyTimeRemaining <= 0) {
      this.activateFrenzy();
    } else if (bonus) {
      this.juiceHud?.showPraise('STAR POWER!', 'gold');
    } else {
      this.showScorePraise();
    }
    void world.globalAudioManager.playGlobalSound('@engine/assets/sounds/pickup.mp3', {
      volume: bonus ? 0.86 : 0.62,
      bus: 'SFX',
    });
  }

  private handleHazardHit(position: THREE.Vector3): void {
    const world = this.getWorld();
    if (!world) {
      return;
    }

    this.lives = Math.max(0, this.lives - 1);
    this.combo = 0;
    this.frenzyCharge = 0;
    this.livesDisplay?.setLives(this.lives);
    this.updateComboDisplay();
    this.showHitFeedback('LIFE LOST', 'red');
    this.spawnImpactBurst(position, 0xff453a);
    void world.globalAudioManager.playGlobalSound('@engine/assets/sounds/explosion.mp3', {
      volume: 0.48,
      bus: 'SFX',
    });

    if (this.lives <= 0) {
      this.endRun();
    }
  }

  private handleHealthHit(position: THREE.Vector3): void {
    const world = this.getWorld();
    if (!world) {
      return;
    }

    this.lives = Math.min(3, this.lives + 1);
    this.livesDisplay?.setLives(this.lives);
    this.showHitFeedback('+1 HEART', 'green');
    this.spawnImpactBurst(position, 0x4de6b8);
    void world.globalAudioManager.playGlobalSound('@engine/assets/sounds/pickup.mp3', {
      volume: 0.78,
      bus: 'SFX',
    });
  }

  private spawnImpactBurst(position: THREE.Vector3, color: THREE.ColorRepresentation): void {
    const world = this.getWorld();
    if (!world) {
      return;
    }
    world.addActor(DribbleImpactBurst.create({
      name: 'Target Impact Burst',
      position,
      color,
    }));
  }

  private activateFrenzy(): void {
    this.frenzyCharge = 0;
    this.frenzyTimeRemaining = this.frenzyDuration;
    this.juiceHud?.setFrenzy(1, this.frenzyTimeRemaining, true);
    this.juiceHud?.showPraise('FRENZY!', 'gold');
  }

  private updateFrenzy(deltaTime: number): void {
    if (this.frenzyTimeRemaining <= 0) {
      return;
    }
    this.frenzyTimeRemaining = Math.max(0, this.frenzyTimeRemaining - deltaTime);
    const active = this.frenzyTimeRemaining > 0;
    this.juiceHud?.setFrenzy(
      this.frenzyTimeRemaining / this.frenzyDuration,
      this.frenzyTimeRemaining,
      active,
    );
  }

  private showScorePraise(): void {
    const praise = this.combo >= 5
      ? ['WOW!', 'UNREAL!', 'PERFECT!']
      : ['NICE!', 'COOL!', 'SWEET!', 'GREAT!'];
    const label = praise[Math.floor(Math.random() * praise.length)];
    this.juiceHud?.showPraise(label, this.combo >= 3 ? 'gold' : 'green');
  }

  private showHitFeedback(label: string, color: 'green' | 'red'): void {
    if (!this.hitFeedback) {
      return;
    }
    if (this.feedbackTimer) {
      clearTimeout(this.feedbackTimer);
    }
    this.hitFeedback.setColor(color);
    this.hitFeedback.setLabel(label);
    this.hitFeedback.show();
    this.feedbackTimer = setTimeout(() => {
      this.hitFeedback?.hide();
      this.feedbackTimer = null;
    }, 700);
  }

  private updateComboDisplay(): void {
    if (!this.comboDisplay) {
      return;
    }
    if (this.combo < 2 || this.gameState !== 'playing') {
      this.comboDisplay.hide();
      return;
    }
    this.comboDisplay.setLabel(`COMBO x${this.combo}`);
    this.comboDisplay.setColor(this.combo >= 5 ? 'green' : 'yellow');
    this.comboDisplay.show();
  }

  private pauseRun(): void {
    const world = this.getWorld();
    if (!world || this.gameState !== 'playing') {
      return;
    }
    this.gameState = 'paused';
    this.setGameplayActive(false);
    this.setHudVisible(false);
    this.overlay?.showPause(this.score);
    world.inputManager.exitPointerLock();
  }

  private resumeRun(): void {
    const world = this.getWorld();
    if (!world || this.gameState !== 'paused') {
      return;
    }
    this.gameState = 'playing';
    this.setGameplayActive(true);
    this.overlay?.hide();
    this.setHudVisible(true);
    this.updateComboDisplay();
    world.inputManager.requestPointerLock({ unadjustedMovement: true });
  }

  private endRun(): void {
    const world = this.getWorld();
    if (!world) {
      return;
    }
    this.gameState = 'gameOver';
    this.setGameplayActive(false);
    this.setHudVisible(false);
    this.overlay?.showGameOver(this.score);
    world.inputManager.exitPointerLock();
  }

  private setGameplayActive(active: boolean): void {
    const world = this.getWorld();
    this.ball?.setGameplayActive(active);
    if (!world) {
      return;
    }
    for (const target of world.getActors(DribbleTarget)) {
      target.setGameplayActive(active);
    }
    for (const burst of world.getActors(DribbleImpactBurst)) {
      burst.setGameplayActive(active);
    }
  }

  private setHudVisible(visible: boolean): void {
    const components = [
      this.scoreDisplay,
      this.livesDisplay,
      this.crosshair,
      this.timingMeter,
      this.juiceHud,
    ];
    for (const component of components) {
      if (visible) component?.show();
      else component?.hide();
    }
    if (!visible) {
      this.comboDisplay?.hide();
      this.hitFeedback?.hide();
    }
  }

  private syncUiState(): void {
    if (this.gameState === 'paused') {
      this.setHudVisible(false);
      this.overlay?.showPause(this.score);
    } else if (this.gameState === 'gameOver') {
      this.setHudVisible(false);
      this.overlay?.showGameOver(this.score);
    } else {
      this.overlay?.hide();
      this.setHudVisible(true);
      this.updateComboDisplay();
    }
  }
}
