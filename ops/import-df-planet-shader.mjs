// Read-only generator: emits an apply_patch patch from the pinned local upstream checkout.
// Does not download or execute upstream code. Apply only after checking package licenses.
import fs from 'node:fs';
import path from 'node:path';

const upstream = process.argv[2];
if (!upstream) throw new Error('Pass the pinned darkforest-v0.6 checkout root.');
const src = fs.readFileSync(path.join(upstream, 'packages/renderer/src/Programs/PlanetProgram.ts'), 'utf8');
const mixins = fs.readFileSync(path.join(upstream, 'packages/renderer/src/WebGL/ShaderMixins.ts'), 'utf8');
let fragment = src.match(/fragmentShader: glsl`([\s\S]*?)`,/)[1];
fragment = fragment.replace(/\$\{ShaderMixins\.(\w+)\}/g, (_, name) =>
  mixins.match(new RegExp('public static ' + name + ' = `([\\s\\S]*?)`;'))[1]);
for (const group of ['v', 'u']) {
  const body = src.match(new RegExp('const ' + group + ' = \\{([\\s\\S]*?)\\};'))[1];
  for (const match of body.matchAll(/(\w+): '([^']+)'/g)) {
    fragment = fragment.split('${' + group + '.' + match[1] + '}').join(match[2]);
  }
}
if (fragment.includes('${')) throw new Error('Unresolved shader interpolation.');
fragment = fragment.replace('sqrt(1. - pow(xNorm, 2.0) - pow(yNorm, 2.0))',
  'sqrt(max(0., 1. - pow(xNorm, 2.0) - pow(yNorm, 2.0)))')
  .replace('sqrt(r - pow(xPre, 2.0) - pow(yPre, 2.0))',
    'sqrt(max(0., r - pow(xPre, 2.0) - pow(yPre, 2.0)))');
const files = [
  ['apps/web/src/rendering/df-planet.frag.glsl', '#version 300 es\n' +
    '// Dark Forest Round 5 PlanetProgram + required ShaderMixins. MIT, (c) 2022 0xPARC.\n' +
    '// Pinned d1e25ead311697ecaa27ff648dac16a0d8cea15c. See public/third-party/df-renderer-LICENSE.txt.\n' +
    '// Adaptation: expanded template includes; clamp spherical square roots outside the disk.\n' +
    fragment.trim().split('\n').map((line) => line.trimEnd()).join('\n') + '\n'],
  ['apps/web/public/third-party/df-renderer-LICENSE.txt', fs.readFileSync(path.join(upstream, 'packages/renderer/LICENSE'), 'utf8')],
  ['apps/web/public/third-party/df-procedural-LICENSE.txt', fs.readFileSync(path.join(upstream, 'packages/procedural/LICENSE'), 'utf8')],
];
process.stdout.write('*** Begin Patch\n' + files.map(([file, content]) =>
  '*** Add File: ' + path.resolve(file) + '\n' + content.trimEnd().split('\n').map((line) => '+' + line).join('\n') + '\n'
).join('') + '*** End Patch');
