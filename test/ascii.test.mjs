import test from 'node:test';
import assert from 'node:assert/strict';
import { toAscii, charBrightness, CHARS } from '../src/js/ascii.js';

test('white is densest, black is space, mid grey lands mid-ramp', () => {
  const px = new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255, 128, 128, 128, 255, 10, 200, 90, 255]);
  assert.deepEqual(toAscii(px, 2, 2), ["@ ", "+="]);
});

test('charBrightness inverts the ramp ends', () => {
  assert.equal(charBrightness(CHARS[0]), 0);
  assert.equal(charBrightness(" "), 255);
});
