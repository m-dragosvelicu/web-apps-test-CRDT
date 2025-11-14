import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

/**
 * YjsEngine - Wrapper around Yjs for collaborative editing
 * Replaces custom CRDT implementation with battle-tested Yjs
 */
export class YjsEngine {
  constructor(documentId, clientId) {
    this.documentId = documentId;
    this.clientId = clientId;

    // Create Yjs document
    this.doc = new Y.Doc();

    // Get the shared text type
    this.ytext = this.doc.getText('content');

    // Create WebSocket provider for real-time sync
    this.provider = new WebsocketProvider(
      'ws://localhost:1234',
      documentId,
      this.doc
    );

    // Create undo manager with per-client tracking
    this.undoManager = new Y.UndoManager(this.ytext, {
      trackedOrigins: new Set([clientId])
    });

    // Track connection status
    this.isConnected = false;
    this.provider.on('status', (event) => {
      this.isConnected = event.status === 'connected';
      if (this.onConnectionChange) {
        this.onConnectionChange(this.isConnected);
      }
    });
  }

  /**
   * Get current text content
   */
  getText() {
    return this.ytext.toString();
  }

  /**
   * Insert text at position (wrapped in transaction with client origin)
   */
  insert(index, text) {
    this.doc.transact(() => {
      this.ytext.insert(index, text);
    }, this.clientId);

    // Separate logical operations for undo
    this.undoManager.stopCapturing();
  }

  /**
   * Delete text from position (wrapped in transaction with client origin)
   */
  delete(index, length) {
    this.doc.transact(() => {
      this.ytext.delete(index, length);
    }, this.clientId);

    // Separate logical operations for undo
    this.undoManager.stopCapturing();
  }

  /**
   * Undo last operation by this client
   */
  undo() {
    this.undoManager.undo();
  }

  /**
   * Redo last undone operation by this client
   */
  redo() {
    this.undoManager.redo();
  }

  /**
   * Subscribe to text changes
   */
  onTextChange(callback) {
    this.ytext.observe(() => {
      callback(this.getText());
    });
  }

  /**
   * Disconnect from WebSocket server (simulate offline)
   */
  disconnect() {
    this.provider.disconnect();
  }

  /**
   * Reconnect to WebSocket server
   */
  connect() {
    this.provider.connect();
  }

  /**
   * Clean up resources
   */
  destroy() {
    this.provider.destroy();
    this.doc.destroy();
  }
}

export default YjsEngine;
