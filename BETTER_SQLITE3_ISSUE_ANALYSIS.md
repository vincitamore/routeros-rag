# Better-SQLite3 Native Binding Issue Analysis

## Issue Summary

We are experiencing persistent native binding errors with `better-sqlite3` in our RouterOS RAG Network Portal project. The package cannot locate the compiled `.node` bindings required for SQLite operations, preventing the database from initializing.

## Environment Details

- **OS**: Windows 10.0.22631 (win32)
- **Node.js**: v20.19.0
- **npm**: 10.8.2
- **pnpm**: 10.8.1
- **Shell**: PowerShell 7 (C:\Program Files\PowerShell\7\pwsh.exe)
- **Project Structure**: Monorepo with pnpm workspaces
- **Workspace Path**: `/c%3A/Users/AlexMoyer/Documents/routeros-rag`

## Package Versions Attempted

### better-sqlite3
- **Version 9.0.0**: Initial attempt - failed with binding errors
- **Version 11.10.0**: Upgraded version - same binding errors
- **Installation Methods Tried**:
  - `pnpm install better-sqlite3` (from package directory)
  - `pnpm add better-sqlite3 --filter network-portal` (from workspace root)
  - `pnpm rebuild better-sqlite3`

### Alternative Attempted: sql.js
- **Version**: 1.13.0
- **Issue**: WASM loading problems with URL path resolution
- **Status**: Abandoned due to complexity

## Error Logs

### Primary Error (better-sqlite3 v11.10.0)
```
Failed to initialize database: Error: Could not locate the bindings file. Tried:
 → C:\Users\AlexMoyer\Documents\routeros-rag\node_modules\.pnpm\better-sqlite3@11.10.0\node_modules\better-sqlite3\build\better_sqlite3.node
 → C:\Users\AlexMoyer\Documents\routeros-rag\node_modules\.pnpm\better-sqlite3@11.10.0\node_modules\better-sqlite3\build\Debug\better_sqlite3.node
 → C:\Users\AlexMoyer\Documents\routeros-rag\node_modules\.pnpm\better-sqlite3@11.10.0\node_modules\better-sqlite3\build\Release\better_sqlite3.node
 → C:\Users\AlexMoyer\Documents\routeros-rag\node_modules\.pnpm\better-sqlite3@11.10.0\node_modules\better-sqlite3\out\Debug\better_sqlite3.node
 → C:\Users\AlexMoyer\Documents\routeros-rag\node_modules\.pnpm\better-sqlite3@11.10.0\node_modules\better-sqlite3\Debug\better_sqlite3.node
 → C:\Users\AlexMoyer\Documents\routeros-rag\node_modules\.pnpm\better-sqlite3@11.10.0\node_modules\better-sqlite3\out\Release\better_sqlite3.node
 → C:\Users\AlexMoyer\Documents\routeros-rag\node_modules\.pnpm\better-sqlite3@11.10.0\node_modules\better-sqlite3\Release\better_sqlite3.node
 → C:\Users\AlexMoyer\Documents\routeros-rag\node_modules\.pnpm\better-sqlite3@11.10.0\node_modules\better-sqlite3\build\default\better_sqlite3.node
 → C:\Users\AlexMoyer\Documents\routeros-rag\node_modules\.pnpm\better-sqlite3@11.10.0\node_modules\better-sqlite3\compiled\20.19.0\win32\x64\better_sqlite3.node
 → C:\Users\AlexMoyer\Documents\routeros-rag\node_modules\.pnpm\better-sqlite3@11.10.0\node_modules\better-sqlite3\addon-build\release\install-root\better_sqlite3.node
 → C:\Users\AlexMoyer\Documents\routeros-rag\node_modules\.pnpm\better-sqlite3@11.10.0\node_modules\better-sqlite3\addon-build\debug\install-root\better_sqlite3.node
 → C:\Users\AlexMoyer\Documents\routeros-rag\node_modules\.pnpm\better-sqlite3@11.10.0\node_modules\better-sqlite3\addon-build\default\install-root\better_sqlite3.node
 → C:\Users\AlexMoyer\Documents\routeros-rag\node_modules\.pnpm\better-sqlite3@11.10.0\node_modules\better-sqlite3\lib\binding\node-v115-win32-x64\better_sqlite3.node

    at bindings (C:\Users\AlexMoyer\Documents\routeros-rag\node_modules\.pnpm\bindings@1.5.0\node_modules\bindings\bindings.js:126:9)   
    at new Database (C:\Users\AlexMoyer\Documents\routeros-rag\node_modules\.pnpm\better-sqlite3@11.10.0\node_modules\better-sqlite3\lib\database.js:48:64)
    at initializeDatabase (C:\Users\AlexMoyer\Documents\routeros-rag\packages\network-portal\server\database\init.ts:8:16)
```

