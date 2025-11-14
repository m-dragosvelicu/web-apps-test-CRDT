import React, { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Undo, Wifi, WifiOff, Users, Loader2 } from "lucide-react";
import { CRDTEngine } from "./CRDTEngine";
import { useOperationQueue } from "./OperationQueue";

export default function CollaborativeEditor({ documentId }) {
  const [operations, setOperations] = useState([]);
  const [text, setText] = useState("");
  const [user, setUser] = useState(null);
  const [clientId] = useState(
    () => `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  );
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [participants, setParticipants] = useState([]);
  const [cursorPosition, setCursorPosition] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const textareaRef = useRef(null);
  const crdtEngine = useRef(new CRDTEngine());
  const lastSyncedOpCount = useRef(0);
  const isApplyingRemoteChanges = useRef(false);
  const operationQueue = useOperationQueue(documentId, clientId, isOnline);

  // Color map for participants
  const colorPalette = [
    "#6366f1",
    "#8b5cf6",
    "#ec4899",
    "#f59e0b",
    "#10b981",
    "#06b6d4",
    "#ef4444",
  ];

  // Load user
  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (error) {
        console.error("Error loading user:", error);
      }
    };
    loadUser();
  }, []);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Fetch operations from server
  const fetchOperations = useCallback(async () => {
    if (!documentId || isSyncing) return;

    try {
      setIsSyncing(true);
      const ops = await base44.entities.Operation.filter(
        { document_id: documentId },
        "-lamport_timestamp"
      );

      // Only update if we have new operations
      if (ops.length !== lastSyncedOpCount.current) {
        isApplyingRemoteChanges.current = true;

        // Update Lamport clock
        ops.forEach((op) => {
          crdtEngine.current.updateClock(op.lamport_timestamp);
        });

        // Save cursor position
        const savedCursor = textareaRef.current?.selectionStart || 0;

        setOperations(ops);
        const newText = crdtEngine.current.buildDocument(ops);
        setText(newText);
        lastSyncedOpCount.current = ops.length;

        // Restore cursor position
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.selectionStart = savedCursor;
            textareaRef.current.selectionEnd = savedCursor;
          }
          isApplyingRemoteChanges.current = false;
        }, 0);

        // Extract unique participants
        const uniqueEmails = [...new Set(ops.map((op) => op.user_email))];
        setParticipants(uniqueEmails);
      }
    } catch (error) {
      console.error("Error fetching operations:", error);
    } finally {
      setIsSyncing(false);
    }
  }, [documentId, isSyncing]);

  // Initial load and polling
  useEffect(() => {
    fetchOperations();
    const interval = setInterval(fetchOperations, 2000); // Poll every 2 seconds
    return () => clearInterval(interval);
  }, [fetchOperations]);

  // Process queue when coming back online
  useEffect(() => {
    if (isOnline && operationQueue.queueSize > 0) {
      operationQueue.processQueue(async (op) => {
        await base44.entities.Operation.create(op);
      });
    }
  }, [isOnline, operationQueue]);

  // Handle text changes
  const handleTextChange = async (e) => {
    if (isApplyingRemoteChanges.current || !user) return;

    const newText = e.target.value;
    const oldText = text;
    const cursor = e.target.selectionStart;

    // Determine what changed
    if (newText.length > oldText.length) {
      // Insertion
      const insertPos = cursor - 1;
      const char = newText[insertPos];

      // Find CRDT position
      const posData = crdtEngine.current.findPositionAtIndex(
        operations,
        insertPos
      );
      if (!posData) return;

      const { prevPos, nextPos } = posData;
      const position = crdtEngine.current.generatePosition(prevPos, nextPos);
      const timestamp = crdtEngine.current.tick();

      const operation = {
        document_id: documentId,
        client_id: clientId,
        user_email: user.email,
        operation_type: "insert",
        position,
        character: char,
        lamport_timestamp: timestamp,
        is_undone: false,
      };

      // Update local state
      setText(newText);
      setCursorPosition(cursor);

      // Send to server or queue
      if (isOnline) {
        try {
          await base44.entities.Operation.create(operation);
          await fetchOperations();
        } catch (error) {
          console.error("Error creating operation:", error);
          operationQueue.enqueue(operation);
        }
      } else {
        operationQueue.enqueue(operation);
      }
    } else if (newText.length < oldText.length) {
      // Deletion
      const deletePos = cursor;
      const posData = crdtEngine.current.findPositionAtIndex(
        operations,
        deletePos
      );
      if (!posData || !posData.ops[deletePos]) return;

      const charToDelete = posData.ops[deletePos];
      const timestamp = crdtEngine.current.tick();

      const operation = {
        document_id: documentId,
        client_id: clientId,
        user_email: user.email,
        operation_type: "delete",
        position: charToDelete.position,
        character: "",
        lamport_timestamp: timestamp,
        is_undone: false,
        undoes_operation_id: charToDelete.id,
      };

      // Mark the operation as undone
      setText(newText);
      setCursorPosition(cursor);

      if (isOnline) {
        try {
          // Mark as undone instead of deleting
          await base44.entities.Operation.update(charToDelete.id, {
            is_undone: true,
          });
          await base44.entities.Operation.create(operation);
          await fetchOperations();
        } catch (error) {
          console.error("Error creating delete operation:", error);
        }
      } else {
        operationQueue.enqueue(operation);
      }
    }
  };

  // Undo last operation by current user
  const handleUndo = async () => {
    if (!user) return;

    // Find last non-undone operation by this user
    const myOps = operations
      .filter(
        (op) =>
          op.user_email === user.email &&
          !op.is_undone &&
          op.client_id === clientId
      )
      .sort((a, b) => b.lamport_timestamp - a.lamport_timestamp);

    if (myOps.length === 0) return;

    const lastOp = myOps[0];

    try {
      // Mark as undone
      await base44.entities.Operation.update(lastOp.id, { is_undone: true });
      await fetchOperations();
    } catch (error) {
      console.error("Error undoing operation:", error);
    }
  };

  // Get participant color
  const getParticipantColor = (email, index) => {
    return colorPalette[index % colorPalette.length];
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Badge
            variant={isOnline ? "default" : "destructive"}
            className="flex items-center gap-1"
          >
            {isOnline ? (
              <Wifi className="w-3 h-3" />
            ) : (
              <WifiOff className="w-3 h-3" />
            )}
            {isOnline ? "Online" : "Offline"}
          </Badge>

          {operationQueue.queueSize > 0 && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              {operationQueue.queueSize} pending
            </Badge>
          )}

          {isSyncing && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Syncing...
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleUndo}
            className="flex items-center gap-2"
          >
            <Undo className="w-4 h-4" />
            Undo
          </Button>

          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-500" />
            <div className="flex -space-x-2">
              {participants.map((email, idx) => (
                <div
                  key={email}
                  className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-white font-medium text-sm"
                  style={{ backgroundColor: getParticipantColor(email, idx) }}
                  title={email}
                >
                  {email[0].toUpperCase()}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Editor */}
      <Card className="p-0 overflow-hidden shadow-lg">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          placeholder="Start typing... Changes sync in real-time with CRDT conflict resolution."
          className="w-full h-[500px] p-6 font-mono text-base resize-none focus:outline-none border-none"
          style={{ fontFamily: '"JetBrains Mono", "Fira Code", monospace' }}
        />
      </Card>

      {/* Debug info */}
      <Card className="p-4 bg-gray-50">
        <div className="text-xs space-y-1 text-gray-600 font-mono">
          <div>Client ID: {clientId.slice(0, 20)}...</div>
          <div>Total Operations: {operations.length}</div>
          <div>
            Active Operations: {operations.filter((op) => !op.is_undone).length}
          </div>
          <div>Document Length: {text.length} characters</div>
          <div>Lamport Clock: {crdtEngine.current.lamportClock}</div>
        </div>
      </Card>
    </div>
  );
}
