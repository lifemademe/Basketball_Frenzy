import * as ENGINE from '@gnsx/genesys.js';
import * as THREE from 'three';

import { DribbleTarget, type TargetKind } from './dribble-target.js';

export interface DribbleEnvironmentFocusState {
  lane: -1 | 0 | 1;
  urgency: number;
  kind: TargetKind;
}

interface LanePresentation {
  x: number;
  color: THREE.Color;
  guideActor: ENGINE.Actor;
  guideMaterial: THREE.MeshStandardMaterial;
  lightActor: ENGINE.Actor;
  light: ENGINE.PointLightComponent;
  energy: number;
}

interface LanePulse {
  actor: ENGINE.Actor;
  material: THREE.MeshBasicMaterial;
  elapsed: number;
  duration: number;
  intensity: number;
  active: boolean;
}

interface ArenaAccentMaterial {
  material: THREE.MeshStandardMaterial;
  baseEmissive: THREE.Color;
  baseIntensity: number;
}

export class DribbleEnvironmentFocus {
  private readonly actors: ENGINE.Actor[] = [];
  private readonly lanes: LanePresentation[] = [];
  private readonly pulses: LanePulse[] = [];
  private readonly boundaryActors: ENGINE.Actor[] = [];
  private readonly arenaAccents: ArenaAccentMaterial[] = [];
  private readonly accentColor = new THREE.Color();
  private readonly frenzyAccentColor = new THREE.Color(0xffb928);
  private readonly hazeMaterial: THREE.MeshBasicMaterial;
  private readonly hazeActor: ENGINE.Actor;
  private readonly centerMarkMaterial: THREE.MeshStandardMaterial;
  private readonly centerMarkActor: ENGINE.Actor;
  private pulseCursor = 0;
  private active = false;
  private frenzyActive = false;
  private reducedMotion = false;
  private reducedFlashes = false;
  private arenaSurge = 0;
  private presentationTime = 0;
  private sunsetKey: ENGINE.DirectionalLightComponent | null = null;

