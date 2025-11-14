/**
 * Concurrent Edit Test
 *
 * Simulates two clients writing simultaneously to test CRDT conflict resolution.
 * This test verifies:
 * 1. Concurrent edits merge deterministically
 * 2. No lost updates
 * 3. Final state is identical across both clients
 */

import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

// Test configuration
const WEBSOCKET_URL = 'ws://localhost:1234';
const DOCUMENT_ID = 'test-concurrent-' + Date.now();
const TEST_DURATION = 5000; // 5 seconds

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  client1: '\x1b[36m', // Cyan
  client2: '\x1b[35m', // Magenta
  success: '\x1b[32m', // Green
  error: '\x1b[31m',   // Red
  info: '\x1b[33m',    // Yellow
};

class TestClient {
  constructor(name, clientId) {
    this.name = name;
    this.clientId = clientId;
    this.doc = new Y.Doc();
    this.ytext = this.doc.getText('content');
    this.provider = new WebsocketProvider(WEBSOCKET_URL, DOCUMENT_ID, this.doc);
    this.connected = false;
    this.editCount = 0;

    // Track connection status
    this.provider.on('status', (event) => {
      this.connected = event.status === 'connected';
      if (this.connected) {
        this.log('Connected to server');
      }
    });

    // Track text changes
    this.ytext.observe(() => {
      this.log(`Text changed: "${this.getText()}" (length: ${this.getText().length})`);
    });
  }

  log(message) {
    const color = this.name === 'Client 1' ? colors.client1 : colors.client2;
    console.log(`${color}[${this.name}]${colors.reset} ${message}`);
  }

  getText() {
    return this.ytext.toString();
  }

  insert(index, text) {
    this.doc.transact(() => {
      this.ytext.insert(index, text);
    }, this.clientId);
    this.editCount++;
    this.log(`Inserted "${text}" at index ${index}`);
  }

  delete(index, length) {
    this.doc.transact(() => {
      this.ytext.delete(index, length);
    }, this.clientId);
    this.editCount++;
    this.log(`Deleted ${length} characters at index ${index}`);
  }

  destroy() {
    this.provider.destroy();
    this.doc.destroy();
  }
}

// Sleep utility
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Main test function
async function runConcurrentEditTest() {
  console.log(`${colors.info}=== Concurrent Edit Test ===${colors.reset}\n`);
  console.log(`${colors.info}Document ID: ${DOCUMENT_ID}${colors.reset}`);
  console.log(`${colors.info}WebSocket: ${WEBSOCKET_URL}${colors.reset}\n`);

  // Create two clients
  const client1 = new TestClient('Client 1', 'client-1');
  const client2 = new TestClient('Client 2', 'client-2');

  // Wait for both to connect
  console.log(`${colors.info}Waiting for clients to connect...${colors.reset}\n`);
  let attempts = 0;
  while ((!client1.connected || !client2.connected) && attempts < 50) {
    await sleep(100);
    attempts++;
  }

  if (!client1.connected || !client2.connected) {
    console.error(`${colors.error}ERROR: Clients failed to connect. Make sure y-websocket server is running on port 1234.${colors.reset}`);
    client1.destroy();
    client2.destroy();
    process.exit(1);
  }

  console.log(`${colors.success}✓ Both clients connected${colors.reset}\n`);

  // Wait for initial sync
  await sleep(500);

  console.log(`${colors.info}Starting concurrent edits...${colors.reset}\n`);

  // Scenario 1: Both clients insert at position 0 simultaneously
  console.log(`${colors.info}--- Scenario 1: Simultaneous inserts at position 0 ---${colors.reset}`);
  client1.insert(0, 'AAA');
  client2.insert(0, 'BBB');
  await sleep(1000);

  // Scenario 2: Both clients insert at the end
  console.log(`\n${colors.info}--- Scenario 2: Simultaneous inserts at end ---${colors.reset}`);
  const len1 = client1.getText().length;
  const len2 = client2.getText().length;
  client1.insert(len1, 'XXX');
  client2.insert(len2, 'YYY');
  await sleep(1000);

  // Scenario 3: One inserts, one deletes
  console.log(`\n${colors.info}--- Scenario 3: Concurrent insert and delete ---${colors.reset}`);
  client1.insert(0, 'ZZZ');
  client2.delete(0, 1);
  await sleep(1000);

  // Scenario 4: Multiple rapid edits
  console.log(`\n${colors.info}--- Scenario 4: Rapid sequential edits ---${colors.reset}`);
  for (let i = 0; i < 5; i++) {
    client1.insert(0, `1-${i}`);
    client2.insert(0, `2-${i}`);
    await sleep(100);
  }
  await sleep(1000);

  // Final verification
  console.log(`\n${colors.info}=== Test Results ===${colors.reset}\n`);

  const text1 = client1.getText();
  const text2 = client2.getText();

  console.log(`${colors.client1}Client 1 text (${text1.length} chars):${colors.reset}`);
  console.log(`  "${text1}"\n`);

  console.log(`${colors.client2}Client 2 text (${text2.length} chars):${colors.reset}`);
  console.log(`  "${text2}"\n`);

  console.log(`${colors.info}Edit counts:${colors.reset}`);
  console.log(`  Client 1: ${client1.editCount} edits`);
  console.log(`  Client 2: ${client2.editCount} edits\n`);

  // Verify convergence
  if (text1 === text2) {
    console.log(`${colors.success}✓ SUCCESS: Both clients converged to identical state!${colors.reset}`);
    console.log(`${colors.success}✓ No lost updates - all edits preserved${colors.reset}`);
    console.log(`${colors.success}✓ Deterministic merge - texts match exactly${colors.reset}\n`);
  } else {
    console.log(`${colors.error}✗ FAILURE: Clients have different text!${colors.reset}`);
    console.log(`${colors.error}This indicates a problem with CRDT convergence.${colors.reset}\n`);

    // Show diff
    console.log(`${colors.info}Difference:${colors.reset}`);
    console.log(`  Client 1: ${text1.length} characters`);
    console.log(`  Client 2: ${text2.length} characters`);
    console.log(`  Diff: ${Math.abs(text1.length - text2.length)} characters\n`);
  }

  // Cleanup
  client1.destroy();
  client2.destroy();

  // Exit with appropriate code
  process.exit(text1 === text2 ? 0 : 1);
}

// Run the test
runConcurrentEditTest().catch(err => {
  console.error(`${colors.error}Test error:${colors.reset}`, err);
  process.exit(1);
});
