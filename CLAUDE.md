# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev           # Start Electron app in dev mode (hot reload)

# Type checking
npm run typecheck     # Run both node and web typechecks
npm run typecheck:node  # Check main + preload (tsconfig.node.json)
npm run typecheck:web   # Check renderer (tsconfig.web.json)

# Linting & formatting
npm run lint          # ESLint with cache
npm run format        # Prettier write

# Build
npm run build         # Typecheck + electron-vite build
npm run build:mac     # Build macOS distributable
npm run build:win     # Build Windows distributable
npm run build:linux   # Build Linux distributable
```

There are no tests yet.

## Architecture

This is an **Electron + React + TypeScript** desktop app for managing DAW (Digital Audio Workstation) project files. It uses `electron-vite` as the build tool.

### Process Model

The app follows Electron's multi-process architecture with strict security (`contextIsolation: true`, `nodeIntegration: false`):

```
Main Process (Node.js)          Preload (Bridge)           Renderer (React)
src/main/index.ts               src/preload/index.ts       src/renderer/src/
  └─ ipc/*.ts (handlers)          exposes window.api         App.tsx, components/
```

- **Main process** (`src/main/`): All Node.js/system access happens here. IPC handlers are registered in `src/main/index.ts` on app startup and implemented in `src/main/ipc/`.
- **Preload** (`src/preload/index.ts`): The only bridge between main and renderer. Exposes a typed `window.api` object via `contextBridge`. The type declarations live in `src/preload/index.d.ts` — **this is where shared domain types** (`Project`, `User`, `SyncStatus`, `SyncProgress`, `Share`) are defined.
- **Renderer** (`src/renderer/src/`): Pure React app. Must access all system/main-process functionality through `window.api.*` — never import Node modules directly.

### IPC Handler Pattern

Each feature domain has its own handler file in `src/main/ipc/`:

| File | IPC channel prefix | Responsibility |
|------|--------------------|----------------|
| `scanHandlers.ts` | `scan:*` | File system scanning, directory watching |
| `projectHandlers.ts` | `projects:*` | CRUD for local project records, open in DAW |
| `syncHandlers.ts` | `sync:*` | Upload/download to Supabase, conflict resolution |
| `authHandlers.ts` | `auth:*` | Supabase auth (login, logout, signUp, getSession) |
| `shareHandlers.ts` | `share:*` | Project sharing/permissions |

All handlers are currently stubs — the IPC channel contracts are defined in `src/preload/index.ts` and typed in `src/preload/index.d.ts`.

When adding a new IPC handler: (1) implement `ipcMain.handle('channel:name', ...)` in the appropriate handler file, (2) add the renderer-side call to `src/preload/index.ts`, (3) add the type signature to `src/preload/index.d.ts`.

### Key Dependencies

- **better-sqlite3**: Local database for project metadata
- **@supabase/supabase-js**: Cloud sync and auth backend
- **chokidar + fast-glob**: File system watching and scanning
- **zustand**: Renderer state management
- **react-router-dom v7**: Client-side routing in renderer
- **shadcn/ui** (Radix UI + Tailwind CSS v4): UI components

### TypeScript Configuration

Two separate `tsconfig` files with different environments:
- `tsconfig.node.json` — covers `src/main/**` and `src/preload/**` (Node.js environment)
- `tsconfig.web.json` — covers `src/renderer/src/**` (browser environment), path alias `@renderer/*` → `src/renderer/src/*`
