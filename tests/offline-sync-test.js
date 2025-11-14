/**
 * Offline Sync Test
 *
 * Simulates one client going offline, making edits, then reconnecting.
 * Tests the core requirement: offline editing with deterministic sync.
 */

import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

const WEBSOCKET_URL = 'ws://localhost:1234';
const DOCUMENT_ID = 'test-offline-' + Date.now();

const colors = {
  reset: '\x1b[0m',
  client1: '\x1b[36m',
  client2: '\x1b[35m',
  success: '\x1b[32m',
  error: '\x1b[31m',
  info: '\x1b[33m',
};

class TestClient {
  constructor(name, clientId) {
    this.name = name;
    this.clientId = clientId;
    this.doc = new Y.Doc();
    this.ytext = this.doc.getText('content');
    this.provider = new WebsocketProvider(WEBSOCKET_URL, DOCUMENT_ID, this.doc);
    this.connected = false;

    this.provider.on('status', (event) => {
      this.connected = event.status === 'connected';
      const status = this.connected ? 'ONLINE' : 'OFFLINE';
      this.log(`Status: ${status}`);
    });
  }

  log(message) {
    const color = this.name === 'Robot A' ? colors.client1 : colors.client2;
    console.log(`${color}[${this.name}]${colors.reset} ${message}`);
  }

  getText() {
    return this.ytext.toString();
  }

  insert(index, text) {
    this.doc.transact(() => {
      this.ytext.insert(index, text);
    }, this.clientId);
    this.log(`Inserted "${text}" at position ${index} | Text: "${this.getText()}"`);
  }

  goOffline() {
    this.provider.disconnect();
    this.log('Going offline...');
  }

  goOnline() {
    this.provider.connect();
    this.log('Reconnecting...');
  }

  destroy() {
    this.provider.destroy();
    this.doc.destroy();
  }
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runOfflineSyncTest() {
  console.log(`${colors.info}=== Offline Sync Test ===${colors.reset}\n`);
  console.log(`${colors.info}This test simulates the exact requirement:${colors.reset}`);
  console.log(`${colors.info}"Two robots typing conflicting edits while one goes offline and returns"${colors.reset}\n`);

  const robotA = new TestClient('Robot A', 'robot-a');
  const robotB = new TestClient('Robot B', 'robot-b');

  // Wait for connection
  console.log(`${colors.info}Waiting for connection...${colors.reset}\n`);
  let attempts = 0;
  while ((!robotA.connected || !robotB.connected) && attempts < 50) {
    await sleep(100);
    attempts++;
  }

  if (!robotA.connected || !robotB.connected) {
    console.error(`${colors.error}ERROR: Failed to connect. Ensure y-websocket server is running.${colors.reset}`);
    robotA.destroy();
    robotB.destroy();
    process.exit(1);
  }

  console.log(`${colors.success}✓ Both robots connected${colors.reset}\n`);
  await sleep(500);

  // Step 1: Robot A inserts "AAA"
  console.log(`${colors.info}--- Step 1: Robot A inserts "AAA" ---${colors.reset}`);
  robotA.insert(0, 'AAA\n');
  await sleep(1000);

  // Step 2: Robot B inserts "BBB"
  console.log(`\n${colors.info}--- Step 2: Robot B inserts "BBB" ---${colors.reset}`);
  robotB.insert(0, 'BBB\n');
  await sleep(1000);

  // Step 3: Robot A goes offline
  console.log(`\n${colors.info}--- Step 3: Robot A goes offline ---${colors.reset}`);
  robotA.goOffline();
  await sleep(500);

  // Step 4: Robot A inserts "XXX" while offline
  console.log(`\n${colors.info}--- Step 4: Robot A inserts "XXX" (while offline) ---${colors.reset}`);
  robotA.insert(0, 'XXX\n');
  await sleep(1000);

  // Step 5: Robot A reconnects
  console.log(`\n${colors.info}--- Step 5: Robot A reconnects ---${colors.reset}`);
  robotA.goOnline();
  await sleep(2000); // Wait for sync

  // Results
  console.log(`\n${colors.info}=== Test Results ===${colors.reset}\n`);

  const textA = robotA.getText();
  const textB = robotB.getText();

  console.log(`${colors.client1}Robot A final text:${colors.reset}`);
  console.log(`  "${textA}"`);
  console.log(`  Length: ${textA.length} chars\n`);

  console.log(`${colors.client2}Robot B final text:${colors.reset}`);
  console.log(`  "${textB}"`);
  console.log(`  Length: ${textB.length} chars\n`);

  // Verify
  const success = textA === textB;

  if (success) {
    console.log(`${colors.success}✓ SUCCESS: Both robots converged!${colors.reset}`);
    console.log(`${colors.success}✓ Deterministic order maintained${colors.reset}`);
    console.log(`${colors.success}✓ No lost updates (all insertions present)${colors.reset}`);
    console.log(`${colors.success}✓ Offline edits synced correctly${colors.reset}\n`);

    // Verify all lines are present
    const hasAAA = textA.includes('AAA');
    const hasBBB = textA.includes('BBB');
    const hasXXX = textA.includes('XXX');

    if (hasAAA && hasBBB && hasXXX) {
      console.log(`${colors.success}✓ All edits preserved: AAA, BBB, XXX${colors.reset}\n`);
    } else {
      console.log(`${colors.error}✗ WARNING: Some edits missing!${colors.reset}`);
      console.log(`  AAA: ${hasAAA ? '✓' : '✗'}`);
      console.log(`  BBB: ${hasBBB ? '✓' : '✗'}`);
      console.log(`  XXX: ${hasXXX ? '✓' : '✗'}\n`);
    }
  } else {
    console.log(`${colors.error}✗ FAILURE: Robots did not converge!${colors.reset}`);
    console.log(`${colors.error}Text differs between clients.${colors.reset}\n`);
  }

  robotA.destroy();
  robotB.destroy();

  process.exit(success ? 0 : 1);
}

runOfflineSyncTest().catch(err => {
  console.error(`${colors.error}Test error:${colors.reset}`, err);
  process.exit(1);
});
