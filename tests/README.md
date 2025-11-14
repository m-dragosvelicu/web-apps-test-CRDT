# Automated Tests

This folder contains automated test scripts that verify CRDT functionality without a browser.

## Tests

### 1. Concurrent Edit Test
**File**: `concurrent-edit-test.js`

Simulates two clients writing simultaneously to test conflict resolution.

**Scenarios tested**:
- Simultaneous inserts at position 0
- Simultaneous inserts at end
- Concurrent insert and delete
- Rapid sequential edits from both clients

**Verification**:
- ✓ Both clients converge to identical text
- ✓ No lost updates
- ✓ Deterministic merge

### 2. Offline Sync Test
**File**: `offline-sync-test.js`

Simulates the exact requirement: two robots typing conflicting edits while one goes offline and returns.

**Steps**:
1. Robot A inserts "AAA"
2. Robot B inserts "BBB"
3. Robot A goes offline
4. Robot A inserts "XXX" while offline
5. Robot A reconnects

**Verification**:
- ✓ Both robots converge after reconnection
- ✓ All edits (AAA, BBB, XXX) preserved
- ✓ Deterministic order
- ✓ Offline edits sync correctly

## Running Tests

### Prerequisites
Make sure the y-websocket server is running:
```bash
npx y-websocket --port 1234
```

### Run Individual Tests
```bash
# Concurrent edit test
node tests/concurrent-edit-test.js

# Offline sync test
node tests/offline-sync-test.js
```

### Run All Tests
```bash
npm test
```

## Output

Tests use colored console output:
- 🔵 **Cyan**: Robot A / Client 1
- 🟣 **Magenta**: Robot B / Client 2
- 🟢 **Green**: Success messages
- 🔴 **Red**: Errors
- 🟡 **Yellow**: Info/status

### Example Success Output
```
=== Offline Sync Test ===

[Robot A] Status: ONLINE
[Robot B] Status: ONLINE
✓ Both robots connected

--- Step 1: Robot A inserts "AAA" ---
[Robot A] Inserted "AAA" at position 0 | Text: "AAA
"

--- Step 2: Robot B inserts "BBB" ---
[Robot B] Inserted "BBB" at position 0 | Text: "BBB
AAA
"

--- Step 3: Robot A goes offline ---
[Robot A] Going offline...
[Robot A] Status: OFFLINE

--- Step 4: Robot A inserts "XXX" (while offline) ---
[Robot A] Inserted "XXX" at position 0 | Text: "XXX
BBB
AAA
"

--- Step 5: Robot A reconnects ---
[Robot A] Reconnecting...
[Robot A] Status: ONLINE

=== Test Results ===

✓ SUCCESS: Both robots converged!
✓ Deterministic order maintained
✓ No lost updates (all insertions present)
✓ Offline edits synced correctly
✓ All edits preserved: AAA, BBB, XXX
```

## Exit Codes

- **0**: All tests passed
- **1**: Test failed or error occurred

Use exit codes in CI/CD pipelines:
```bash
node tests/offline-sync-test.js && echo "Test passed!" || echo "Test failed!"
```

## Troubleshooting

### "Failed to connect"
- Ensure y-websocket server is running: `npx y-websocket --port 1234`
- Check port 1234 is not blocked

### "Clients did not converge"
- This indicates a CRDT merge issue
- Check console output for detailed diff
- Verify Yjs version matches

### Tests hang
- Press Ctrl+C to stop
- Check WebSocket server logs
- Try restarting the server

## Adding New Tests

Create new test files following this structure:

```javascript
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

async function runMyTest() {
  // 1. Create clients
  const doc = new Y.Doc();
  const ytext = doc.getText('content');
  const provider = new WebsocketProvider('ws://localhost:1234', 'test-doc', doc);

  // 2. Wait for connection
  await waitForConnection(provider);

  // 3. Perform test actions
  ytext.insert(0, 'test');

  // 4. Verify results
  const success = ytext.toString() === 'test';

  // 5. Cleanup
  provider.destroy();
  doc.destroy();

  process.exit(success ? 0 : 1);
}

runMyTest().catch(err => {
  console.error(err);
  process.exit(1);
});
```

## Integration with CI/CD

Add to `package.json`:
```json
{
  "scripts": {
    "test": "node tests/concurrent-edit-test.js && node tests/offline-sync-test.js",
    "test:concurrent": "node tests/concurrent-edit-test.js",
    "test:offline": "node tests/offline-sync-test.js"
  }
}
```

GitHub Actions example:
```yaml
- name: Run tests
  run: |
    npx y-websocket --port 1234 &
    sleep 2
    npm test
```
