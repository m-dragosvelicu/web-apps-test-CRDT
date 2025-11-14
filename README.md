# CRDT Collaborative Editor with Yjs

A real-time collaborative text editor using Yjs CRDT library with per-client undo, offline support, and deterministic conflict resolution.

Built as a demonstration of CRDT conflict resolution where multiple clients can simultaneously edit, one can go offline and return, and all changes merge deterministically with no lost updates.

## Quick Start

**IMPORTANT: You need TWO servers running simultaneously:**

```bash
# Terminal 1 - Start the WebSocket server (REQUIRED for collaboration)
npx y-websocket --port 1234

# Terminal 2 - Start the web app
npm run dev
```

Then open **http://localhost:3000** in your browser.

**Both servers must stay running** - if you stop either one, collaboration won't work.

---

## Deliverables ✓

This implementation meets all requirements:

1. **Two robots typing conflicting edits while one goes offline and returns**
   - Click "Start Robots" button in the UI
   - Robot A and B make concurrent edits
   - Robot A goes offline, edits, then reconnects
   - All edits merge deterministically

2. **Deterministic order, no lost updates**
   - Yjs CRDT guarantees eventual consistency
   - Updates can arrive in any order
   - Final document state is always the same
   - Verified via robot simulation and manual testing

3. **Undo reverts only the author's last logical change**
   - Y.UndoManager with per-client tracking
   - Each transaction tagged with client origin
   - Undo only affects current client's operations
   - Other users' edits remain untouched

---

## Validation Tests (All Passing ✓)

### Test 1: Robot Simulation ✓
**Validates: Concurrent edits, offline/online, deterministic merge**

1. Open http://localhost:3000
2. Click **"Start Robots"** button
3. Wait 5 seconds
4. **Expected**: Textarea shows `XXX\nBBB\nAAA\n`

**Proves:**
- Concurrent edits merge correctly
- Offline edits sync on reconnect
- Deterministic order (same result every time)
- No lost updates

### Test 2: Per-Client Undo ✓
**Validates: Undo only affects author's changes**

1. Open http://localhost:3000 in Chrome
2. Open http://localhost:3000 in Incognito
3. Clear text in both windows
4. Window 1: Type "AAA"
5. Window 2: Type "BBB" (both show "AAABBB")
6. Window 1: Click **"Undo"**
7. **Expected**: Both windows show just "BBB"

**Proves:**
- Undo reverts only author's changes
- Other client's text unaffected

### Test 3: Offline/Reconnect ✓
**Validates: Survive disconnect/reconnect**

1. Open in two windows (Chrome + Incognito)
2. Window 1: DevTools (F12) → Network → Check "Offline"
3. Window 1: Badge turns red "Offline"
4. Window 1: Type "OFFLINE"
5. Window 2: Type "ONLINE"
6. Window 1: Uncheck "Offline"
7. **Expected**: Both windows merge to same text

**Proves:**
- Survives disconnect/reconnect
- Offline edits queue and sync
- Deterministic merge

---

## Features

### 1. CRDT Conflict Resolution
- Yjs's battle-tested CRDT algorithm
- Deterministic merge of concurrent edits
- No lost updates regardless of operation order
- Position-based editing with fractional indexing

### 2. Per-Client Undo
- Each client can undo only their own changes
- Y.UndoManager with trackedOrigins
- Operations tagged with unique client ID
- Undo/Redo buttons in UI

### 3. Offline Support
- Disconnect from network and keep editing
- Changes queue locally during offline period
- Automatic sync when connection restored
- Client ID persists across sessions (localStorage)

### 4. Real-Time Sync
- WebSocket-based instant updates
- Connection status indicator (Online/Offline badge)
- Cursor position preservation during remote changes
- Sub-second latency

### 5. Robot Testing
- Built-in simulation for automated verification
- Demonstrates concurrent + offline scenarios
- Click "Start Robots" button to test

---

## Architecture

### Tech Stack
- **Frontend**: React 18, Vite
- **CRDT**: Yjs 13.x
- **Sync**: y-websocket 2.x
- **Styling**: Inline styles + Lucide icons

### Components

**YjsEngine (src/YjsEngine.js)**
- Wrapper around Yjs Y.Doc and Y.Text
- Manages WebSocket provider connection
- Implements per-client undo/redo with Y.UndoManager
- Transaction-based operations with client origin tracking

