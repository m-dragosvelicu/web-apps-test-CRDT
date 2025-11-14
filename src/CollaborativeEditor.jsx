import React, { useState, useEffect, useRef } from 'react';
import { YjsEngine } from './YjsEngine';
import { Wifi, WifiOff, Undo, Redo, Play } from 'lucide-react';

export default function CollaborativeEditor({ documentId }) {
  const [text, setText] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [clientId] = useState(
    () => localStorage.getItem('clientId') ||
    `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  );

  const textareaRef = useRef(null);
  const engineRef = useRef(null);
  const isRemoteChange = useRef(false);

  // Initialize Yjs engine
  useEffect(() => {
    // Save client ID for session persistence
    localStorage.setItem('clientId', clientId);

    // Create Yjs engine
    const engine = new YjsEngine(documentId, clientId);
    engineRef.current = engine;

    // Listen for connection changes
    engine.onConnectionChange = (connected) => {
      setIsConnected(connected);
    };

    // Listen for text changes from other clients
    engine.onTextChange((newText) => {
      isRemoteChange.current = true;

      // Save cursor position
      const textarea = textareaRef.current;
      const start = textarea?.selectionStart || 0;
      const end = textarea?.selectionEnd || 0;

      setText(newText);

      // Restore cursor position after React updates
      setTimeout(() => {
        if (textarea) {
          textarea.selectionStart = start;
          textarea.selectionEnd = end;
        }
        isRemoteChange.current = false;
      }, 0);
    });

    // Set initial text
    setText(engine.getText());

    return () => {
      engine.destroy();
    };
  }, [documentId, clientId]);

  // Handle text area changes
  const handleChange = (e) => {
    if (isRemoteChange.current) return;

    const newValue = e.target.value;
    const oldValue = text;
    const cursor = e.target.selectionStart;

    // Calculate diff to determine what changed
    let commonPrefixLength = 0;
    while (
      commonPrefixLength < oldValue.length &&
      commonPrefixLength < newValue.length &&
      oldValue[commonPrefixLength] === newValue[commonPrefixLength]
    ) {
      commonPrefixLength++;
    }

    let commonSuffixLength = 0;
    while (
      commonSuffixLength < oldValue.length - commonPrefixLength &&
      commonSuffixLength < newValue.length - commonPrefixLength &&
      oldValue[oldValue.length - 1 - commonSuffixLength] ===
      newValue[newValue.length - 1 - commonSuffixLength]
    ) {
      commonSuffixLength++;
    }

    const deletedText = oldValue.substring(
      commonPrefixLength,
      oldValue.length - commonSuffixLength
    );
    const insertedText = newValue.substring(
      commonPrefixLength,
      newValue.length - commonSuffixLength
    );

    const engine = engineRef.current;

    // Apply changes to Yjs
    if (deletedText.length > 0) {
      engine.delete(commonPrefixLength, deletedText.length);
    }
    if (insertedText.length > 0) {
      engine.insert(commonPrefixLength, insertedText);
    }

    // Update local state
    setText(newValue);
  };

  // Undo handler
  const handleUndo = () => {
    engineRef.current?.undo();
  };

  // Redo handler
  const handleRedo = () => {
    engineRef.current?.redo();
  };

  // Robot testing function
  const simulateRobots = () => {
    const engine = engineRef.current;
    if (!engine) return;

    // Robot A - Insert at beginning
    setTimeout(() => {
      console.log('Robot A: Inserting "AAA"');
      engine.insert(0, 'AAA\n');
    }, 100);

    // Robot B - Insert after 500ms
    setTimeout(() => {
      console.log('Robot B: Inserting "BBB"');
      engine.insert(0, 'BBB\n');
    }, 500);

    // Robot A - Go offline, insert, then reconnect
    setTimeout(() => {
      console.log('Robot A: Going offline');
      engine.disconnect();
    }, 1000);

    setTimeout(() => {
      console.log('Robot A: Inserting "XXX" while offline');
      engine.insert(0, 'XXX\n');
    }, 1500);

    setTimeout(() => {
      console.log('Robot A: Reconnecting');
      engine.connect();
    }, 3000);
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <h2 style={styles.title}>CRDT Collaborative Editor</h2>
          <div style={styles.badge}>
            {isConnected ? (
              <>
                <Wifi size={14} style={{ marginRight: 4 }} />
                Online
              </>
            ) : (
              <>
                <WifiOff size={14} style={{ marginRight: 4 }} />
                Offline
              </>
            )}
          </div>
        </div>

        <div style={styles.headerRight}>
          <button onClick={handleUndo} style={styles.button}>
            <Undo size={16} style={{ marginRight: 4 }} />
            Undo
          </button>
          <button onClick={handleRedo} style={styles.button}>
            <Redo size={16} style={{ marginRight: 4 }} />
            Redo
          </button>
          <button onClick={simulateRobots} style={styles.robotButton}>
            <Play size={16} style={{ marginRight: 4 }} />
            Start Robots
          </button>
        </div>
      </div>

      {/* Editor */}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleChange}
        placeholder="Start typing... Open this page in multiple windows to see real-time collaboration!"
        style={styles.textarea}
      />

      {/* Info */}
      <div style={styles.info}>
        <div style={styles.infoItem}>
          <strong>Client ID:</strong> {clientId.slice(0, 20)}...
        </div>
        <div style={styles.infoItem}>
          <strong>Document ID:</strong> {documentId}
        </div>
        <div style={styles.infoItem}>
          <strong>Characters:</strong> {text.length}
        </div>
      </div>

      {/* Instructions */}
      <div style={styles.instructions}>
        <h3 style={styles.instructionsTitle}>How It Works:</h3>
        <ul style={styles.instructionsList}>
          <li>
            <strong>CRDT Conflict Resolution:</strong> Yjs uses a CRDT algorithm to merge
            concurrent edits deterministically with no lost updates.
          </li>
          <li>
            <strong>Per-Client Undo:</strong> Each client can undo only their own changes
            without affecting others' work.
          </li>
          <li>
            <strong>Offline Support:</strong> Disconnect and keep editing. Changes sync
            automatically when you reconnect.
          </li>
          <li>
            <strong>Robot Testing:</strong> Click "Start Robots" to simulate two clients
            making conflicting edits while one goes offline and returns.
          </li>
        </ul>
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '2rem',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
    flexWrap: 'wrap',
    gap: '1rem',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  headerRight: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: '#1e293b',
  },
  badge: {
    display: 'flex',
    alignItems: 'center',
    padding: '0.25rem 0.75rem',
    background: '#10b981',
    color: 'white',
    borderRadius: '1rem',
    fontSize: '0.875rem',
    fontWeight: '500',
  },
  button: {
    display: 'flex',
    alignItems: 'center',
    padding: '0.5rem 1rem',
    fontSize: '0.875rem',
  },
  robotButton: {
    display: 'flex',
    alignItems: 'center',
    padding: '0.5rem 1rem',
    fontSize: '0.875rem',
    background: '#f59e0b',
  },
  textarea: {
    width: '100%',
    height: '400px',
    padding: '1rem',
    fontSize: '1rem',
    border: '2px solid #e2e8f0',
    borderRadius: '0.5rem',
    resize: 'vertical',
    outline: 'none',
    background: 'white',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  },
  info: {
    display: 'flex',
    gap: '2rem',
    marginTop: '1rem',
    padding: '1rem',
    background: 'white',
    borderRadius: '0.5rem',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
    fontSize: '0.875rem',
    color: '#64748b',
    flexWrap: 'wrap',
  },
  infoItem: {
    display: 'flex',
    gap: '0.5rem',
  },
  instructions: {
    marginTop: '2rem',
    padding: '1.5rem',
    background: 'white',
    borderRadius: '0.5rem',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
  },
  instructionsTitle: {
    fontSize: '1.125rem',
    fontWeight: '600',
    marginBottom: '1rem',
    color: '#1e293b',
  },
  instructionsList: {
    listStyle: 'none',
    padding: 0,
  },
};
