import React, { useState } from 'react';
import CollaborativeEditor from './CollaborativeEditor';

export default function App() {
  const [documentId] = useState(
    () => localStorage.getItem('currentDocId') || 'shared-doc-1'
  );

  // Save document ID
  useState(() => {
    localStorage.setItem('currentDocId', documentId);
  });

  return (
    <div>
      <CollaborativeEditor documentId={documentId} />
    </div>
  );
}
