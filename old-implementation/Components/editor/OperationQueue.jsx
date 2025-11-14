import React, { useState, useEffect, useRef } from "react";

// Manages offline operation queue and syncing
export function useOperationQueue(documentId, clientId, isOnline) {
  const [queue, setQueue] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncIntervalRef = useRef(null);

  // Add operation to queue
  const enqueue = (operation) => {
    setQueue((prev) => [...prev, operation]);
  };

  // Process queue when online
  const processQueue = async (syncCallback) => {
    if (!isOnline || queue.length === 0 || isSyncing) return;

    setIsSyncing(true);
    try {
      for (const op of queue) {
        await syncCallback(op);
      }
      setQueue([]);
    } catch (error) {
      console.error("Error processing queue:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  return {
    queue,
    queueSize: queue.length,
    enqueue,
    processQueue,
    isSyncing,
    clearQueue: () => setQueue([]),
  };
}

export default useOperationQueue;
