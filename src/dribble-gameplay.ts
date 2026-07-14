import * as ENGINE from '@gnsx/genesys.js';
import * as THREE from 'three';

import { DribbleBall, type DribbleBallState, type DribbleSide } from './dribble-ball.js';
import { DribbleComboPopup } from './dribble-combo-popup.js';
import { DribbleImpactBurst } from './dribble-impact-burst.js';
import { DribbleMainMenu } from './dribble-main-menu.js';
import { DribbleOverlay } from './dribble-overlay.js';
import {
  DribbleJuiceHud,
  DribbleLivesDisplay,
  DribblePauseButton,
  DribbleSideHints,
  DribbleTimingMeter,
} from './dribble-status-hud.js';
import { DribbleTarget } from './dribble-target.js';

type DribbleGameState = 'menu' | 'playing' | 'paused' | 'gameOver';

interface HandAnimationState {
  action: THREE.AnimationAction;
  mixer: THREE.AnimationMixer;
}

@ENGINE.GameClass()
export class DribbleGameplayManager extends ENGINE.Actor {
  private ball: DribbleBall | null = null;
  private scoreDisplay: ENGINE.NumberDisplay | null = null;
  private pauseButton: DribblePauseButton | null = null;
  private livesDisplay: DribbleLivesDisplay | null = null;
  private sideHints: DribbleSideHints | null = null;
  private crosshair: ENGINE.Crosshair | null = null;
  private timingMeter: DribbleTimingMeter | null = null;
  private juiceHud: DribbleJuiceHud | null = null;
  private mainMenu: DribbleMainMenu | null = null;
  private overlay: DribbleOverlay | null = null;
  private spawnTimer = 0.9;
  private elapsedTime = 0;
  private score = 0;
  private lives = 3;
  private combo = 0;
  private frenzyCharge = 0;
  private frenzyTimeRemaining = 0;
  private readonly handAnimations = new Map<DribbleSide, HandAnimationState>();
  private readonly referenceHandVisibility = new Map<ENGINE.SceneComponent, boolean>();
  private readonly impactBursts: DribbleImpactBurst[] = [];
  private readonly comboPopups: DribbleComboPopup[] = [];
  private gameState: DribbleGameState = 'menu';
  private impactBurstCursor = 0;
  private comboPopupCursor = 0;
  private previousGameCursor: string | null = null;
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
    if (this.gameState === 'menu' || this.gameState === 'gameOver') {
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
    this.deactivateHitEffects();

    this.gameState = 'playing';
    this.spawnTimer = 0.7;
    this.elapsedTime = 0;
    this.score = 0;
    this.lives = 3;
    this.combo = 0;
    this.frenzyCharge = 0;
    this.frenzyTimeRemaining = 0;
    this.ball?.reset();
    this.setGameplayActive(true);
    this.scoreDisplay?.setValue(0, false);
    this.scoreDisplay?.setTrend(null);
    this.livesDisplay?.setLives(this.lives);
    this.timingMeter?.setTiming(0, false, false);
    this.juiceHud?.setFrenzy(0, 0, false);
    this.mainMenu?.hide();
    this.overlay?.hide();
    this.setHudVisible(true);
    world.inputManager.exitPointerLock();
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

    const world = this.getWorld();
    const ballState = this.ball?.getState();
    if (world && ballState) {
      const targets = world.getActors(DribbleTarget);
      this.updateTimingMeter(ballState, targets);
      this.checkBallTargetHits(ballState, targets);
    }
    this.updateHandAnimations(deltaTime);
  }

  protected override doBeginPlay(): void {
    super.doBeginPlay();
    this.setupArena();
    this.hideReferenceHands();
    void this.setupHandAnimations();
    void this.setupHud();
  }

