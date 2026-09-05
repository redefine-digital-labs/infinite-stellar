import { useEffect, useLayoutEffect, useRef } from 'react';
import type { MapViewport } from './map-camera';
import { planetCosmetic } from './planet-rendering';
import fragment from './rendering/df-planet.frag.glsl?raw';

export interface PlanetBody {
  id: string;
  x: number;
  y: number;
  radius: number;
  opacity: number;
  biome: number;
  level: number;
  planetType: string;
}

// Original DF fragment, driven by one shared WebGL2 canvas instead of a context per Planet.
const vertex = `#version 300 es
precision highp float;
in vec2 a_rectPos;
uniform vec2 u_center, u_viewport;
uniform float u_radius;
uniform vec3 u_land, u_ocean, u_beach;
uniform vec4 u_props, u_props2;
out vec4 v_position, v_color, v_color2, v_color3;
out vec2 v_rectPos;
out float v_seed, v_eps, v_alpha, v_distort, v_octaves, v_numClouds, v_morphSpeed, v_showBeach;
void main() {
  vec2 pixel = u_center + a_rectPos * u_radius;
  gl_Position = vec4(pixel.x / u_viewport.x * 2. - 1., 1. - pixel.y / u_viewport.y * 2., 0., 1.);
  v_position = gl_Position; v_rectPos = a_rectPos;
  v_color = vec4(u_land, 1.); v_color2 = vec4(u_ocean, 1.); v_color3 = vec4(u_beach, 1.);
  v_seed = u_props2.x; v_eps = u_props2.y; v_alpha = u_props2.z; v_distort = u_props2.w;
  v_octaves = u_props.x; v_numClouds = u_props.y; v_morphSpeed = u_props.z; v_showBeach = u_props.w;
}`;

export function MapPlanetBodies({ planets, viewport, onReady }: {
  planets: PlanetBody[]; viewport: MapViewport; onReady: (ready: boolean) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const latest = useRef({ planets, viewport });
  const redraw = useRef<(() => void) | undefined>(undefined);
  useLayoutEffect(() => {
    latest.current = { planets, viewport };
    // Camera changes must paint before DOM rings/labels do, not one animation frame later.
    redraw.current?.();
  }, [planets, viewport]);
  useEffect(() => {
    const element = canvas.current;
    if (!element || typeof WebGL2RenderingContext === 'undefined') return;
    const gl = element.getContext('webgl2', { alpha: true, antialias: false, premultipliedAlpha: false });
    if (!gl) return;
    let program: WebGLProgram | null = null;
    let buffer: WebGLBuffer | null = null;
    const shaders: WebGLShader[] = [];
    let frame = 0;
    let lost = false;
    const compile = (kind: number, source: string) => {
      const shader = gl.createShader(kind);
      if (!shader) throw new Error('Planet shader allocation failed.');
      shaders.push(shader);
      gl.shaderSource(shader, source); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'Planet shader failed.');
      return shader;
    };
    const contextLost = (event: Event) => { event.preventDefault(); lost = true; cancelAnimationFrame(frame); onReady(false); };
    const contextRestored = () => { onReady(false); }; // Fallback remains readable; remount retries GPU setup.
    element.addEventListener('webglcontextlost', contextLost);
    element.addEventListener('webglcontextrestored', contextRestored);
    try {
      program = gl.createProgram();
      if (!program) throw new Error('Planet program allocation failed.');
      gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'Planet shader link failed.');
      gl.useProgram(program);
      buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      const attribute = gl.getAttribLocation(program, 'a_rectPos');
      gl.enableVertexAttribArray(attribute); gl.vertexAttribPointer(attribute, 2, gl.FLOAT, false, 0, 0);
      const uniform = Object.fromEntries(['center', 'viewport', 'radius', 'land', 'ocean', 'beach', 'props', 'props2', 'time', 'timeMatrix']
        .map((name) => [name, gl.getUniformLocation(program!, `u_${name}`)]));
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
      let last = -Infinity;
      const draw = (time: number, immediate = false) => {
        if (lost) return;
        if (!immediate) frame = requestAnimationFrame(draw);
        if (document.hidden || (!immediate && time - last < 1000 / 24)) return;
        last = time;
        const state = latest.current;
        const ratio = Math.min(2, window.devicePixelRatio || 1);
        const width = Math.max(1, Math.round(state.viewport.width * ratio));
        const height = Math.max(1, Math.round(state.viewport.height * ratio));
        if (element.width !== width || element.height !== height) { element.width = width; element.height = height; }
        gl.viewport(0, 0, width, height);
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform2f(uniform.viewport!, state.viewport.width, state.viewport.height);
        const seconds = reduced?.matches ? 0 : time / 1000;
        const angle = seconds / 5;
        const c = Math.cos(angle), s = Math.sin(angle);
        gl.uniformMatrix4fv(uniform.timeMatrix!, false, new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]));
        gl.uniform1f(uniform.time!, seconds / 6);
        // Large bodies first, small bodies last: small planets stay pickable/visible in overlaps.
        for (const planet of [...state.planets].sort((a, b) => b.radius - a.radius)) {
          if (planet.planetType !== 'Regular') continue;
          if (planet.x + planet.radius < 0 || planet.y + planet.radius < 0 ||
            planet.x - planet.radius > state.viewport.width || planet.y - planet.radius > state.viewport.height) continue;
          const cosmetic = planetCosmetic(planet.id, planet.biome, planet.level);
          gl.uniform2f(uniform.center!, planet.x, planet.y); gl.uniform1f(uniform.radius!, planet.radius);
          gl.uniform3fv(uniform.land!, cosmetic.land); gl.uniform3fv(uniform.ocean!, cosmetic.ocean); gl.uniform3fv(uniform.beach!, cosmetic.beach);
          gl.uniform4f(uniform.props!, cosmetic.octaves, cosmetic.clouds, cosmetic.morph, cosmetic.beachMode);
          gl.uniform4f(uniform.props2!, cosmetic.seed, 1 / Math.max(1, planet.radius * ratio), planet.opacity, cosmetic.distort);
          gl.drawArrays(gl.TRIANGLES, 0, 6);
        }
      };
      redraw.current = () => draw(performance.now(), true);
      draw(0); onReady(true);
    } catch (error) {
      onReady(false);
      console.warn('Planet WebGL renderer unavailable; using the readable map fallback.', error);
    }
    return () => {
      redraw.current = undefined;
      cancelAnimationFrame(frame); element.removeEventListener('webglcontextlost', contextLost);
      element.removeEventListener('webglcontextrestored', contextRestored);
      if (buffer) gl.deleteBuffer(buffer);
      if (program) gl.deleteProgram(program);
      for (const shader of shaders) gl.deleteShader(shader);
    };
  }, [onReady]);
  return <canvas ref={canvas} className="planet-bodies" aria-hidden="true" data-renderer="dark-forest-round5" />;
}
