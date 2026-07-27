import { describe, expect, it } from 'vitest';
import { coverObjectFit, interpolateRigidTransform } from './index';

describe('PS1 cartridge scene math', () => {
  it('interpolates one uniform scale value instead of deforming axes', () => {
    const transform = interpolateRigidTransform(
      {
        position: { x: 0, y: 10, z: 20 },
        rotation: { x: 0, y: 0, z: 0.2 },
        scale: 1,
      },
      {
        position: { x: 20, y: 0, z: 0 },
        rotation: { x: 0.1, y: -0.1, z: 0 },
        scale: 0.7,
      },
      0.5,
    );
    expect(transform.scale).toBeCloseTo(0.85);
    expect('scaleX' in transform).toBe(false);
    expect('scaleY' in transform).toBe(false);
  });

  it('keeps cover aspect ratio while cropping into the label area', () => {
    const fitted = coverObjectFit(600, 900, 240, 300);
    expect(fitted.width / fitted.height).toBeCloseTo(600 / 900);
    expect(fitted.height).toBeGreaterThanOrEqual(300);
  });
});