### sql.js Alternative Error
```
failed to asynchronously prepare wasm: Error: ENOENT: no such file or directory, open 'C:\Users\AlexMoyer\Documents\routeros-rag\packages\network-portal\https:\sql.js.org\dist\sql-wasm.wasm'
Aborted(Error: ENOENT: no such file or directory, open 'C:\Users\AlexMoyer\Documents\routeros-rag\packages\network-portal\https:\sql.js.org\dist\sql-wasm.wasm')
```

## All Attempts Made

### 1. Initial Installation
```bash
cd packages/network-portal
pnpm install better-sqlite3
```
**Result**: Failed with binding errors

### 2. Version Upgrade
```bash
pnpm remove better-sqlite3
pnpm install better-sqlite3@latest  # Got v11.10.0
```
**Result**: Same binding errors

### 3. Rebuild Attempt
```bash
pnpm rebuild better-sqlite3
```
**Result**: No output, still failed

### 4. Workspace Root Installation
```bash
cd ../../  # Go to workspace root
pnpm add better-sqlite3 --filter network-portal
```
**Result**: Installed successfully, but still binding errors at runtime

### 5. Alternative: sql.js
```bash
pnpm install sql.js @types/sql.js
```
**Result**: WASM loading issues, path resolution problems

### 6. sql.js Path Fix Attempts
- Tried CDN approach: `https://sql.js.org/dist/${file}`
- Tried local path: `join(process.cwd(), 'node_modules', 'sql.js', 'dist', file)`
**Result**: Both failed with file not found errors

### 7. Reverting to better-sqlite3
```bash
pnpm remove sql.js @types/sql.js
# Restored original better-sqlite3 code
```
**Result**: Back to original binding errors

## Root Cause Analysis

### Primary Issues Identified

1. **pnpm + Native Modules + Windows**: 
   - pnpm uses symlinks which can cause path resolution issues for native bindings
   - Windows requires specific build tools (Visual Studio Build Tools, Python) for native compilation
   - The `.node` files are not being compiled during installation

2. **Missing Build Environment**:
   - No Python detected when checked with `where python && where python3`
   - Likely missing Visual Studio Build Tools or Windows SDK
   - Node.js native module compilation requires these tools

3. **pnpm Symlink Structure**:
   - The error shows paths like `C:\Users\AlexMoyer\Documents\routeros-rag\node_modules\.pnpm\better-sqlite3@11.10.0\node_modules\better-sqlite3\`
   - This complex symlink structure may be confusing the bindings resolution

### Why This Should Be Straightforward

You're absolutely right - this should be straightforward. Most developers don't encounter these issues because:
- npm handles native modules more reliably than pnpm in some cases
- Many development environments already have the required build tools
- Pre-compiled binaries are usually available for common platforms

## Potential Solutions to Try Next

### Option 1: Install Windows Build Tools
```bash
# Install Windows Build Tools
npm install -g windows-build-tools

# Or install Visual Studio Build Tools manually
# https://visualstudio.microsoft.com/visual-cpp-build-tools/
```

### Option 2: Use npm instead of pnpm for this package
```bash
# Remove from pnpm
pnpm remove better-sqlite3

# Install with npm directly in the package
cd packages/network-portal
npm install better-sqlite3
```

### Option 3: Use pre-compiled binaries
```bash
# Force download of pre-compiled binary
pnpm install better-sqlite3 --build-from-source=false
```

### Option 4: Switch to a different SQLite package
- `sqlite3` (node-sqlite3) - more mature, better Windows support
- `@sqlite.org/sqlite-wasm` - official SQLite WASM
- `sqlite` (synchronous SQLite for Node.js)

### Option 5: Use .npmrc configuration
Create `.npmrc` in the package directory:
```
better-sqlite3_binary_host_mirror=https://github.com/WiseLibs/better-sqlite3/releases/download/
```

### Option 6: Docker Development Environment
Use Docker to avoid Windows native compilation issues entirely.

## Current Status

- **Phase 1 Implementation**: Blocked on database initialization
- **Better-SQLite3**: Multiple versions attempted, all failing with binding errors
- **Alternative (sql.js)**: Attempted but abandoned due to WASM loading complexity
- **Next Steps**: Need to resolve native compilation or choose alternative database solution

## Impact on Project

This issue is blocking:
- Database initialization for the network portal
- Backend server startup
- Progress on Phase 1 of the Network Monitoring Implementation Plan
- Integration testing of the monitoring system

## Recommendation

Given the complexity and time spent on this issue, I recommend:

1. **Immediate**: Try Option 2 (npm install) as it often resolves pnpm + native module conflicts
2. **If that fails**: Try Option 4 (switch to `sqlite3` package which has better Windows support)
3. **Long-term**: Consider Option 6 (Docker) for consistent development environment across platforms

The goal is to get Phase 1 unblocked so we can continue with the implementation plan. 