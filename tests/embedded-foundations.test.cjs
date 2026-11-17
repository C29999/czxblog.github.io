const test = require('node:test');
const assert = require('node:assert/strict');
const { applyMask, counterTrace } = require('../source/interview/embedded-foundations-labs.js');

test('mask operations preserve unselected bits across all byte values', () => {
  for (let value = 0; value < 256; value += 1) {
    for (let mask = 0; mask < 256; mask += 1) {
      for (const operation of ['set', 'clear', 'toggle']) {
        const result = applyMask(value, mask, operation);
        assert.equal(result & (~mask & 255), value & (~mask & 255));
        assert.ok(result >= 0 && result <= 255);
        if (operation === 'set') assert.equal(result & mask, mask);
        if (operation === 'clear') assert.equal(result & mask, 0);
        if (operation === 'toggle') assert.equal(applyMask(result, mask, operation), value);
      }
    }
  }
});

test('worked examples and interrupt interleaving produce expected outcomes', () => {
  assert.equal(applyMask(0xA5, 8, 'set'), 0xAD);
  assert.equal(applyMask(0xA5, 1, 'clear'), 0xA4);
  assert.equal(applyMask(0xA5, 255, 'toggle'), 0x5A);
  assert.deepEqual(counterTrace(false).map(step => step.count), [0, 0, 1, 1, 1]);
  assert.deepEqual(counterTrace(true).map(step => step.count), [0, 0, 0, 0, 1, 1, 2]);
});
