const { test } = require('node:test');
const assert = require('node:assert');
const {
  canTransition, splitFee, round2, FEE_RATE_DEFAULT, FEE_RATE_REPEAT,
  PROJECT_STATUS, PROJECT_TRANSITIONS,
} = require('../src/constants/marketplace');

test('project state machine allows only the documented transitions', () => {
  assert.strictEqual(canTransition('DRAFT', 'PENDING_REVIEW'), true);
  assert.strictEqual(canTransition('PENDING_REVIEW', 'OPEN'), true);
  assert.strictEqual(canTransition('REVIEW', 'IN_PROGRESS'), true);   // 打回返工
  assert.strictEqual(canTransition('OPEN', 'COMPLETED'), false);      // 必须先托管+交付
  assert.strictEqual(canTransition('COMPLETED', 'OPEN'), false);      // 终态
  assert.strictEqual(canTransition('NOPE', 'OPEN'), false);
});

test('every status is a node in the transition map', () => {
  Object.values(PROJECT_STATUS).forEach((s) => {
    assert.ok(PROJECT_TRANSITIONS[s], `missing transitions for ${s}`);
  });
  Object.values(PROJECT_TRANSITIONS).flat().forEach((s) => {
    assert.ok(PROJECT_STATUS[s], `unknown target status ${s}`);
  });
});

test('fee split never loses a cent', () => {
  const a = splitFee(3000, FEE_RATE_DEFAULT);
  assert.deepStrictEqual(a, { amount: 3000, platformFee: 300, builderPayout: 2700 });

  const b = splitFee(999.99, FEE_RATE_REPEAT);
  assert.strictEqual(round2(b.platformFee + b.builderPayout), b.amount);

  // 奇数分：向上取整的平台费不能把 payout 算成负数或对不上账
  const c = splitFee(0.05, FEE_RATE_DEFAULT);
  assert.strictEqual(round2(c.platformFee + c.builderPayout), c.amount);
});
