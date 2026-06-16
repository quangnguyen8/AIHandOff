const fs = require('fs');
const path = require('path');
const vscode = require('vscode');
const { buildContinuation, buildRoleSpec } = require('./prompt-router');

function getWorkspaceRoot() {
  const folder = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0];
  if (!folder) {
    throw new Error('Open a workspace folder before using AIHandOff.');
  }

  return folder.uri.fsPath;
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

async function sendContinuation(forcedRole) {
  try {
    const workspaceRoot = getWorkspaceRoot();
    const state = readState(workspaceRoot);
    const continuation = buildContinuation(state, forcedRole);

    if (!continuation.targetRole) {
      vscode.window.showInformationMessage(continuation.prompt);
      return;
    }

    const terminal = findTerminal(continuation.terminalCandidates || []);
    if (!terminal) {
      vscode.window.showWarningMessage(
        `AIHandOff could not find an existing ${continuation.targetRole} terminal. Open it first. Current terminals: ${terminalNames()}`
      );
      return;
    }

    terminal.show();
    terminal.sendText(continuation.prompt, true);
    vscode.window.showInformationMessage(`AIHandOff sent the next prompt to the ${continuation.targetRole} terminal.`);
  } catch (error) {
    vscode.window.showErrorMessage(`AIHandOff bridge failed: ${error.message}`);
  }
}

async function sendRole(role) {
  try {
    const spec = buildRoleSpec(role);
    if (!spec.commandTitle) {
      vscode.window.showErrorMessage(`AIHandOff bridge does not know role '${role}'.`);
      return;
    }

    const workspaceRoot = getWorkspaceRoot();
    readState(workspaceRoot);

    const terminal = findTerminal(spec.terminalCandidates || []);
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
