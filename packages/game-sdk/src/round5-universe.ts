import { keccak_256 } from '@noble/hashes/sha3.js';

/**
 * Dark Forest v0.6 Round 5 universe parameters. The algorithms in this file
 * are an independently written compatibility implementation of the public
 * MiMC/Perlin specification; golden vectors are pinned in the test suite.
 */
export const ROUND5_FIELD_MODULUS =
  21_888_242_871_839_275_222_246_405_745_257_275_088_548_364_400_416_034_343_698_204_186_575_808_495_617n;
export const ROUND5_PLANET_RARITY = 12_000n;
export const ROUND5_PLANET_HASH_KEY = 115;
export const ROUND5_SPACE_TYPE_KEY = 116;
export const ROUND5_BIOMEBASE_KEY = 117;
export const ROUND5_PERLIN_SCALE = 16_384;

export interface Round5Coordinates {
  x: number;
  y: number;
}

export interface Round5PerlinOptions {
  key: number;
  scale?: number;
  mirrorX?: boolean;
  mirrorY?: boolean;
  floor?: boolean;
}

export interface Round5WorldLocation extends Round5Coordinates {
  hash: bigint;
  locationId: string;
  perlin: number;
  biomebase: number;
}

const textEncoder = new TextEncoder();

function bytesToBigInt(bytes: Uint8Array): bigint {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  return value;
}

function field(value: bigint): bigint {
  const reduced = value % ROUND5_FIELD_MODULUS;
  return reduced < 0n ? reduced + ROUND5_FIELD_MODULUS : reduced;
}

let roundConstants: readonly bigint[] | undefined;

function getRoundConstants(): readonly bigint[] {
  if (roundConstants) return roundConstants;
  const constants: bigint[] = [0n];
  let digest = keccak_256(textEncoder.encode('mimcsponge'));
  for (let round = 1; round < 219; round += 1) {
    digest = keccak_256(digest);
    constants.push(bytesToBigInt(digest) % ROUND5_FIELD_MODULUS);
  }
  constants.push(0n);
  roundConstants = constants;
  return constants;
}

function fifthPower(value: bigint): bigint {
  const squared = (value * value) % ROUND5_FIELD_MODULUS;
  const fourth = (squared * squared) % ROUND5_FIELD_MODULUS;
  return (fourth * value) % ROUND5_FIELD_MODULUS;
}

/** MiMC Feistel sponge used by the Round 5 circuits. */
export function round5MimcSponge(
  inputs: readonly (number | bigint)[],
  key: number | bigint,
  rounds = 220,
): bigint {
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > 220) {
    throw new RangeError('MiMC rounds must be an integer from 1 through 220.');
  }
  const constants = getRoundConstants();
  const fieldKey = field(BigInt(key));
  let left = 0n;
  let right = 0n;
  for (const rawInput of inputs) {
    left = field(left + field(BigInt(rawInput)));
    for (let round = 0; round < rounds - 1; round += 1) {
      const mixed = field(fieldKey + left + constants[round]!);
      const previousLeft = left;
      left = field(fifthPower(mixed) + right);
      right = previousLeft;
    }
    right = field(fifthPower(fieldKey + left) + right);
  }
  return left;
}

export function round5LocationHash(x: number, y: number): bigint {
  assertIntegerCoordinates({ x, y });
  return round5MimcSponge([x, y], ROUND5_PLANET_HASH_KEY);
}

export function round5LocationId(x: number, y: number): string {
  return round5LocationHash(x, y).toString(16).padStart(64, '0');
}

export function isRound5PlanetHash(hash: bigint): boolean {
  return hash < ROUND5_FIELD_MODULUS / ROUND5_PLANET_RARITY;
}

interface Rational {
  numerator: bigint;
  denominator: bigint;
}

const rational = (numerator: bigint, denominator = 1n): Rational => {
  if (denominator === 0n) throw new RangeError('A rational denominator cannot be zero.');
  if (denominator < 0n) return rational(-numerator, -denominator);
  const divisor = greatestCommonDivisor(numerator, denominator);
  return { numerator: numerator / divisor, denominator: denominator / divisor };
};

function greatestCommonDivisor(left: bigint, right: bigint): bigint {
  let a = left < 0n ? -left : left;
  let b = right < 0n ? -right : right;
  while (b !== 0n) [a, b] = [b, a % b];
  return a === 0n ? 1n : a;
}

