export interface MapViewport { width: number; height: number }
export interface WorldCamera { centerX: number; centerY: number; radius: number }
export interface MapPoint { x: number; y: number }

/** Radius fits along the shorter viewport axis; world units have one pixel scale. */
export function worldPixelScale(camera: WorldCamera, viewport: MapViewport): number {
  return Math.max(1, Math.min(viewport.width, viewport.height)) * 0.46 / camera.radius;
}

export function worldToMap(point: MapPoint, camera: WorldCamera, viewport: MapViewport): MapPoint {
  const scale = worldPixelScale(camera, viewport);
  return { x: 50 + (point.x - camera.centerX) * scale / Math.max(1, viewport.width) * 100,
    y: 50 + (point.y - camera.centerY) * scale / Math.max(1, viewport.height) * 100 };
}

export function mapToWorld(point: MapPoint, camera: WorldCamera, viewport: MapViewport): MapPoint {
  const scale = worldPixelScale(camera, viewport);
  return { x: camera.centerX + (point.x - 50) / 100 * Math.max(1, viewport.width) / scale,
    y: camera.centerY + (point.y - 50) / 100 * Math.max(1, viewport.height) / scale };
}

export function mapPosition(point: MapPoint, camera: WorldCamera, viewport: MapViewport) {
  const projected = worldToMap(point, camera, viewport);
  return { left: `${projected.x}%`, top: `${projected.y}%` };
}

/** Keep the world coordinate under the pointer fixed while changing zoom. */
export function zoomAtMapPoint<T extends WorldCamera>(camera: T, radius: number, point: MapPoint, viewport: MapViewport): T {
  const anchor = mapToWorld(point, camera, viewport);
  const next = { ...camera, radius };
  const shifted = mapToWorld(point, next, viewport);
  return { ...next, centerX: camera.centerX + anchor.x - shifted.x, centerY: camera.centerY + anchor.y - shifted.y };
}
