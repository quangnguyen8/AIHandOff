const fs = require('fs');
const path = require('path');
const vscode = require('vscode');
const { buildContinuation, buildRoleSpec } = require('./prompt-router');
const { detectStartRoleFromTerminalName } = require('./terminal-role');

const bootstrappedTerminals = new WeakSet();
const suppressedBootstrapCounts = new Map();

function getWorkspaceRoot() {
  const folder = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0];
  if (!folder) {
    throw new Error('Open a workspace folder before using AIHandOff.');
  }

  return folder.uri.fsPath;
}

function getLanguage() {
  return vscode.workspace.getConfiguration('aihandoff').get('language', 'vi');
}

function getKitRoot() {
  return vscode.workspace.getConfiguration('aihandoff').get('kitRoot', '');
}

function getRoleProfiles() {
  return vscode.workspace.getConfiguration('aihandoff').get('roleProfiles', {
    plan: 'opencode-plan',
    code: 'opencode-code',
    review: 'opencode-review'
  });
}

function getAutoOpenMissingTerminal() {
  return vscode.workspace.getConfiguration('aihandoff').get('autoOpenMissingTerminal', false);
}

function agentFromProfile(profile) {
  const normalized = String(profile || '').trim().toLowerCase();
  if (!normalized.includes('-')) {
    return '';
  }

  return normalized.split('-')[0];
}

function readState(workspaceRoot) {
  const statePath = path.join(workspaceRoot, '.ai-handoff', 'state.json');
  if (!fs.existsSync(statePath)) {
    return { phase: 'idle' };
  }

  const raw = fs.readFileSync(statePath, 'utf8');
  return JSON.parse(raw);
}

function findTerminal(candidates) {
  const normalizedCandidates = candidates.map((candidate) => candidate.toLowerCase());
  return vscode.window.terminals.find((terminal) => {
    const name = terminal.name.toLowerCase();
    return normalizedCandidates.some((candidate) => name.includes(candidate));
  });
}

function terminalNames() {
  return vscode.window.terminals.map((terminal) => terminal.name).join(', ') || '(none)';
}

function buildPromptOptions(role, phase, workspaceRoot) {
  const roleProfiles = getRoleProfiles();
  const profile = roleProfiles[role] || '';

  return {
    phase,
    profile,
    agent: agentFromProfile(profile),
    workspaceRoot,
    skillContext: {
      kitRoot: getKitRoot()
    }
  };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function suppressBootstrapForRole(role) {
  const current = suppressedBootstrapCounts.get(role) || 0;
  suppressedBootstrapCounts.set(role, current + 1);
}

function consumeSuppressedBootstrap(role) {
  const current = suppressedBootstrapCounts.get(role) || 0;
  if (current <= 0) {
    return false;
  }

  if (current === 1) {
    suppressedBootstrapCounts.delete(role);
  } else {
    suppressedBootstrapCounts.set(role, current - 1);
  }

  return true;
}

async function waitForTerminal(candidates, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const terminal = findTerminal(candidates);
    if (terminal) {
      return terminal;
    }

    await delay(250);
  }

  return null;
}

async function ensureTerminal(spec, role) {
  let terminal = findTerminal(spec.terminalCandidates || []);
  if (terminal) {
    return terminal;
  }

  if (!getAutoOpenMissingTerminal()) {
    return null;
  }

  suppressBootstrapForRole(role);
  await vscode.commands.executeCommand('workbench.action.tasks.runTask', spec.startTaskTitle);
  terminal = await waitForTerminal(spec.terminalCandidates || [], 10000);
  return terminal;
}

async function bootstrapTerminal(terminal) {
  if (!terminal || bootstrappedTerminals.has(terminal)) {
    return;
  }

  const role = detectStartRoleFromTerminalName(terminal.name);
  if (!role) {
    return;
  }

  if (consumeSuppressedBootstrap(role)) {
    return;
  }

  const workspaceRoot = getWorkspaceRoot();
  const state = readState(workspaceRoot);
  const spec = buildRoleSpec(role, getLanguage(), buildPromptOptions(role, state.phase || 'idle', workspaceRoot));

  bootstrappedTerminals.add(terminal);
  await delay(700);
  terminal.sendText(spec.prompt, true);
}

async function sendContinuation(forcedRole) {
  try {
    const workspaceRoot = getWorkspaceRoot();
    const state = readState(workspaceRoot);
    const preview = buildContinuation(state, forcedRole, getLanguage());

    if (!preview.targetRole) {
      vscode.window.showInformationMessage(preview.prompt);
      return;
    }

    const continuationOptions = buildPromptOptions(preview.targetRole, state.phase || 'idle', workspaceRoot);
    const continuation = buildContinuation(state, forcedRole, getLanguage(), continuationOptions);
    const continuationSpec = buildRoleSpec(preview.targetRole, getLanguage(), continuationOptions);
    const terminal = await ensureTerminal(continuationSpec, preview.targetRole);
    if (!terminal) {
      vscode.window.showWarningMessage(
        `AIHandOff could not find an existing ${preview.targetRole} terminal. Open it first. Current terminals: ${terminalNames()}`
      );
      return;
    }

    terminal.show();
    terminal.sendText(continuation.prompt, true);
    vscode.window.showInformationMessage(`AIHandOff sent the next prompt to the ${preview.targetRole} terminal.`);
  } catch (error) {
    vscode.window.showErrorMessage(`AIHandOff bridge failed: ${error.message}`);
  }
}

async function sendRole(role) {
  try {
    const workspaceRoot = getWorkspaceRoot();
    const state = readState(workspaceRoot);
    const spec = buildRoleSpec(role, getLanguage(), buildPromptOptions(role, state.phase || 'idle', workspaceRoot));
    if (!spec.commandTitle) {
      vscode.window.showErrorMessage(`AIHandOff bridge does not know role '${role}'.`);
      return;
    }

    const terminal = await ensureTerminal(spec, role);
    if (!terminal) {
      vscode.window.showWarningMessage(
        `AIHandOff could not find an existing ${role} terminal. Open it first. Current terminals: ${terminalNames()}`
      );
      return;
    }

    terminal.show();
    terminal.sendText(spec.prompt, true);
    vscode.window.showInformationMessage(`AIHandOff sent ${spec.commandTitle} to the existing terminal.`);
  } catch (error) {
    vscode.window.showErrorMessage(`AIHandOff bridge failed: ${error.message}`);
  }
}

function activate(context) {
  if (!vscode.workspace.workspaceFolders) {
    return;
  }

  const planSpec = buildRoleSpec('plan');
  const codeSpec = buildRoleSpec('code');
  const reviewSpec = buildRoleSpec('review');

  context.subscriptions.push(
    vscode.window.onDidOpenTerminal((terminal) => {
      bootstrapTerminal(terminal).catch((error) => {
        vscode.window.showErrorMessage(`AIHandOff bridge failed: ${error.message}`);
      });
    }),
    vscode.commands.registerCommand('aihandoff.continueExistingTerminal', () => sendContinuation()),
    ...planSpec.commandIds.map((commandId) => vscode.commands.registerCommand(commandId, () => sendRole('plan'))),
    ...codeSpec.commandIds.map((commandId) => vscode.commands.registerCommand(commandId, () => sendRole('code'))),
    ...reviewSpec.commandIds.map((commandId) => vscode.commands.registerCommand(commandId, () => sendRole('review')))
  );
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