**CollaborativeEditor (src/CollaborativeEditor.jsx)**
- React component with textarea binding
- Diff-based text change detection for efficiency
- Cursor position preservation during remote updates
- Connection status monitoring
- Robot simulation for testing

**App (src/App.jsx)**
- Root component
- Manages document ID (hardcoded to "shared-doc-1")
- Client ID persistence

### How It Works

1. **Client Initialization**
   - Each client generates unique ID (stored in localStorage)
   - Creates Yjs Y.Doc and Y.Text shared type
   - Connects to WebSocket server at ws://localhost:1234

2. **Text Editing**
   - User types → Diff algorithm detects changes
   - Changes wrapped in `doc.transact(fn, clientId)`
   - Yjs broadcasts updates to WebSocket server
   - Server relays to all connected clients
   - Clients apply updates and rebuild document

3. **Conflict Resolution**
   - Yjs uses vector clocks and fractional indexing
   - Concurrent edits merge deterministically
   - Position conflicts resolved by algorithm
   - No manual conflict resolution needed

4. **Undo/Redo**
   - Y.UndoManager tracks operations by client ID
   - Only records transactions with matching origin
   - `stopCapturing()` separates logical operations
   - Undo reverts last operation, broadcasts as new update

5. **Offline Mode**
   - WebSocket disconnect detected
   - Local edits continue updating Y.Doc
   - Updates queued in memory
   - On reconnect, Yjs syncs state automatically
   - Conflicts resolved via CRDT algorithm

---

## Project Structure

```
webapps exam/
├── package.json              # Dependencies: yjs, y-websocket, react
├── package-lock.json         # Lock file
├── vite.config.js           # Vite configuration
├── index.html               # Entry point
├── .gitignore               # Git ignore rules
├── README.md                # This file
├── TESTING.md               # Detailed testing guide
├── src/                     # Active implementation (Yjs-based)
│   ├── main.jsx             # React root
│   ├── App.jsx              # Main app component
│   ├── YjsEngine.js         # Yjs wrapper class
│   ├── CollaborativeEditor.jsx  # Editor UI component
│   └── index.css            # Global styles
└── old-implementation/      # Archived custom CRDT (reference only)
    ├── README.md            # Why it was replaced
    ├── Components/          # React components
    ├── Entities/            # JSON schemas
    └── Pages/               # Page components
```

---

## Why Yjs?

Replaced custom CRDT implementation with Yjs for:

**Before (Custom Implementation)**:
- Custom fractional indexing with precision issues
- Lamport clocks for ordering
- base44 backend with 2-second polling
- ~600 lines of code
- Limited offline conflict resolution

**After (Yjs)**:
- Battle-tested CRDT algorithm
- Real-time WebSocket sync
- ~200 lines of code
- Proven offline support
- Deterministic merge guarantees

**Benefits**:
- Simpler codebase (3x less code)
- Real-time collaboration (no polling lag)
- Robust conflict resolution
- Industry-proven (used by Figma, Notion, etc.)

---

## Development

### Install Dependencies
```bash
npm install
```

### Run Development Servers
```bash
# Terminal 1
npx y-websocket --port 1234

# Terminal 2
npm run dev
```

### Build for Production
```bash
npm run build
npm run preview
```

### Testing
See [TESTING.md](./TESTING.md) for detailed test procedures.

---

## Limitations & Future Improvements

**Current Limitations**:
1. **No server-side persistence** - Document resets when all clients disconnect
2. **Single document** - Hardcoded to "shared-doc-1"
3. **No user authentication** - Client ID only
4. **No rich text** - Plain text only
5. **No cursor awareness** - Can't see other users' cursors

**Potential Improvements**:
- Add y-indexeddb for client-side persistence
- Add server-side storage (y-leveldb, y-redis)
- Multi-document support with routing
- Rich text editor (y-prosemirror, y-quill)
- Cursor awareness (y-protocols/awareness)
- User authentication integration
- Presence indicators (who's online)
- Version history / time-travel
- Export to file formats

---

## Time Investment
- Setup & Dependencies: ~5 minutes
- YjsEngine Implementation: ~10 minutes
- CollaborativeEditor Component: ~15 minutes
- Testing & Validation: ~10 minutes
- Documentation & Cleanup: ~10 minutes
- **Total: ~50 minutes**

---

## References

- [Yjs Documentation](https://docs.yjs.dev/)
- [y-websocket](https://github.com/yjs/y-websocket)
- [CRDT Explanation](https://crdt.tech/)
- [Original Custom Implementation](./old-implementation/)

---

## License

MIT
