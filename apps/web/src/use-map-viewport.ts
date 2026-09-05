import { useLayoutEffect, useRef, useState } from 'react';
import type { MapViewport } from './map-camera';

export function useMapViewport() {
  const ref = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<MapViewport>(() => ({
    width: typeof window === 'undefined' ? 1440 : window.innerWidth,
    height: typeof window === 'undefined' ? 900 : window.innerHeight,
  }));
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      const bounds = element.getBoundingClientRect();
      const width = bounds.width || window.innerWidth;
      const height = bounds.height || window.innerHeight;
      setViewport((current) => current.width === width && current.height === height ? current : { width, height });
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
    observer?.observe(element);
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, []);
  return { ref, viewport };
}