  protected override doEndPlay(): void {
    this.scoreDisplay?.destroy();
    this.pauseButton?.destroy();
    this.livesDisplay?.destroy();
    this.sideHints?.destroy();
    this.crosshair?.destroy();
    this.timingMeter?.destroy();
    this.juiceHud?.destroy();
    this.mainMenu?.destroy();
    this.overlay?.destroy();
    this.scoreDisplay = null;
    this.pauseButton = null;
    this.livesDisplay = null;
    this.sideHints = null;
    this.crosshair = null;
    this.timingMeter = null;
    this.juiceHud = null;
    this.mainMenu = null;
    this.overlay = null;
    this.restoreReferenceHands();
    const world = this.getWorld();
    const gameContainer = world?.gameContainer;
    if (gameContainer && this.previousGameCursor !== null) {
      gameContainer.style.cursor = this.previousGameCursor;
      this.previousGameCursor = null;
    }
    for (const state of this.handAnimations.values()) {
      state.mixer.stopAllAction();
    }
    this.handAnimations.clear();
    this.impactBursts.length = 0;
    this.comboPopups.length = 0;
    super.doEndPlay();
  }

  private hideReferenceHands(): void {
    const world = this.getWorld();
    if (!world) return;
    for (const actor of world.getActorsByPredicate(candidate => candidate.hasActorTag('hand-placeholder'))) {
      for (const component of actor.getComponents(ENGINE.SceneComponent)) {
        if (!this.referenceHandVisibility.has(component)) {
          this.referenceHandVisibility.set(component, component.visible);
        }
        component.visible = false;
      }
    }
  }