const add = (left: Rational, right: Rational): Rational => rational(
  left.numerator * right.denominator + right.numerator * left.denominator,
  left.denominator * right.denominator,
);
const subtract = (left: Rational, right: Rational): Rational => rational(
  left.numerator * right.denominator - right.numerator * left.denominator,
  left.denominator * right.denominator,
);
const multiply = (left: Rational, right: Rational): Rational => rational(
  left.numerator * right.numerator,
  left.denominator * right.denominator,
);
const absolute = (value: Rational): Rational => rational(
  value.numerator < 0n ? -value.numerator : value.numerator,
  value.denominator,
);

function floorRational(value: Rational): bigint {
  const quotient = value.numerator / value.denominator;
  return value.numerator < 0n && value.numerator % value.denominator !== 0n
    ? quotient - 1n
    : quotient;
}

const GRADIENTS = [
  [1000, 0], [923, 382], [707, 707], [382, 923],
  [0, 1000], [-383, 923], [-708, 707], [-924, 382],
  [-1000, 0], [-924, -383], [-708, -708], [-383, -924],
  [-1, -1000], [382, -924], [707, -708], [923, -383],
] as const;

function positiveModulo(value: number, modulus: number): number {
  const remainder = value % modulus;
  return remainder < 0 ? remainder + modulus : remainder;
}

function gradientAt(x: number, y: number, scale: number, key: number): readonly [number, number] {
  const selector = Number(round5MimcSponge([x, y, scale], key, 4) % 16n);
  return GRADIENTS[selector]!;
}

function octaveValue(x: number, y: number, scale: number, key: number): Rational {
  const left = x - positiveModulo(x, scale);
  const bottom = y - positiveModulo(y, scale);
  const corners = [
    [left, bottom],
    [left + scale, bottom],
    [left, bottom + scale],
    [left + scale, bottom + scale],
  ] as const;
  let total = rational(0n);
  for (const [cornerX, cornerY] of corners) {
    const [gradientX, gradientY] = gradientAt(cornerX, cornerY, scale, key);
    const distanceX = rational(BigInt(x - cornerX), BigInt(scale));
    const distanceY = rational(BigInt(y - cornerY), BigInt(scale));
    const weightX = subtract(rational(1n), absolute(distanceX));
    const weightY = subtract(rational(1n), absolute(distanceY));
    const dotProduct = add(
      multiply(distanceX, rational(BigInt(gradientX), 1000n)),
      multiply(distanceY, rational(BigInt(gradientY), 1000n)),
    );
    total = add(total, multiply(multiply(weightX, weightY), dotProduct));
  }
  return total;
}

/** Exact rational Round 5 Perlin evaluation, including its historical axes. */
export function round5Perlin(
  coordinates: Round5Coordinates,
  options: Round5PerlinOptions,
): number {
  assertIntegerCoordinates(coordinates);
  const scale = options.scale ?? ROUND5_PERLIN_SCALE;
  if (!Number.isSafeInteger(scale) || scale <= 0 || (scale & (scale - 1)) !== 0) {
    throw new RangeError('Perlin scale must be a positive safe power of two.');
  }
  // These names intentionally preserve the circuit/client compatibility rule:
  // mirrorY reflects x and mirrorX reflects y.
  const x = options.mirrorY ? Math.abs(coordinates.x) : coordinates.x;
  const y = options.mirrorX ? Math.abs(coordinates.y) : coordinates.y;
  const first = octaveValue(x, y, scale, options.key);
  const second = octaveValue(x, y, scale * 2, options.key);
  const third = octaveValue(x, y, scale * 4, options.key);
  const noise = multiply(
    add(add(multiply(first, rational(2n)), second), third),
    rational(4n),
  );
  if (options.floor ?? true) return Number(floorRational(noise) + 16n);
  const shifted = add(noise, rational(16n));
  return Number(floorRational(multiply(shifted, rational(100n)))) / 100;
}

export function round5WorldLocation(coordinates: Round5Coordinates): Round5WorldLocation | undefined {
  const hash = round5LocationHash(coordinates.x, coordinates.y);
  if (!isRound5PlanetHash(hash)) return undefined;
  return {
    ...coordinates,
    hash,
    locationId: hash.toString(16).padStart(64, '0'),
    perlin: round5Perlin(coordinates, { key: ROUND5_SPACE_TYPE_KEY }),
    biomebase: round5Perlin(coordinates, { key: ROUND5_BIOMEBASE_KEY }),
  };
}

function assertIntegerCoordinates(coordinates: Round5Coordinates): void {
  if (!Number.isSafeInteger(coordinates.x) || !Number.isSafeInteger(coordinates.y)) {
    throw new RangeError('Universe coordinates must be safe integers.');
  }
}
