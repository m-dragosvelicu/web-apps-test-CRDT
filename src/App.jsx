import React, { useState, useEffect } from 'react';
import CollaborativeEditor from './CollaborativeEditor';
import TestRunner from './TestRunner';

export default function App() {
  const [mode, setMode] = useState('editor'); // 'editor' or 'test'
  const [documentId] = useState(
    () => localStorage.getItem('currentDocId') || 'shared-doc-1'
  );

  // Persist document ID to localStorage
  useEffect(() => {
    localStorage.setItem('currentDocId', documentId);
  }, [documentId]);

  return (
    <div>
      {/* Mode Toggle */}
      <div style={styles.modeToggle}>
        <button
          onClick={() => setMode('editor')}
          style={{
            ...styles.modeButton,
            background: mode === 'editor' ? '#4f46e5' : '#e2e8f0',
            color: mode === 'editor' ? 'white' : '#64748b',
          }}
        >
          Editor
        </button>
        <button
          onClick={() => setMode('test')}
          style={{
            ...styles.modeButton,
            background: mode === 'test' ? '#4f46e5' : '#e2e8f0',
            color: mode === 'test' ? 'white' : '#64748b',
          }}
        >
          Visual Tests
        </button>
      </div>

      {/* Content */}
      {mode === 'editor' ? (
        <CollaborativeEditor documentId={documentId} />
      ) : (
        <TestRunner />
      )}
    </div>
  );
}

const styles = {
  modeToggle: {
    display: 'flex',
    gap: '0.5rem',
    padding: '1rem',
    background: 'white',
    borderBottom: '1px solid #e2e8f0',
    justifyContent: 'center',
  },
  modeButton: {
    padding: '0.5rem 1.5rem',
    border: 'none',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
};