  private restoreReferenceHands(): void {
    for (const [component, visible] of this.referenceHandVisibility) {
      component.visible = visible;
    }
    this.referenceHandVisibility.clear();
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
      color: 0x2b2134,
    }).setName('Dribble Court Floor');

    world.addBox({
      position: new THREE.Vector3(0, 0.02, -1.85),
      width: 0.12,
      height: 0.04,
      depth: 0.8,
      color: 0xffd36a,
    }).setName('Center Bounce Mark');

    for (const laneX of this.lanes) {
      world.addBox({
        position: new THREE.Vector3(laneX, 0.02, -8),
        width: 0.035,
        height: 0.04,
        depth: 30,
        color: laneX === 0 ? 0xffd36a : laneX < 0 ? 0xff6b8a : 0x65b8ff,
      }).setName(`Lane Guide ${laneX}`);
    }

    this.addHand(world, 'Left Hand', '@project/assets/models/right_hand.glb');
    this.addHand(world, 'Right Hand', '@project/assets/models/left_hand.glb');
    this.addLights(world);

    this.ball = DribbleBall.create({ name: 'Dribble Ball' });
    world.addActor(this.ball);
    this.ball.setGameplayActive(false);
    this.createHitEffectPool(world);
  }

  private async setupHud(): Promise<void> {
    const world = this.getWorld();
    if (!world || this.scoreDisplay) {
      return;
    }

    const scoreIconHtml = await ENGINE.resolveAssetPathsInText(
      '<img src="@project/assets/textures/Star.png" alt="">',
    );
    const gameContainer = world.gameContainer;
    if (gameContainer) {
      this.previousGameCursor = gameContainer.style.cursor;
      gameContainer.style.cursor = 'none';
    }

    this.scoreDisplay = new ENGINE.NumberDisplay(world.uiManager, {
      position: 'top-right',
      visible: false,
      label: '',
      initialValue: 0,
      animate: true,
      iconHtml: scoreIconHtml,
    });
    this.pauseButton = new DribblePauseButton(world.uiManager, {
      visible: false,
      onPause: () => this.pauseRun(),
    });
    this.livesDisplay = new DribbleLivesDisplay(world.uiManager, {
      position: 'top-left',
      visible: false,
      initialLives: this.lives,
      maxLives: 3,
    });
    this.sideHints = new DribbleSideHints(world.uiManager, {
      visible: false,
    });
    this.crosshair = new ENGINE.Crosshair(world.uiManager, {
      ...ENGINE.Crosshair.presets.bracket,
      visible: false,
      size: 42,
      color: '#d7ff43',
      accentColor: '#ffffff',
    });
    this.timingMeter = new DribbleTimingMeter(world.uiManager, {
      position: 'bottom-center',
      visible: false,
    });
    this.juiceHud = new DribbleJuiceHud(world.uiManager, {
      position: 'top-center',
      visible: false,
    });
    this.mainMenu = new DribbleMainMenu(world.uiManager, {
      onPlay: () => this.restartRun(),
      onVolumeChange: volume => this.applyMasterVolume(volume),
    });
    this.overlay = new DribbleOverlay(world.uiManager, {
      onResume: () => this.resumeRun(),
      onRestart: () => this.restartRun(),
      onMainMenu: () => this.returnToMainMenu(),
    });

    await Promise.all([
      this.scoreDisplay.initialize(),
      this.pauseButton.initialize(),
      this.livesDisplay.initialize(),
      this.sideHints.initialize(),
      this.crosshair.initialize(),
      this.timingMeter.initialize(),
      this.juiceHud.initialize(),
      this.mainMenu.initialize(),
      this.overlay.initialize(),
    ]);
    this.scoreDisplay.setPosition({
      'width': 'auto',
      'height': 'auto',
      'position': 'fixed',
      'top': '28px',
      'right': '28px',
      'left': 'auto',
      'display': 'flex',
      'flex-direction': 'row',
      'align-items': 'center',
      'justify-content': 'flex-end',
      'gap': '8px',
      'padding': '7px 12px 7px 9px',
      'border': '1px solid rgba(255, 255, 255, 0.14)',
      'border-radius': '8px',
      'background-color': 'rgba(7, 11, 18, 0.62)',
      'backdrop-filter': 'blur(7px)',
      '-webkit-backdrop-filter': 'blur(7px)',
      'box-shadow': 'none',
      'margin': '0',
      'pointer-events': 'none',
    }, '.ui-number-display');
    this.scoreDisplay.setPosition({
      'display': 'flex',
      'align-items': 'center',
      'min-height': '0',
    }, '.ui-number-display-header');
    this.scoreDisplay.setPosition({
      'display': 'inline-flex',
      'width': '44px',
      'height': '36px',
      'flex-shrink': '0',
    }, '.ui-number-display-icon');
    this.scoreDisplay.setPosition({
      'display': 'block',
      'width': '44px',
      'height': '36px',
      'object-fit': 'contain',
    }, '.ui-number-display-icon img');
    this.scoreDisplay.setPosition({
      'font-weight': '700',
      'font-size': '36px',
      'line-height': '40px',
      'color': '#ffffff',
      'letter-spacing': '0',
    }, '.ui-number-display-value');
    this.syncUiState();
  }

  private addHand(world: ENGINE.World, name: string, modelUrl: string): void {
    const existing = world.getActorByName(name);
    const existingModel = existing?.rootComponent instanceof ENGINE.ModelMeshComponent
      ? existing.rootComponent
      : existing?.getComponent(ENGINE.ModelMeshComponent);
    if (existingModel?.modelUrl === modelUrl) {
      existingModel.replacePhysicsOptions({ enabled: false });
      return;
    }
    existing?.destroy();

    world.addActor(ENGINE.ModelMeshActor.create({
      name,
      modelUrl,
      position: new THREE.Vector3(0, 1.32, -1.08),
      scale: new THREE.Vector3(0.5, 0.5, 0.5),
      physicsOptions: { enabled: false },
    }));
  }

  private async setupHandAnimations(): Promise<void> {
    await Promise.all([
      this.setupHandAnimation('left', 'Left Hand'),
      this.setupHandAnimation('right', 'Right Hand'),
    ]);
  }

  private async setupHandAnimation(side: DribbleSide, actorName: string): Promise<void> {
    const actor = this.getWorld()?.getActorByName(actorName);
    const model = actor?.rootComponent instanceof ENGINE.ModelMeshComponent
      ? actor.rootComponent
      : actor?.getComponent(ENGINE.ModelMeshComponent);
    if (!model) {
      return;
    }

    await model.waitForLoad();
    const modelRoot = model.getModel();
    const clip = model.getAnimations().find(animation => animation.name === 'Bounce');
    if (!modelRoot || !clip) {
      return;
    }

    const mixer = new THREE.AnimationMixer(modelRoot);
    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.play();
    action.paused = true;
    this.handAnimations.set(side, { action, mixer });
  }

  private updateHandAnimations(deltaTime: number): void {
    const ballState = this.ball?.getState();
    if (!ballState) {
      return;
    }

    this.sideHints?.setState(ballState.side, ballState.isTransferring);

    for (const [side, state] of this.handAnimations) {
      const active = ballState.side === side && !ballState.isTransferring;
      state.action.paused = !active;
      if (active) {
        state.mixer.update(deltaTime);
      } else if (state.action.time !== 0) {
        state.action.time = 0;
        state.mixer.update(0);
      }
    }
  }

  private addLights(world: ENGINE.World): void {
    const coralFill = ENGINE.Actor.create({
      name: 'Sunset Coral Lane Fill',
      rootComponent: ENGINE.PointLightComponent.create({
        color: 0xff4f7b,
        intensity: 9,
        distance: 9,
        decay: 2,
        castShadow: false,
        position: new THREE.Vector3(-2.2, 2.5, -4.5),
      }),
    });

    const blueFill = ENGINE.Actor.create({
      name: 'Sunset Blue Lane Fill',
      rootComponent: ENGINE.PointLightComponent.create({
        color: 0x4da6ff,
        intensity: 8,
        distance: 10,
        decay: 2,
        castShadow: false,
        position: new THREE.Vector3(2.2, 2.2, -6.5),
      }),
    });

    world.addActors(coralFill, blueFill);
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

  private updateTimingMeter(ballState: DribbleBallState, targets: DribbleTarget[]): void {
    if (!this.timingMeter) {
      return;
    }

    const transferToCenterTime = DribbleBall.transferDuration * 0.5;
    const centerBounceZ = -1.85;
    const timingTolerance = 0.48;
    const trackingSpan = 4;
    let candidate: number | null = null;
    let candidateMagnitude = Number.POSITIVE_INFINITY;
    for (const target of targets) {
      if (target.kind !== 'score' || Math.abs(target.laneX) > 0.01) continue;
      const switchZ = centerBounceZ - target.getApproachSpeed() * transferToCenterTime;
      const error = target.getWorldPosition().z - switchZ;
      const magnitude = Math.abs(error);
      if (magnitude <= trackingSpan && magnitude < candidateMagnitude) {
        candidate = error;
        candidateMagnitude = magnitude;
      }
    }

    if (candidate === null) {
      this.timingMeter.setTiming(0, false, false);
      return;
    }

    const progress = 0.5 + candidate / (trackingSpan * 2);
    const ready = !ballState.isTransferring && !ballState.isBoosting && Math.abs(candidate) <= timingTolerance;
    this.timingMeter.setTiming(progress, true, ready);
  }

  private checkBallTargetHits(ballState: DribbleBallState, targets: DribbleTarget[]): void {
    for (const target of targets) {
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
    this.spawnComboPopup();
    this.spawnImpactBurst(position, bonus || this.frenzyTimeRemaining > 0 ? 0xffca3a : 0x59df86);
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
    this.spawnImpactBurst(position, 0x4de6b8);
    void world.globalAudioManager.playGlobalSound('@engine/assets/sounds/pickup.mp3', {
      volume: 0.78,
      bus: 'SFX',
    });
  }

  private spawnImpactBurst(position: THREE.Vector3, color: THREE.ColorRepresentation): void {
    const burst = this.impactBursts[this.impactBurstCursor];
    if (!burst) {
      return;
    }
    this.impactBurstCursor = (this.impactBurstCursor + 1) % this.impactBursts.length;
    burst.play(position, color);
  }

  private spawnComboPopup(): void {
    const ballState = this.ball?.getState();
    const popup = this.comboPopups[this.comboPopupCursor];
    if (!ballState || !popup || this.combo < 2) {
      return;
    }
    this.comboPopupCursor = (this.comboPopupCursor + 1) % this.comboPopups.length;
    popup.play(
      ballState.position.clone().add(new THREE.Vector3(0, 0.16, 0)),
      `COMBO x${this.combo}`,
      this.combo >= 5 ? '#ffca3a' : '#65e6a8',
    );
  }

  private activateFrenzy(): void {
    const world = this.getWorld();
    this.frenzyCharge = 0;
    this.frenzyTimeRemaining = this.frenzyDuration;
    this.ball?.setFrenzyActive(true);
    this.juiceHud?.setFrenzy(1, this.frenzyTimeRemaining, true);
    this.juiceHud?.showPraise('FRENZY!', 'gold');
    if (world) {
      void world.globalAudioManager.playGlobalSound('@engine/assets/sounds/pickup.mp3', {
        volume: 0.9,
        bus: 'SFX',
      });
      void world.globalAudioManager.playGlobalSound('@engine/assets/sounds/laser.mp3', {
        volume: 0.5,
        bus: 'SFX',
      });
    }
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
    if (!active) {
      this.ball?.setFrenzyActive(false);
    }
  }

  private showScorePraise(): void {
    const praise = this.combo >= 5
      ? ['WOW!', 'UNREAL!', 'PERFECT!']
      : ['NICE!', 'COOL!', 'SWEET!', 'GREAT!'];
    const label = praise[Math.floor(Math.random() * praise.length)];
    this.juiceHud?.showPraise(label, this.combo >= 3 ? 'gold' : 'green');
  }

  private applyMasterVolume(volume: number): void {
    this.getWorld()?.globalAudioManager.getBus('Master')?.setVolume(volume);
  }

  private returnToMainMenu(): void {
    const world = this.getWorld();
    if (!world) {
      return;
    }

    this.gameState = 'menu';
    this.setGameplayActive(false);
    this.deactivateHitEffects();
    this.setHudVisible(false);
    this.overlay?.hide();
    this.mainMenu?.showHome();
    world.inputManager.exitPointerLock();
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
    world.inputManager.exitPointerLock();
  }

  private endRun(): void {
    const world = this.getWorld();
    if (!world) {
      return;
    }
    this.gameState = 'gameOver';
    this.setGameplayActive(false);
    this.deactivateHitEffects();
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
    for (const burst of this.impactBursts) {
      burst.setGameplayActive(active);
    }
    for (const popup of this.comboPopups) {
      popup.setGameplayActive(active);
    }
  }

  private setHudVisible(visible: boolean): void {
    const components = [
      this.scoreDisplay,
      this.pauseButton,
      this.livesDisplay,
      this.sideHints,
      this.crosshair,
      this.timingMeter,
      this.juiceHud,
    ];
    for (const component of components) {
      if (visible) component?.show();
      else component?.hide();
    }
  }

  private createHitEffectPool(world: ENGINE.World): void {
    for (let index = 0; index < 4; index += 1) {
      const burst = DribbleImpactBurst.create({ name: `Target Impact Burst ${index + 1}` });
      this.impactBursts.push(burst);
      world.addActor(burst);
    }
    for (let index = 0; index < 3; index += 1) {
      const popup = DribbleComboPopup.create({ name: `Ball Combo Popup ${index + 1}` });
      this.comboPopups.push(popup);
      world.addActor(popup);
    }
  }

  private deactivateHitEffects(): void {
    for (const burst of this.impactBursts) {
      burst.deactivate();
    }
    for (const popup of this.comboPopups) {
      popup.deactivate();
    }
  }

  private syncUiState(): void {
    if (this.gameState === 'menu') {
      this.setGameplayActive(false);
      this.setHudVisible(false);
      this.overlay?.hide();
      this.mainMenu?.showHome();
    } else if (this.gameState === 'paused') {
      this.mainMenu?.hide();
      this.setHudVisible(false);
      this.overlay?.showPause(this.score);
    } else if (this.gameState === 'gameOver') {
      this.mainMenu?.hide();
      this.setHudVisible(false);
      this.overlay?.showGameOver(this.score);
    } else {
      this.mainMenu?.hide();
      this.overlay?.hide();
      this.setHudVisible(true);
    }
  }
}
