const assert = require('assert'), E = require('../public/js/engine.js');
assert.strictEqual(E.payoff([{ balance: 1200, rate: 0, min: 100 }], 0, 'snowball').months, 12);
assert.strictEqual(E.payoff([{ balance: 1000, rate: 20, min: 5 }], 0, 'avalanche').ok, false);
assert.strictEqual(E.compound(0, 100, 0, 1)[1].v, 1200);
assert.strictEqual(E.months(0, 3000, 500), 6);
assert.strictEqual(E.months(0, 3000, 0), Infinity);
const p = { income: 1000, expenses: 800, savings: 0, invested: 0, goal: 0, debts: [] };
assert.deepStrictEqual(E.levels(p).slice(0, 3), [true, false, false]);
console.log('engine tests passed');
