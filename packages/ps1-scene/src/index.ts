export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface EulerRotation {
  x: number;
  y: number;
  z: number;
}

export interface RigidTransform {
  position: Vector3;
  rotation: EulerRotation;
  scale: number;
}

export interface CartridgeTextureOptions {
  pixelated: boolean;
  dither: boolean;
  crt: boolean;
  textureResolution: 128 | 256 | 512;
}

export interface SlotSceneState {
  insertedReleaseId: string | null;
  coverUrl: string | null;
  transform: RigidTransform;
  texture: CartridgeTextureOptions;
  reducedMotion: boolean;
}

export interface SlotSceneController {
  mount(target: HTMLElement): Promise<void>;
  insert(releaseId: string, coverUrl: string): Promise<void>;
  eject(): Promise<void>;
  resize(width: number, height: number): void;
  setTextureOptions(options: Partial<CartridgeTextureOptions>): void;
  destroy(): void;
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
const lerp = (start: number, end: number, amount: number): number =>
  start + (end - start) * clamp01(amount);

export function interpolateRigidTransform(
  start: RigidTransform,
  end: RigidTransform,
  amount: number,
): RigidTransform {
  return {
    position: {
      x: lerp(start.position.x, end.position.x, amount),
      y: lerp(start.position.y, end.position.y, amount),
      z: lerp(start.position.z, end.position.z, amount),
    },
    rotation: {
      x: lerp(start.rotation.x, end.rotation.x, amount),
      y: lerp(start.rotation.y, end.rotation.y, amount),
      z: lerp(start.rotation.z, end.rotation.z, amount),
    },
    scale: lerp(start.scale, end.scale, amount),
  };
}

export function easeCartridgeInsertion(amount: number): number {
  const t = clamp01(amount);
  if (t < 0.72) {
    const normalized = t / 0.72;
    return 1 - Math.pow(1 - normalized, 3);
  }
  const settle = (t - 0.72) / 0.28;
  return 1 + Math.sin(settle * Math.PI) * 0.035 * (1 - settle);
}

export function coverObjectFit(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): { width: number; height: number; offsetX: number; offsetY: number } {
  const sourceRatio = sourceWidth / sourceHeight;
  const targetRatio = targetWidth / targetHeight;
  if (sourceRatio > targetRatio) {
    const height = targetHeight;
    const width = height * sourceRatio;
    return { width, height, offsetX: (targetWidth - width) / 2, offsetY: 0 };
  }
  const width = targetWidth;
  const height = width / sourceRatio;
  return { width, height, offsetX: 0, offsetY: (targetHeight - height) / 2 };
}

export const defaultSlotSceneState: SlotSceneState = {
  insertedReleaseId: null,
  coverUrl: null,
  transform: {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: 1,
  },
  texture: {
    pixelated: true,
    dither: true,
    crt: false,
    textureResolution: 256,
  },
  reducedMotion: false,
};
