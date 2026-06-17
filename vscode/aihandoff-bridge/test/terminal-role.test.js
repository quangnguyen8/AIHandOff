const assert = require('assert');
const { detectStartRoleFromTerminalName } = require('../src/terminal-role');

assert.strictEqual(detectStartRoleFromTerminalName('AIHandOff: Start Plan'), 'plan');
assert.strictEqual(detectStartRoleFromTerminalName('AIHandOff: Start Code'), 'code');
assert.strictEqual(detectStartRoleFromTerminalName('AIHandOff: Start Review'), 'review');
assert.strictEqual(detectStartRoleFromTerminalName('pwsh - AIHandOff: Start Code'), 'code');
assert.strictEqual(detectStartRoleFromTerminalName('opencode review'), null);

console.log('PASS terminal role detection');
