import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MapPlanetBodies, type PlanetBody } from './MapPlanetBodies';

const planet: PlanetBody = { id: '0000a123456789ab', x: 100, y: 120, radius: 24,
  opacity: 1, biome: 2, level: 2, planetType: 'Regular' };

function context() {
  const gl = {
    VERTEX_SHADER: 1, FRAGMENT_SHADER: 2, COMPILE_STATUS: 3, LINK_STATUS: 4, ARRAY_BUFFER: 5,
    STATIC_DRAW: 6, FLOAT: 7, BLEND: 8, SRC_ALPHA: 9, ONE_MINUS_SRC_ALPHA: 10, COLOR_BUFFER_BIT: 11, TRIANGLES: 12,
    createShader: vi.fn(() => ({})), shaderSource: vi.fn(), compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => true), getShaderInfoLog: vi.fn(() => 'fixture compile failure'),
    createProgram: vi.fn(() => ({})), attachShader: vi.fn(), linkProgram: vi.fn(),
    getProgramParameter: vi.fn(() => true), getProgramInfoLog: vi.fn(), useProgram: vi.fn(),
    createBuffer: vi.fn(() => ({})), bindBuffer: vi.fn(), bufferData: vi.fn(),
    getAttribLocation: vi.fn(() => 0), enableVertexAttribArray: vi.fn(), vertexAttribPointer: vi.fn(),
    getUniformLocation: vi.fn((_program: unknown, name: string) => name), enable: vi.fn(), blendFunc: vi.fn(),
    viewport: vi.fn(), clearColor: vi.fn(), clear: vi.fn(), uniform2f: vi.fn(), uniformMatrix4fv: vi.fn(),
    uniform1f: vi.fn(), uniform3fv: vi.fn(), uniform4f: vi.fn(), drawArrays: vi.fn(),
    deleteBuffer: vi.fn(), deleteProgram: vi.fn(), deleteShader: vi.fn(),
  };
  vi.stubGlobal('WebGL2RenderingContext', class {});
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(gl as unknown as WebGL2RenderingContext);
  return gl;
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('shared planet GPU lifecycle', () => {
  it('uses one context, redraws camera changes before paint and releases GPU/RAF resources', async () => {
    vi.useFakeTimers();
    const gl = context();
    const ready = vi.fn();
    const { rerender, unmount } = render(<MapPlanetBodies planets={[planet]}
      viewport={{ width: 600, height: 400 }} onReady={ready} />);
    expect(ready).toHaveBeenLastCalledWith(true);
    expect(gl.createProgram).toHaveBeenCalledTimes(1);
    expect(gl.shaderSource.mock.calls[1]?.[1]).toContain('float snoise(vec4 v)');
    gl.uniform2f.mockClear();
    rerender(<MapPlanetBodies planets={[{ ...planet, x: 180, y: 200 }]}
      viewport={{ width: 800, height: 500 }} onReady={ready} />);
    expect(gl.uniform2f).toHaveBeenCalledWith('u_center', 180, 200);
    expect(gl.uniform2f).toHaveBeenCalledWith('u_viewport', 800, 500);
    expect(gl.createProgram).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(100));
    unmount();
    expect(gl.deleteShader).toHaveBeenCalledTimes(2);
    expect(gl.deleteProgram).toHaveBeenCalledTimes(1);
    expect(gl.deleteBuffer).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('falls back after context loss without a drawing loop or invented state change', () => {
    vi.useFakeTimers();
    context();
    const ready = vi.fn();
    const { container } = render(<MapPlanetBodies planets={[planet]} viewport={{ width: 600, height: 400 }} onReady={ready} />);
    const lost = new Event('webglcontextlost', { cancelable: true });
    act(() => container.querySelector('canvas')!.dispatchEvent(lost));
    expect(lost.defaultPrevented).toBe(true);
    expect(ready).toHaveBeenLastCalledWith(false);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('does not hide readable fallback glyphs when shader compilation fails', () => {
    const gl = context(); gl.getShaderParameter.mockReturnValue(false);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ready = vi.fn();
    const { unmount } = render(<MapPlanetBodies planets={[planet]} viewport={{ width: 600, height: 400 }} onReady={ready} />);
    expect(ready).toHaveBeenLastCalledWith(false);
    expect(gl.drawArrays).not.toHaveBeenCalled();
    unmount();
    expect(gl.deleteShader).toHaveBeenCalledTimes(1);
  });
});
