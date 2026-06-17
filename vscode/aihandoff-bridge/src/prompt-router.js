const { resolveSkillPacks } = require('./skill-resolver');

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

function buildRoleObjective(role, phase, language) {
  const lang = language === 'vi' ? 'vi' : 'en';

  const objectives = {
    en: {
      plan: [
        'Read the project context and write the next concrete plan to .ai-handoff/plan.md.',
        'Then update .ai-handoff/state.json to planned.'
      ].join(' '),
      code_planned: [
        'Read .ai-handoff/state.json, .ai-handoff/plan.md, and .ai-handoff/review-findings.md.',
        'Continue the implementation.',
        'Write the result to .ai-handoff/execution-result.md,',
        'then update .ai-handoff/state.json to code_done.'
      ].join(' '),
      code_review_findings: [
        'Read .ai-handoff/state.json, .ai-handoff/plan.md, and .ai-handoff/review-findings.md.',
        'Continue the implementation or fix the review findings.',
        'Write the result to .ai-handoff/fix-result.md,',
        'then update .ai-handoff/state.json to fix_done.'
      ].join(' '),
      code_default: [
        'Read .ai-handoff/state.json, .ai-handoff/plan.md, and .ai-handoff/review-findings.md.',
        'Continue the implementation or fix the review findings.',
        'Write the result to .ai-handoff/execution-result.md or .ai-handoff/fix-result.md,',
        'then update .ai-handoff/state.json to code_done or fix_done.'
      ].join(' '),
      review: [
        'Read .ai-handoff/state.json, .ai-handoff/plan.md, .ai-handoff/execution-result.md, and git diff.',
        'Review the current work, write findings to .ai-handoff/review-findings.md,',
        'then update .ai-handoff/state.json to approved when clean or review_findings when fixes are needed.'
      ].join(' ')
    },
    vi: {
      plan: [
        'Đọc ngữ cảnh dự án và viết kế hoạch cụ thể vào .ai-handoff/plan.md.',
        'Sau đó cập nhật .ai-handoff/state.json thành planned.'
      ].join(' '),
      code_planned: [
        'Đọc .ai-handoff/state.json, .ai-handoff/plan.md, và .ai-handoff/review-findings.md.',
        'Tiếp tục triển khai.',
        'Ghi kết quả vào .ai-handoff/execution-result.md,',
        'sau đó cập nhật .ai-handoff/state.json thành code_done.'
      ].join(' '),
      code_review_findings: [
        'Đọc .ai-handoff/state.json, .ai-handoff/plan.md, và .ai-handoff/review-findings.md.',
        'Tiếp tục triển khai hoặc sửa các lỗi từ review.',
        'Ghi kết quả vào .ai-handoff/fix-result.md,',
        'sau đó cập nhật .ai-handoff/state.json thành fix_done.'
      ].join(' '),
      code_default: [
        'Đọc .ai-handoff/state.json, .ai-handoff/plan.md, và .ai-handoff/review-findings.md.',
        'Tiếp tục triển khai hoặc sửa các lỗi từ review.',
        'Ghi kết quả vào .ai-handoff/execution-result.md hoặc .ai-handoff/fix-result.md,',
        'sau đó cập nhật .ai-handoff/state.json thành code_done hoặc fix_done.'
      ].join(' '),
      review: [
        'Đọc .ai-handoff/state.json, .ai-handoff/plan.md, .ai-handoff/execution-result.md, và git diff.',
        'Review công việc hiện tại, ghi nhận xét vào .ai-handoff/review-findings.md,',
        'sau đó cập nhật .ai-handoff/state.json thành approved nếu ổn hoặc review_findings nếu cần sửa.'
      ].join(' ')
    }
  };

  const roleObjectives = objectives[lang];
  if (!roleObjectives) {
    return '';
  }

  if (role === 'code') {
    const phaseKey = normalizePhase(phase);
    if (phaseKey === 'planned') {
      return roleObjectives.code_planned;
    }

    if (phaseKey === 'review_findings' || phaseKey === 'fix_requested') {
      return roleObjectives.code_review_findings;
    }

    return roleObjectives.code_default;
  }

  return roleObjectives[role] || '';
}

function inferAgentFromProfile(profile) {
  const normalizedProfile = String(profile || '').trim().toLowerCase();
  if (!normalizedProfile.includes('-')) {
    return '';
  }

  return normalizedProfile.split('-')[0];
}

function renderPromptEnvelope(context) {
  const lang = context.language === 'vi' ? 'vi' : 'en';
  const none = lang === 'vi' ? '(không có)' : '(none)';
  const baseline = context.skills.baseline.length > 0 ? context.skills.baseline.join('\n- ') : none;
  const injected = context.skills.injected.length > 0 ? context.skills.injected.join('\n- ') : none;
  const instructionBody = context.skills.sections.length > 0 ? context.skills.sections.join('\n\n') : none;
  const prelude = lang === 'vi' ? 'AIHandOff tiếp tục:' : 'AIHandOff continue:';

  return [
    `${prelude}`,
    '[AIHANDOFF CONTEXT]',
    `workspace=${context.workspaceRoot || '.'}`,
    `agent=${context.agent || ''}`,
    `profile=${context.profile || ''}`,
    `role=${context.role || ''}`,
    `phase=${context.phase || ''}`,
    '',
    '[AIHANDOFF OBJECTIVE]',
    context.objective,
    '',
    '[AIHANDOFF SKILLS]',
    'Baseline:',
    baseline === none ? none : `- ${baseline}`,
    '',
    'Injected:',
    injected === none ? none : `- ${injected}`,
    '',
    '[AIHANDOFF INSTRUCTIONS]',
    instructionBody
  ].join('\n');
}

function buildRoleSpec(role, language, options) {
  const normalizedRole = String(role || '').trim().toLowerCase();
  const normalizedPhase = normalizePhase(options && options.phase ? options.phase : 'idle');
  const profile = (options && options.profile) || '';
  const agent = (options && options.agent) || inferAgentFromProfile(profile);
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
  const skills = resolveSkillPacks({
    role: normalizedRole,
    phase: normalizedPhase,
    profile,
    agent,
    skillContext: options && options.skillContext
  });

  return {
    role: normalizedRole,
    commandTitle: commandTitles[normalizedRole] || null,
    commandIds: commandIds[normalizedRole] || [],
    startTaskTitle: `AIHandOff: Start ${normalizedRole.charAt(0).toUpperCase()}${normalizedRole.slice(1)}`,
    terminalCandidates: terminalCandidatesForRole(normalizedRole),
    skills,
    prompt: renderPromptEnvelope({
      language,
      workspaceRoot: options && options.workspaceRoot,
      agent,
      profile,
      role: normalizedRole,
      phase: normalizedPhase,
      objective: buildRoleObjective(normalizedRole, normalizedPhase, language),
      skills
    })
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

function buildContinuation(state, forcedRole, language, options) {
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

  const spec = buildRoleSpec(targetRole, language, {
    phase,
    profile: options && options.profile,
    agent: options && options.agent,
    workspaceRoot: options && options.workspaceRoot,
    skillContext: options && options.skillContext
  });
  return {
    targetRole,
    prompt: spec.prompt,
    skills: spec.skills,
    terminalCandidates: spec.terminalCandidates,
    commandTitle: spec.commandTitle,
    startTaskTitle: spec.startTaskTitle
  };
}

module.exports = {
  buildContinuation,
  buildRoleSpec,
  terminalCandidatesForRole
};