  public constructor(
    private readonly world: ENGINE.World,
    lanePositions: readonly number[],
  ) {
    const laneColors = [0xff5f86, 0xffd36a, 0x65bdff];
    for (let index = 0; index < lanePositions.length; index += 1) {
      const x = lanePositions[index];
      const color = new THREE.Color(laneColors[index] ?? 0xffd36a);
      const guideMaterial = new THREE.MeshStandardMaterial({
        color: color.clone().multiplyScalar(0.7),
        emissive: color,
        emissiveIntensity: index === 1 ? 1.15 : 0.82,
        roughness: 0.42,
        metalness: 0.08,
      });
      const guide = ENGINE.MeshComponent.create({
        name: `Lane Guide ${index + 1}`,
        geometry: new THREE.BoxGeometry(0.04, 0.035, 30),
        material: guideMaterial,
        position: new THREE.Vector3(x, 0.025, -8),
        castShadow: false,
        receiveShadow: false,
        physicsOptions: { enabled: false },
      });
      const guideActor = ENGINE.Actor.create({
        name: `Reactive Lane Guide ${index + 1}`,
        rootComponent: guide,
        actorTags: ['dribble-environment', 'reactive-lane'],
      });
      const light = ENGINE.PointLightComponent.create({
        color,
        intensity: index === 1 ? 3.1 : 3.8,
        distance: 8.5,
        decay: 2,
        castShadow: false,
        position: new THREE.Vector3(x, 1.45, -5.2),
      });
      const lightActor = ENGINE.Actor.create({
        name: `Reactive Lane Light ${index + 1}`,
        rootComponent: light,
        actorTags: ['dribble-environment', 'lane-light'],
      });
      this.world.addActors(guideActor, lightActor);
      this.actors.push(guideActor, lightActor);
      this.lanes.push({ x, color, guideActor, guideMaterial, lightActor, light, energy: 0 });
    }

    this.centerMarkMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd36a,
      emissive: 0xffb62e,
      emissiveIntensity: 1.45,
      roughness: 0.38,
    });
    this.centerMarkActor = ENGINE.Actor.create({
      name: 'Reactive Center Bounce Mark',
      rootComponent: ENGINE.MeshComponent.create({
        name: 'Center Bounce Mark',
        geometry: new THREE.BoxGeometry(0.12, 0.04, 0.8),
        material: this.centerMarkMaterial,
        position: new THREE.Vector3(0, 0.03, -1.85),
        castShadow: false,
        receiveShadow: false,
        physicsOptions: { enabled: false },
      }),
      actorTags: ['dribble-environment', 'center-mark'],
    });
    this.world.addActor(this.centerMarkActor);
    this.actors.push(this.centerMarkActor);

    this.createOuterRail(-1.52, 0x17364d);
    this.createOuterRail(1.52, 0x442438);

    this.hazeMaterial = new THREE.MeshBasicMaterial({
      color: 0xffb07d,
      transparent: true,
      opacity: 0.055,
      depthWrite: false,
      toneMapped: false,
    });
    this.hazeActor = ENGINE.Actor.create({
      name: 'Sunset Depth Haze',
      rootComponent: ENGINE.MeshComponent.create({
        name: 'Sunset Haze Plane',
        geometry: new THREE.PlaneGeometry(28, 12),
        material: this.hazeMaterial,
        position: new THREE.Vector3(0, 4.8, -20.5),
        physicsOptions: { enabled: false },
      }),
      actorTags: ['dribble-environment', 'depth-haze'],
    });
    this.world.addActor(this.hazeActor);
    this.actors.push(this.hazeActor);

    for (let index = 0; index < 5; index += 1) {
      const material = new THREE.MeshBasicMaterial({
        color: 0xffca3a,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      });
      const actor = ENGINE.Actor.create({
        name: `Pooled Lane Energy Pulse ${index + 1}`,
        rootComponent: ENGINE.MeshComponent.create({
          name: 'Lane Energy Pulse',
          geometry: new THREE.BoxGeometry(0.19, 0.018, 0.85),
          material,
          position: new THREE.Vector3(0, 0.055, -2),
          physicsOptions: { enabled: false },
        }),
        actorTags: ['dribble-environment', 'lane-pulse'],
      });
      actor.rootComponent.visible = false;
      this.world.addActor(actor);
      this.actors.push(actor);
      this.pulses.push({ actor, material, elapsed: 0, duration: 0.5, intensity: 1, active: false });
    }
    this.setActive(false);
  }

  public setSunsetKey(light: ENGINE.DirectionalLightComponent | null): void {
    this.sunsetKey = light;
  }

  public registerArenaAccentMaterial(material: THREE.MeshStandardMaterial): void {
    if (this.arenaAccents.some(entry => entry.material === material)) return;
    this.arenaAccents.push({
      material,
      baseEmissive: material.emissive.clone(),
      baseIntensity: material.emissiveIntensity,
    });
  }

  public setActive(active: boolean): void {
    this.active = active;
    for (const lane of this.lanes) {
      lane.guideActor.rootComponent.visible = active;
      lane.lightActor.rootComponent.visible = active;
      lane.energy = 0;
    }
    this.centerMarkActor.rootComponent.visible = active;
    this.hazeActor.rootComponent.visible = active;
    for (const actor of this.boundaryActors) actor.rootComponent.visible = active;
    if (!active) {
      this.resetFocus();
      for (const pulse of this.pulses) this.stopPulse(pulse);
    }
  }

  public resetFocus(): void {
    this.arenaSurge = 0;
    for (let index = 0; index < this.lanes.length; index += 1) {
      const lane = this.lanes[index];
      lane.energy = 0;
      lane.guideMaterial.emissiveIntensity = index === 1 ? 1.15 : 0.82;
      lane.guideMaterial.color.copy(lane.color).multiplyScalar(0.7);
      lane.light.intensity = index === 1 ? 3.1 : 3.8;
      lane.guideActor.rootComponent.scale.set(1, 1, 1);
    }
    this.centerMarkMaterial.emissiveIntensity = 1.45;
    this.hazeMaterial.opacity = 0.055;
    for (const accent of this.arenaAccents) {
      accent.material.emissive.copy(accent.baseEmissive);
      accent.material.emissiveIntensity = accent.baseIntensity;
    }
    if (this.sunsetKey) this.sunsetKey.intensity = 5.5;
  }

  public setAccessibility(reducedMotion: boolean, reducedFlashes: boolean): void {
    this.reducedMotion = reducedMotion;
    this.reducedFlashes = reducedFlashes;
  }

  public setFrenzyActive(active: boolean): void {
    if (active && !this.frenzyActive) this.arenaSurge = this.reducedFlashes ? 0.35 : 1;
    this.frenzyActive = active;
  }

  public playTargetHit(
    laneX: number,
    color: THREE.ColorRepresentation,
    intensity = 1,
  ): void {
    if (!this.active) return;
    const lane = this.getNearestLane(laneX);
    lane.energy = Math.max(lane.energy, THREE.MathUtils.clamp(intensity, 0.65, 1.5));
    this.arenaSurge = Math.max(this.arenaSurge, Math.min(0.34, intensity * 0.2));
    if (this.reducedMotion) return;
    const pulse = this.pulses[this.pulseCursor];
    this.pulseCursor = (this.pulseCursor + 1) % this.pulses.length;
    pulse.elapsed = 0;
    pulse.duration = THREE.MathUtils.lerp(0.54, 0.38, Math.min(1, intensity - 0.5));
    pulse.intensity = this.reducedFlashes ? Math.min(0.6, intensity) : intensity;
    pulse.active = true;
    pulse.material.color.set(color);
    pulse.material.opacity = 0.56 * pulse.intensity;
    pulse.actor.rootComponent.visible = true;
    pulse.actor.rootComponent.position.set(lane.x, 0.055, -1.75);
    pulse.actor.rootComponent.scale.set(1, 1, 0.45);
  }

  public celebrateMilestone(): void {
    this.arenaSurge = this.reducedFlashes ? 0.38 : 1;
    for (const lane of this.lanes) {
      this.playTargetHit(lane.x, 0xffd34f, this.reducedFlashes ? 0.75 : 1.3);
    }
  }

  public update(
    deltaTime: number,
    targets: readonly DribbleTarget[],
    frenzyProgress: number,
    runProgress: number,
  ): DribbleEnvironmentFocusState | null {
    if (!this.active) return null;
    this.presentationTime += deltaTime;
    this.arenaSurge = Math.max(0, this.arenaSurge - deltaTime * 1.7);
    const frenzy = this.frenzyActive ? THREE.MathUtils.clamp(frenzyProgress, 0, 1) : 0;
    const laneThreats = [0, 0, 0];
    let focusTarget: DribbleTarget | null = null;
    let focusUrgency = 0;
    let focusLaneIndex = 1;

    for (const target of targets) {
      if (target.isRemovalPending()) continue;
      const approach = THREE.MathUtils.smoothstep(target.rootComponent.position.z, -11, -1.25);
      const laneIndex = this.getNearestLaneIndex(target.rootComponent.position.x);
      laneThreats[laneIndex] = Math.max(laneThreats[laneIndex], approach);
      const relevance = approach
        * (target.kind === 'hazard' ? 1.08 : target.kind === 'bonus' ? 1.04 : 1);
      target.setPresentationFocus(THREE.MathUtils.clamp(relevance, 0, 1), frenzy);
      if (relevance > focusUrgency) {
        focusTarget = target;
        focusUrgency = relevance;
        focusLaneIndex = laneIndex;
      }
    }

    const motionScale = this.reducedMotion ? 0.45 : 1;
    for (let index = 0; index < this.lanes.length; index += 1) {
      const lane = this.lanes[index];
      lane.energy = Math.max(laneThreats[index] * 0.48, lane.energy - deltaTime * 2.2);
      const activeLane = index === focusLaneIndex ? focusUrgency * 0.52 : 0;
      const pulse = this.reducedMotion
        ? 0
        : (Math.sin(this.presentationTime * (2.1 + index * 0.12)) + 1) * 0.5 * 0.08;
      const energy = THREE.MathUtils.clamp(
        lane.energy + activeLane + frenzy * 0.75 + this.arenaSurge * 0.6 + pulse,
        0,
        1.65,
      );
      lane.guideMaterial.emissiveIntensity = 0.74 + energy * 2.15;
      lane.guideMaterial.color.copy(lane.color).multiplyScalar(0.58 + energy * 0.18);
      lane.light.intensity = 2.2 + energy * 5.2;
      lane.guideActor.rootComponent.scale.x = 1 + energy * 0.22 * motionScale;
    }

    const sunsetDeepening = THREE.MathUtils.smoothstep(runProgress, 0.15, 1);
    this.hazeMaterial.opacity = 0.045
      + sunsetDeepening * 0.035
      + frenzy * 0.055
      + this.arenaSurge * 0.025;
    this.centerMarkMaterial.emissiveIntensity = 1.2 + focusUrgency * 0.6 + frenzy * 2.4;
    for (const accent of this.arenaAccents) {
      this.accentColor.copy(accent.baseEmissive).lerp(this.frenzyAccentColor, frenzy * 0.78);
      accent.material.emissive.copy(this.accentColor);
      accent.material.emissiveIntensity = accent.baseIntensity
        + focusUrgency * 0.18
        + frenzy * 2.1
        + this.arenaSurge * 1.25;
    }
    if (this.sunsetKey) {
      this.sunsetKey.intensity = 5.25 + sunsetDeepening * 0.25 + frenzy * 0.65;
    }
    this.updatePulses(deltaTime);

    if (!focusTarget) return null;
    return {
      lane: focusLaneIndex === 0 ? -1 : focusLaneIndex === 2 ? 1 : 0,
      urgency: THREE.MathUtils.clamp(focusUrgency, 0, 1),
      kind: focusTarget.kind,
    };
  }

  public destroy(): void {
    for (const actor of this.actors) actor.destroy();
    this.actors.length = 0;
    this.lanes.length = 0;
    this.pulses.length = 0;
  }

  private createOuterRail(x: number, color: THREE.ColorRepresentation): void {
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.32,
      roughness: 0.58,
    });
    const actor = ENGINE.Actor.create({
      name: x < 0 ? 'Left Gameplay Boundary Rail' : 'Right Gameplay Boundary Rail',
      rootComponent: ENGINE.MeshComponent.create({
        name: 'Gameplay Boundary Rail',
        geometry: new THREE.BoxGeometry(0.055, 0.028, 27),
        material,
        position: new THREE.Vector3(x, 0.018, -7.5),
        castShadow: false,
        receiveShadow: false,
        physicsOptions: { enabled: false },
      }),
      actorTags: ['dribble-environment', 'lane-boundary'],
    });
    this.world.addActor(actor);
    this.actors.push(actor);
    this.boundaryActors.push(actor);
  }

  private getNearestLane(x: number): LanePresentation {
    return this.lanes[this.getNearestLaneIndex(x)];
  }

  private getNearestLaneIndex(x: number): number {
    let nearest = 0;
    for (let index = 1; index < this.lanes.length; index += 1) {
      if (Math.abs(this.lanes[index].x - x) < Math.abs(this.lanes[nearest].x - x)) nearest = index;
    }
    return nearest;
  }

  private updatePulses(deltaTime: number): void {
    for (const pulse of this.pulses) {
      if (!pulse.active) continue;
      pulse.elapsed += deltaTime;
      const progress = Math.min(1, pulse.elapsed / pulse.duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      pulse.actor.rootComponent.position.z = THREE.MathUtils.lerp(-1.75, -8.4, eased);
      pulse.actor.rootComponent.scale.set(
        THREE.MathUtils.lerp(0.85, 1.35, eased),
        1,
        THREE.MathUtils.lerp(0.45, 2.8, eased),
      );
      pulse.material.opacity = (1 - progress) * 0.56 * pulse.intensity;
      if (progress >= 1) this.stopPulse(pulse);
    }
  }

  private stopPulse(pulse: LanePulse): void {
    pulse.active = false;
    pulse.material.opacity = 0;
    pulse.actor.rootComponent.visible = false;
  }
}
