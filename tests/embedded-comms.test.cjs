const test = require('node:test');
const assert = require('node:assert/strict');
const { uartRate, differential, videoBudget, stepIndex, rs485Steps, usbSteps, videoSteps } = require('../source/interview/embedded-comms-notes.js');

test('115200 8N1 includes start and stop overhead in throughput', () => {
  const result = uartRate(115200, 'N', 1);
  assert.equal(result.bitsPerByte, 10);
  assert.equal(result.bytesPerSecond, 11520);
  assert.equal(result.payloadBits, 92160);
  assert.equal(result.bytesPerSecond / 1024, 11.25);
  assert.ok(Math.abs(result.microseconds - 86.805555556) < 0.000001);
});

test('parity and stop bits reduce payload throughput at the same line rate', () => {
  assert.equal(uartRate(19200, 'E', 1).bitsPerByte, 11);
  assert.deepEqual(uartRate(19200, 'E', 1), uartRate(19200, 'N', 2));
  assert.ok(uartRate(115200, 'O', 2).bytesPerSecond < uartRate(115200, 'N', 1).bytesPerSecond);
  for (const baud of [0, -1, NaN, Infinity]) assert.throws(() => uartRate(baud, 'N', 1), RangeError);
  assert.throws(() => uartRate(115200, 'X', 1), RangeError);
});

test('equal common-mode shifts cancel, differential disturbance remains', () => {
  for (const commonNoise of [-1, -0.3, 0, 0.7, 1]) {
    assert.ok(Math.abs(differential(commonNoise, 0).difference - 1) < 1e-12);
    assert.ok(Math.abs(differential(commonNoise, 0.6).difference - 1.6) < 1e-12);
  }
});

test('video budget uses YUV420 pixel depth and decimal storage units', () => {
  const normal = videoBudget(1920, 1080, 30, 4);
  const faster = videoBudget(1920, 1080, 60, 4);
  assert.equal(normal.rawMbps, 746.496);
  assert.equal(normal.megabytesPerMinute, 30);
  assert.ok(Math.abs(normal.averageKilobytesPerFrame - 16.666666667) < 1e-8);
  assert.equal(faster.rawMbps, normal.rawMbps * 2);
  assert.equal(faster.megabytesPerMinute, normal.megabytesPerMinute);
  assert.equal(faster.averageKilobytesPerFrame, normal.averageKilobytesPerFrame / 2);
});

test('steppers stay within bounds and RS485 releases the bus after UART completion', () => {
  for (const steps of [rs485Steps, usbSteps, videoSteps]) {
    assert.equal(stepIndex(0, 'prev', steps.length), 0);
    assert.equal(stepIndex(steps.length - 1, 'next', steps.length), steps.length - 1);
    assert.equal(stepIndex(steps.length - 1, 'reset', steps.length), 0);
    assert.equal(stepIndex(0, 'next', steps.length), 1);
  }
  const dmaStage = rs485Steps.findIndex(([title]) => title.includes('DMA'));
  const releaseStage = rs485Steps.findIndex(([title]) => title.includes('释放总线'));
  const replyStage = rs485Steps.findIndex(([title]) => title.includes('对端响应'));
  assert.ok(dmaStage < releaseStage && releaseStage < replyStage);
  assert.match(rs485Steps[dmaStage][1], /DE 保持 1/);
  assert.match(rs485Steps[releaseStage][1], /最后停止位发完/);
});
