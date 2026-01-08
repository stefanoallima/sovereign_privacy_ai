# AI Agent Instructions

## CRITICAL: Windows Native Development (NO WSL)

This project runs on **Windows native only**. Do NOT use:
- WSL (Windows Subsystem for Linux)
- Linux/Unix shell commands
- Unix-style paths (use backslashes `\`)

## Toolchain Locations

| Tool | Path | Version |
|------|------|---------|
| Rust | `C:\Users\tucan\.cargo\bin\rustc.exe` | 1.92.0 |
| Cargo | `C:\Users\tucan\.cargo\bin\cargo.exe` | 1.92.0 |
| Node.js | System PATH | v22.14.0 |
| pnpm | System PATH | v10.27.0 |
| Tauri CLI | Project dependency | 2.9.6 |

## Before Running Rust/Cargo Commands

Cargo is NOT in the default PATH. Always run this first:
```powershell
$env:Path = $env:Path + ";C:\Users\tucan\.cargo\bin"
```

## Tauri Commands

Tauri is a project dependency, run from `apps/desktop`:
```powershell
$env:Path = $env:Path + ";C:\Users\tucan\.cargo\bin"
cd C:\Users\tucan\Documents\stefano\hackaton\huggingface_gradio\private_personal_assistant\apps\desktop
pnpm tauri dev    # Development mode
pnpm tauri build  # Production build
```

---

<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->