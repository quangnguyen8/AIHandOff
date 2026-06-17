const assert = require('assert');
const { buildContinuation, buildRoleSpec } = require('../src/prompt-router');

function includesAll(text, parts) {
  for (const part of parts) {
    assert.ok(text.includes(part), `Expected prompt to include: ${part}`);
  }
}

{
  const result = buildContinuation({ phase: 'code_done' });
  assert.strictEqual(result.targetRole, 'review');
  includesAll(result.prompt, [
    '.ai-handoff/state.json',
    '.ai-handoff/review-findings.md',
    'git diff'
  ]);
}

{
  const result = buildContinuation({ phase: 'review_findings' });
  assert.strictEqual(result.targetRole, 'code');
  includesAll(result.prompt, [
    '.ai-handoff/review-findings.md',
    '.ai-handoff/fix-result.md',
    'fix'
  ]);
}

{
  const result = buildContinuation({ phase: 'planned' });
  assert.strictEqual(result.targetRole, 'code');
  includesAll(result.prompt, [
    '.ai-handoff/plan.md',
    '.ai-handoff/execution-result.md',
    'implementation'
  ]);
}

{
  const result = buildContinuation({ phase: 'approved' });
  assert.strictEqual(result.targetRole, null);
  assert.ok(result.prompt.includes('already approved'));
}

{
  const result = buildContinuation(undefined);
  assert.strictEqual(result.targetRole, 'plan');
  assert.ok(result.prompt.includes('state.json'));
}

{
  const result = buildContinuation(null);
  assert.strictEqual(result.targetRole, 'plan');
  assert.ok(result.prompt.includes('state.json'));
}

{
  const result = buildRoleSpec('plan');
  assert.strictEqual(result.commandTitle, 'AIHandOff: Plan Write To Handoff');
  assert.deepStrictEqual(result.commandIds, [
    'aihandoff.planWriteToHandoff',
    'aihandoff.sendToPlanTerminal'
  ]);
  includesAll(result.prompt, [
    '.ai-handoff/plan.md',
    '.ai-handoff/state.json',
    'planned'
  ]);
}

{
  const result = buildRoleSpec('code');
  assert.strictEqual(result.commandTitle, 'AIHandOff: Code Write To Handoff');
  assert.deepStrictEqual(result.commandIds, [
    'aihandoff.codeWriteToHandoff',
    'aihandoff.sendToCodeTerminal'
  ]);
  includesAll(result.prompt, [
    '.ai-handoff/plan.md',
    '.ai-handoff/review-findings.md',
    '.ai-handoff/execution-result.md',
    '.ai-handoff/fix-result.md'
  ]);
}

{
  const result = buildRoleSpec('review');
  assert.strictEqual(result.commandTitle, 'AIHandOff: Review Write Findings');
  assert.deepStrictEqual(result.commandIds, [
    'aihandoff.reviewWriteFindings',
    'aihandoff.sendToReviewTerminal'
  ]);
  includesAll(result.prompt, [
    '.ai-handoff/execution-result.md',
    'git diff',
    '.ai-handoff/review-findings.md',
    'approved'
  ]);
}

{
  const result = buildContinuation({ phase: 'code_done' }, null, 'vi');
  assert.strictEqual(result.targetRole, 'review');
  assert.ok(result.prompt.includes('tiếp tục'));
  assert.ok(result.prompt.includes('git diff'));
}

{
  const result = buildContinuation({ phase: 'planned' }, null, 'vi');
  assert.strictEqual(result.targetRole, 'code');
  assert.ok(result.prompt.includes('tiếp tục'));
  assert.ok(result.prompt.includes('triển khai'));
}

{
  const result = buildRoleSpec('plan', 'vi');
  assert.ok(result.prompt.includes('tiếp tục'));
  assert.ok(result.prompt.includes('kế hoạch'));
}

{
  const result = buildRoleSpec('code', 'vi');
  assert.ok(result.prompt.includes('tiếp tục'));
  assert.ok(result.prompt.includes('triển khai'));
}

{
  const result = buildRoleSpec('review', 'vi');
  assert.ok(result.prompt.includes('tiếp tục'));
  assert.ok(result.prompt.includes('nhận xét'));
}

{
  const result = buildContinuation({ phase: 'approved' }, null, 'vi');
  assert.strictEqual(result.targetRole, null);
  assert.ok(result.prompt.includes('approved'));
}

console.log('PASS prompt router');
