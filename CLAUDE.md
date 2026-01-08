# Project Development Environment

## IMPORTANT: Windows Native Development (NO WSL)

This project is developed on **Windows native** - do NOT use WSL, Linux commands, or Unix paths.

## Toolchain Paths (Windows)

### Rust & Cargo
- **Location**: `C:\Users\tucan\.cargo\bin\`
- **Rust version**: 1.92.0
- **Cargo version**: 1.92.0
- **Executables**:
  - `C:\Users\tucan\.cargo\bin\rustc.exe`
  - `C:\Users\tucan\.cargo\bin\cargo.exe`

**IMPORTANT**: Cargo is NOT in the default PATH. Before running any Rust/Cargo commands, add to PATH:
```powershell
$env:Path = $env:Path + ";C:\Users\tucan\.cargo\bin"
```

### Tauri CLI
- **Version**: 2.9.6
- **Location**: Project dependency (not global)
- **How to run**: From `apps/desktop` folder via pnpm:
```powershell
cd C:\Users\tucan\Documents\stefano\hackaton\huggingface_gradio\private_personal_assistant\apps\desktop
pnpm tauri <command>
```

### Node.js & pnpm
- **Node.js**: v22.14.0
- **pnpm**: v10.27.0

## Build Commands

To build the Tauri desktop app:
```powershell
$env:Path = $env:Path + ";C:\Users\tucan\.cargo\bin"
cd C:\Users\tucan\Documents\stefano\hackaton\huggingface_gradio\private_personal_assistant\apps\desktop
pnpm tauri build
```

To run in development mode:
```powershell
$env:Path = $env:Path + ";C:\Users\tucan\.cargo\bin"
cd C:\Users\tucan\Documents\stefano\hackaton\huggingface_gradio\private_personal_assistant\apps\desktop
pnpm tauri dev
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