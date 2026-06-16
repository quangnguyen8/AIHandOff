function normalizePhase(value) {
  return String(value || 'idle').trim().toLowerCase().replace(/-/g, '_');
}

function terminalCandidatesForRole(role) {
  const candidates = {
    plan: [
      'aihandoff: start plan',
      'commandcode plan',
      'codex plan',
      'opencode plan',
      'claude plan'
    ],
    code: [
      'aihandoff: start code',
      'opencode code',
      'commandcode code',
      'claude code'
    ],
    review: [
      'aihandoff: start review',
      'opencode review',
      'codex review',
      'claude review'
    ]
  };

  return candidates[role] || [];
}

function buildRolePrompt(role) {
  if (role === 'review') {
    return [
      'AIHandOff continue:',
      'Read .ai-handoff/state.json, .ai-handoff/plan.md, .ai-handoff/execution-result.md, and git diff.',
      'Review the current work, write findings to .ai-handoff/review-findings.md,',
      'then update .ai-handoff/state.json to approved when clean or review_findings when fixes are needed.'
    ].join(' ');
  }

  if (role === 'code') {
    return [
      'AIHandOff continue:',
      'Read .ai-handoff/state.json, .ai-handoff/plan.md, and .ai-handoff/review-findings.md.',
      'Continue the implementation or fix the review findings.',
      'Write the result to .ai-handoff/execution-result.md or .ai-handoff/fix-result.md,',
      'then update .ai-handoff/state.json to code_done or fix_done.'
    ].join(' ');
  }

  if (role === 'plan') {
    return [
      'AIHandOff continue:',
      'Read the project context and write the next concrete plan to .ai-handoff/plan.md.',
      'Then update .ai-handoff/state.json to planned.'
    ].join(' ');
  }

  return 'AIHandOff continue: no action is required for the current handoff state.';
}

function buildRoleSpec(role) {
  const normalizedRole = String(role || '').trim().toLowerCase();
  const commandTitles = {
    plan: 'AIHandOff: Plan Write To Handoff',
    code: 'AIHandOff: Code Write To Handoff',
    review: 'AIHandOff: Review Write Findings'
  };
  const commandIds = {
    plan: ['aihandoff.planWriteToHandoff', 'aihandoff.sendToPlanTerminal'],
    code: ['aihandoff.codeWriteToHandoff', 'aihandoff.sendToCodeTerminal'],
    review: ['aihandoff.reviewWriteFindings', 'aihandoff.sendToReviewTerminal']
  };

  return {
    role: normalizedRole,
    commandTitle: commandTitles[normalizedRole] || null,
    commandIds: commandIds[normalizedRole] || [],
    prompt: buildRolePrompt(normalizedRole),
    terminalCandidates: terminalCandidatesForRole(normalizedRole)
  };
}

function roleForPhase(phase) {
  switch (normalizePhase(phase)) {
    case 'idle':
    case 'new':
    case 'planning':
      return 'plan';
    case 'planned':
    case 'review_findings':
    case 'fix_requested':
      return 'code';
    case 'code_done':
    case 'fix_done':
      return 'review';
    case 'approved':
    case 'review_done':
      return null;
    default:
      return null;
  }
}

function buildContinuation(state, forcedRole) {
  const phase = (state && state.phase) || 'idle';
  const targetRole = forcedRole || roleForPhase(phase);
  if (!targetRole) {
    return {
      targetRole: null,
      prompt: 'AIHandOff continue: this handoff is already approved or has no automatic next role.'
    };
  }

  const spec = buildRoleSpec(targetRole);
  return {
    targetRole,
    prompt: spec.prompt,
    terminalCandidates: spec.terminalCandidates,
    commandTitle: spec.commandTitle
  };
}

module.exports = {
  buildContinuation,
  buildRoleSpec,
  terminalCandidatesForRole
};
