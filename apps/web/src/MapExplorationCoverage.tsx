import { useId } from 'react';
import type { ExploredChunk } from '@infinite-stellar/game-sdk';
import { worldToMap, worldPixelScale, type MapViewport } from './map-camera';

/** Coverage comes only from completed private chunks, never a radius around a discovery. */
export function MapExplorationCoverage({ chunks, active, origin, centerX, centerY, radius, viewport = { width: 100, height: 100 } }: {
  chunks: readonly ExploredChunk[];
  active: readonly ExploredChunk[];
  origin?: { x: number; y: number };
  centerX: number;
  centerY: number;
  radius: number;
  viewport?: MapViewport;
}) {
  const maskId = useId();
  const camera = { centerX, centerY, radius };
  const scale = worldPixelScale(camera, viewport);
  const originPoint = origin && worldToMap(origin, camera, viewport);
  const rect = (chunk: ExploredChunk) => ({ ...worldToMap(chunk, camera, viewport),
    width: chunk.side * scale / viewport.width * 100, height: chunk.side * scale / viewport.height * 100 });
  const visible = (chunk: ExploredChunk) => {
    const box = rect(chunk);
    return box.x < 100 && box.y < 100 && box.x + box.width > 0 && box.y + box.height > 0;
  };
  return <svg className="map-exploration-coverage" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
    <defs><mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
      <rect width="100" height="100" fill="white" />
      {chunks.filter(visible).map((chunk) => <rect key={`${chunk.x}:${chunk.y}:${chunk.side}`} {...rect(chunk)} fill="black" />)}
    </mask></defs>
    <rect className="unsearched-space" width="100" height="100" mask={`url(#${maskId})`} />
    {active.filter(visible).map((chunk) => <rect className="active-search-chunk" key={`${chunk.x}:${chunk.y}:${chunk.side}`}
      {...rect(chunk)} vectorEffect="non-scaling-stroke" />)}
    {originPoint && <path className="explorer-origin" d={`M ${originPoint.x - 1} ${originPoint.y} h 2 m -1 -1 v 2`}
      vectorEffect="non-scaling-stroke" />}
  </svg>;
}
