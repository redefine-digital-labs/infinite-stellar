import { describe, expect, it } from 'vitest';
import { mapToWorld, worldToMap, zoomAtMapPoint } from './map-camera';

describe('isotropic tactical map camera', () => {
  it.each([{ width: 1440, height: 900 }, { width: 393, height: 720 }])('preserves world distances at $width × $height', (viewport) => {
    const camera = { centerX: 73, centerY: 6421, radius: 220 };
    const right = worldToMap({ x: camera.centerX + 100, y: camera.centerY }, camera, viewport);
    const down = worldToMap({ x: camera.centerX, y: camera.centerY + 100 }, camera, viewport);
    expect((right.x - 50) / 100 * viewport.width).toBeCloseTo((down.y - 50) / 100 * viewport.height);
    expect(mapToWorld(right, camera, viewport).x).toBeCloseTo(camera.centerX + 100);
    expect(mapToWorld(down, camera, viewport).y).toBeCloseTo(camera.centerY + 100);
  });

  it('anchors wheel zoom under the cursor and round-trips zoom out', () => {
    const camera = { centerX: -300, centerY: 200, radius: 500 };
    const viewport = { width: 393, height: 720 };
    const cursor = { x: 80, y: 20 };
    const before = mapToWorld(cursor, camera, viewport);
    const zoomed = zoomAtMapPoint(camera, 250, cursor, viewport);
    expect(mapToWorld(cursor, zoomed, viewport).x).toBeCloseTo(before.x);
    expect(mapToWorld(cursor, zoomed, viewport).y).toBeCloseTo(before.y);
    const restored = zoomAtMapPoint(zoomed, 500, cursor, viewport);
    expect(restored.centerX).toBeCloseTo(camera.centerX);
    expect(restored.centerY).toBeCloseTo(camera.centerY);
  });
});
