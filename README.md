# AIHandOff

Central AI terminal and handoff toolkit for Windows PowerShell + VS Code.

AIHandOff turns ad-hoc AI CLI sessions into a repeatable plan -> code -> review loop. Keep your agent profiles in one place, install the same workflow into any workspace, then send the next handoff prompt into long-running VS Code terminals without losing context.

## Why it feels different

- One central profile config for OpenCode, Codex, Claude Code, CommandCode, or your own CLI.
- Per-project `.ai-handoff/` state so every workspace keeps its own plan, execution notes, review findings, and fix result.
- VS Code tasks for starting plan, code, and review terminals with consistent names.
- A tiny bridge extension that routes the next prompt to the already-open terminal for the right role.
- No server, database, or cloud dependency. It is just PowerShell, VS Code tasks, and local files.

## What this is

AIHandOff lets you keep your AI CLI profiles in one place, then attach them to any project workspace without copy-pasting terminal prompts or model flags.

The core loop is deliberately simple:

```text
plan terminal   -> writes .ai-handoff/plan.md
code terminal   -> implements and writes .ai-handoff/execution-result.md
review terminal -> reviews git diff and writes .ai-handoff/review-findings.md
bridge command  -> sends the next prompt into the right existing terminal
```

## Quick start

1. Clone this repo once:

```powershell
git clone https://github.com/quangnguyen8/AIHandOff.git
cd AIHandOff
```

2. Install it into a project workspace:

```powershell
pwsh -NoProfile -File .\install.ps1 -WorkspaceRoot C:\path\to\your-project
```

3. Open that project in VS Code and use the `AIHandOff:` tasks.

The installer also installs a small local VS Code bridge extension. Reload VS Code if the bridge commands do not appear immediately.

## 30-second demo loop

After installation in a target workspace:

```text
1. Run task: AIHandOff: Start Plan
2. Run task: AIHandOff: Start Code
3. Run task: AIHandOff: Start Review
4. Run command: AIHandOff: Continue In Existing Terminal
```

From there, the bridge reads `.ai-handoff/state.json` and chooses the next role automatically.

## Getting started

If you only want the shortest path:

1. Clone `AIHandOff` once.
2. Run `install.ps1` against the project you want to connect.
3. Use `AIHandOff: Start Plan`, `AIHandOff: Start Code`, and `AIHandOff: Start Review` inside that project.

## One-liner install

If you already have the repo cloned locally and want to attach it to the current project folder, run the installer from the cloned AIHandOff repo:

```powershell
pwsh -NoProfile -File C:\path\to\AIHandOff\install.ps1 -WorkspaceRoot .
```

For example:

```powershell
pwsh -NoProfile -File D:\Internal\AIHandOff\install.ps1 -WorkspaceRoot .
```

If you prefer a single command that clones and installs in one pass:

```powershell
git clone https://github.com/quangnguyen8/AIHandOff.git $env:TEMP\AIHandOff; pwsh -NoProfile -File $env:TEMP\AIHandOff\install.ps1 -WorkspaceRoot C:\path\to\your-project
```

## Central config

Edit profiles in `config/agents.json`.

Each profile points at an agent command plus its default args. Change the model or CLI flags once here, then reinstall tasks into any workspace that should use the new defaults.

Common profiles:

```text
codex-review
codex-plan
commandcode-plan
commandcode-code
opencode-code
opencode-plan
opencode-review
claude-code
claude-review
```

## VS Code tasks

Run `AIHandOff: Start Plan` for the plan terminal, `AIHandOff: Start Code` for the code terminal, and `AIHandOff: Start Review` for the review terminal.

Run `AIHandOff: Launch Profile` if you want to choose a profile manually.

Run `AIHandOff: List Profiles` to see all configured profiles.

Run `AIHandOff: Open Handoff` or `AIHandOff: Handoff Next` to inspect the local `.ai-handoff/` state.

## Existing-terminal bridge

AIHandOff includes a small VS Code bridge extension so you can keep long-running AI CLI sessions open and send the next handoff prompt into the right terminal.

Use these commands from Command Palette:

```text
AIHandOff: Continue In Existing Terminal
AIHandOff: Plan Write To Handoff
AIHandOff: Code Write To Handoff
AIHandOff: Review Write Findings
```

`AIHandOff: Continue In Existing Terminal` reads `.ai-handoff/state.json`, chooses the next role, finds an already-open terminal for that role, and sends a prompt with `terminal.sendText(...)`.
`AIHandOff: Code Write To Handoff` sends the code terminal a prompt that tells it to write the current implementation or fix result into `.ai-handoff/`.
`AIHandOff: Review Write Findings` sends the review terminal a prompt that tells it to write findings into `.ai-handoff/review-findings.md`.

