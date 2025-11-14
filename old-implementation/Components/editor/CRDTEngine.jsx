// CRDT Engine - Handles position-based CRDT logic and operation ordering

export class CRDTEngine {
  constructor() {
    this.lamportClock = 0;
  }

  // Generate a position between two positions using fractional indexing
  generatePosition(prev, next) {
    const prevPos = prev ? parseFloat(prev) : 0;
    const nextPos = next ? parseFloat(next) : 1;

    // Generate a position halfway between
    const midpoint = (prevPos + nextPos) / 2;

    // Use high precision to avoid collisions
    return midpoint.toFixed(20);
  }

  // Increment Lamport clock
  tick() {
    this.lamportClock++;
    return this.lamportClock;
  }

  // Update clock based on received timestamp
  updateClock(receivedTimestamp) {
    this.lamportClock = Math.max(this.lamportClock, receivedTimestamp) + 1;
  }

  // Build document from operations
  buildDocument(operations) {
    // Filter out undone operations
    const activeOps = operations.filter((op) => !op.is_undone);

    // Sort by position, then by lamport timestamp, then by client_id for determinism
    const sortedOps = activeOps
      .filter((op) => op.operation_type === "insert")
      .sort((a, b) => {
        const posA = parseFloat(a.position);
        const posB = parseFloat(b.position);

        if (posA !== posB) return posA - posB;
        if (a.lamport_timestamp !== b.lamport_timestamp) {
          return a.lamport_timestamp - b.lamport_timestamp;
        }
        return a.client_id.localeCompare(b.client_id);
      });

    // Build the text
    return sortedOps.map((op) => op.character).join("");
  }

  // Find position data for a given text index
  findPositionAtIndex(operations, index) {
    const activeOps = operations
      .filter((op) => !op.is_undone && op.operation_type === "insert")
      .sort((a, b) => {
        const posA = parseFloat(a.position);
        const posB = parseFloat(b.position);
        if (posA !== posB) return posA - posB;
        if (a.lamport_timestamp !== b.lamport_timestamp) {
          return a.lamport_timestamp - b.lamport_timestamp;
        }
        return a.client_id.localeCompare(b.client_id);
      });

    if (index < 0 || index > activeOps.length) return null;

    const prevPos = index > 0 ? activeOps[index - 1].position : null;
    const nextPos = index < activeOps.length ? activeOps[index].position : null;

    return { prevPos, nextPos, ops: activeOps };
  }
}

export default CRDTEngine;
