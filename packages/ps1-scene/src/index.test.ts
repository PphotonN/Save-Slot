import { describe, expect, it } from 'vitest';
import { coverObjectFit, coverUvTransform, interpolateRigidTransform } from './index';
import { supportsWebGL2 } from './three-controller';

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

  it('crops a wide source symmetrically on the horizontal UV axis', () => {
    const uv = coverUvTransform(1600, 900, 172, 218);
    expect(uv.repeatX).toBeLessThan(1);
    expect(uv.repeatY).toBe(1);
    expect(uv.offsetX).toBeCloseTo((1 - uv.repeatX) / 2);
    expect(uv.offsetY).toBe(0);
  });

  it('crops a narrow source symmetrically on the vertical UV axis', () => {
    const uv = coverUvTransform(500, 1000, 172, 218);
    expect(uv.repeatX).toBe(1);
    expect(uv.repeatY).toBeLessThan(1);
    expect(uv.offsetX).toBe(0);
    expect(uv.offsetY).toBeCloseTo((1 - uv.repeatY) / 2);
  });

  it('returns an identity UV transform for invalid image dimensions', () => {
    expect(coverUvTransform(0, 900, 172, 218)).toEqual({
      repeatX: 1,
      repeatY: 1,
      offsetX: 0,
      offsetY: 0,
    });
  });

  it('reports WebGL 2 as unavailable in the Node test environment', () => {
    expect(supportsWebGL2()).toBe(false);
  });
});
