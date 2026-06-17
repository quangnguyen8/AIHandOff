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

function buildRolePrompt(role, language) {
  const lang = language === 'vi' ? 'vi' : 'en';

  const prompts = {
    en: {
      plan: [
        'AIHandOff continue:',
        'Read the project context and write the next concrete plan to .ai-handoff/plan.md.',
        'Then update .ai-handoff/state.json to planned.'
      ].join(' '),
      code: [
        'AIHandOff continue:',
        'Read .ai-handoff/state.json, .ai-handoff/plan.md, and .ai-handoff/review-findings.md.',
        'Continue the implementation or fix the review findings.',
        'Write the result to .ai-handoff/execution-result.md or .ai-handoff/fix-result.md,',
        'then update .ai-handoff/state.json to code_done or fix_done.'
      ].join(' '),
      review: [
        'AIHandOff continue:',
        'Read .ai-handoff/state.json, .ai-handoff/plan.md, .ai-handoff/execution-result.md, and git diff.',
        'Review the current work, write findings to .ai-handoff/review-findings.md,',
        'then update .ai-handoff/state.json to approved when clean or review_findings when fixes are needed.'
      ].join(' ')
    },
    vi: {
      plan: [
        'AIHandOff tiếp tục:',
        'Đọc ngữ cảnh dự án và viết kế hoạch cụ thể vào .ai-handoff/plan.md.',
        'Sau đó cập nhật .ai-handoff/state.json thành planned.'
      ].join(' '),
      code: [
        'AIHandOff tiếp tục:',
        'Đọc .ai-handoff/state.json, .ai-handoff/plan.md, và .ai-handoff/review-findings.md.',
        'Tiếp tục triển khai hoặc sửa các lỗi từ review.',
        'Ghi kết quả vào .ai-handoff/execution-result.md hoặc .ai-handoff/fix-result.md,',
        'sau đó cập nhật .ai-handoff/state.json thành code_done hoặc fix_done.'
      ].join(' '),
      review: [
        'AIHandOff tiếp tục:',
        'Đọc .ai-handoff/state.json, .ai-handoff/plan.md, .ai-handoff/execution-result.md, và git diff.',
        'Review công việc hiện tại, ghi nhận xét vào .ai-handoff/review-findings.md,',
        'sau đó cập nhật .ai-handoff/state.json thành approved nếu ổn hoặc review_findings nếu cần sửa.'
      ].join(' ')
    }
  };

  const rolePrompts = prompts[lang];
  if (rolePrompts && rolePrompts[role]) {
    return rolePrompts[role];
  }

  return lang === 'vi'
    ? 'AIHandOff tiếp tục: không có hành động nào cho trạng thái hiện tại.'
    : 'AIHandOff continue: no action is required for the current handoff state.';
}

function buildRoleSpec(role, language) {
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
    prompt: buildRolePrompt(normalizedRole, language),
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

function buildContinuation(state, forcedRole, language) {
  const phase = (state && state.phase) || 'idle';
  const targetRole = forcedRole || roleForPhase(phase);
  if (!targetRole) {
    const lang = (language === 'vi') ? 'vi' : 'en';
    return {
      targetRole: null,
      prompt: lang === 'vi'
        ? 'AIHandOff tiếp tục: handoff này đã được approved hoặc không có role tự động tiếp theo.'
        : 'AIHandOff continue: this handoff is already approved or has no automatic next role.'
    };
  }

  const spec = buildRoleSpec(targetRole, language);
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
