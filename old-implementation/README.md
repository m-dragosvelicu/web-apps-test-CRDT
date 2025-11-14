# Old Implementation (Archived)

This folder contains the original custom CRDT implementation that was replaced with Yjs.

## Contents

- **Components/editor/** - Original React components
  - `CRDTEngine.jsx` - Custom fractional indexing + Lamport clocks
  - `CollaborativeEditor.jsx` - Editor with base44 backend integration
  - `OperationQueue.jsx` - Offline operation queue

- **Entities/** - JSON schemas for base44 backend
  - `Operation` - Operation entity schema
  - `Document` - Document entity schema

- **Pages/** - Page components
  - `Editor.jsx` - Main editor page with document management

## Why This Was Replaced

The custom implementation worked but had several limitations:

1. **Fractional indexing precision issues** - Simple midpoint calculation could hit floating-point limits
2. **Polling-based sync** - 2-second polling instead of real-time WebSocket
3. **Complex codebase** - Custom CRDT logic vs. battle-tested Yjs
4. **Offline conflict resolution** - Limited handling of position conflicts during reconnection
5. **No persistence layer** - Tab crashes lost queued operations

## New Implementation Benefits

- **Yjs CRDT** - Proven, deterministic merge algorithm
- **Real-time sync** - WebSocket-based instant updates
- **Simpler code** - ~200 lines vs. ~600 lines
- **Robust offline support** - Automatic conflict resolution
- **Better undo** - Per-client tracking with Y.UndoManager

This folder is kept for reference only.