Use this when you want to keep one code session and one review session alive across multiple handoff rounds. The bridge does not replace the running CLI session; it just feeds the next prompt into the existing terminal so the agent keeps its local context.

Expected phase routing:

```text
idle/planning     -> plan terminal
planned           -> code terminal
code_done         -> review terminal
review_findings   -> code terminal
fix_done          -> review terminal
approved          -> no automatic action
```

Keep terminal names recognizable by launching them with the installed tasks first. For example, run `AIHandOff: Start Code` and `AIHandOff: Start Review` once, then use `AIHandOff: Continue In Existing Terminal` for the loop.

### Recommended loop

1. Run `AIHandOff: Start Plan`.
2. Run `AIHandOff: Code Write To Handoff` or `AIHandOff: Start Code`.
3. Let the code terminal update `.ai-handoff/state.json` and the handoff files.
4. Run `AIHandOff: Review Write Findings` or `AIHandOff: Start Review`.
5. If review writes findings, run `AIHandOff: Code Write To Handoff` again to fix them.
6. If review approves, stop the loop and merge or publish the result.

### What each command does

`AIHandOff: Start Plan`
: Opens the plan profile in a terminal and lets you create or refine the next step list.

`AIHandOff: Start Code`
: Opens the code profile in a terminal for implementation work.

`AIHandOff: Start Review`
: Opens the review profile in a terminal for review work.

`AIHandOff: Code Write To Handoff`
: Sends a code-focused prompt into the already-open code terminal so it writes progress into `.ai-handoff/`.

`AIHandOff: Review Write Findings`
: Sends a review-focused prompt into the already-open review terminal so it writes findings into `.ai-handoff/review-findings.md`.

`AIHandOff: Continue In Existing Terminal`
: Chooses the next role from `.ai-handoff/state.json` and sends the matching prompt into the already-open terminal.

## Direct CLI usage

List profiles:

```powershell
pwsh -NoProfile -File .\scripts\ai-terminal.ps1 -List
```

Launch a profile in the current repo:

```powershell
pwsh -NoProfile -File .\scripts\ai-terminal.ps1 -Profile opencode-code -WorkspaceRoot .
```

Preview the exact command without launching:

```powershell
pwsh -NoProfile -File .\scripts\ai-terminal.ps1 -Profile opencode-review -PrintCommand
```

## Typical daily workflow

1. Open the target repo in VS Code.
2. Start the planning terminal with `AIHandOff: Start Plan`.
   - This is where you write or refine the next step list.
   - Keep the plan short and specific enough for the code terminal to follow.
3. Start the coding terminal with `AIHandOff: Start Code`.
   - This is where you make the actual change in the repo.
   - The code terminal should follow the plan and write progress into `.ai-handoff/`.
4. Start the review terminal with `AIHandOff: Start Review`.
   - You only need to open this once if you want to preserve review-session context.
5. When code finishes and updates `.ai-handoff/state.json` to `code_done`, run `AIHandOff: Continue In Existing Terminal`.
   - The bridge sends a review prompt into the already-open review terminal.
6. When review finishes:
   - If it updates state to `review_findings`, run `AIHandOff: Continue In Existing Terminal` again. The bridge sends a fix prompt into the already-open code terminal.
   - If it updates state to `approved`, stop the loop.
7. When you want to inspect what either terminal left behind, run `AIHandOff: Open Handoff` or `AIHandOff: Handoff Next`.
   - This shows the local handoff files for the current workspace.
   - Use it when you want to see the current state without hunting through folders.
8. If the change has lasting impact, update the repo's own release, docs, or state files after approval.

## Handoff convention

Use a project-local `.ai-handoff/` folder for artifacts that multiple AI terminals can read:

```text
.ai-handoff/
  state.json
  plan.md
  execution-result.md
  review-findings.md
  fix-result.md
```

The terminal profiles are central. The handoff state stays local to each repo.

Because `.ai-handoff/` can contain local plans, review notes, and implementation details, add it to your project `.gitignore` unless your team intentionally wants to commit those artifacts.

## Notes

- This README stays generic on purpose.
- Workspace-specific flow rules belong in that workspace's own docs or release notes.
- Per-repo profile choices can differ by project; adjust `config/agents.json` once, then reinstall tasks into each workspace.
