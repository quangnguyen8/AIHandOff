# AIHandOff

Central AI terminal and handoff toolkit for Windows PowerShell + VS Code.

## What this is

AIHandOff lets you keep your AI CLI profiles in one place, then attach them to any project workspace without copy-pasting terminal prompts or model flags.

## Quick start

1. Clone this repo once:

```powershell
git clone https://github.com/quangnguyen8/AIHandOff.git
```

2. Install it into a project workspace:

```powershell
pwsh -NoProfile -File .\install.ps1 -WorkspaceRoot C:\path\to\your-project
```

3. Open that project in VS Code and use the `AIHandOff:` tasks.

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
4. When you want to check what the code terminal left behind, run `AIHandOff: Open Handoff` or `AIHandOff: Handoff Next`.
   - This shows the local handoff files for the current workspace.
   - Use it when you want to see the current state without hunting through folders.
5. Start the review terminal with `AIHandOff: Start Review`.
   - This terminal should read `.ai-handoff/` and compare it with `git diff`.
   - Use it to collect findings before you decide whether the change is done.
6. If review returns findings, go back to `AIHandOff: Start Code` and fix them.
7. Run `AIHandOff: Start Review` again until the findings are clean enough to approve.
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

## Notes

- This README stays generic on purpose.
- Workspace-specific flow rules belong in that workspace's own docs or release notes.
- Per-repo profile choices can differ by project; adjust `config/agents.json` once, then reinstall tasks into each workspace.
