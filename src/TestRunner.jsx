import React, { useState, useEffect, useRef } from 'react';
import { YjsEngine } from './YjsEngine';
import { Play, CheckCircle, XCircle, Loader2 } from 'lucide-react';

export default function TestRunner() {
  const [testStatus, setTestStatus] = useState('idle'); // idle, running, passed, failed
  const [logs, setLogs] = useState([]);
  const [robotAText, setRobotAText] = useState('');
  const [robotBText, setRobotBText] = useState('');
  const [step, setStep] = useState('');

  const robotARef = useRef(null);
  const robotBRef = useRef(null);

  const addLog = (message, type = 'info', robot = null) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { message, type, robot, timestamp }]);
  };

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const runTest = async () => {
    setTestStatus('running');
    setLogs([]);
    setRobotAText('');
    setRobotBText('');

    try {
      addLog('Starting test...', 'info');
      addLog('This simulates: Two robots typing conflicting edits while one goes offline and returns', 'info');
      await sleep(2000);

      // Create shared document ID for both robots
      const testDocId = 'test-visual-' + Date.now();
      addLog(`Document ID: ${testDocId}`, 'info');
      await sleep(1000);

      // Create robots
      setStep('Creating robots...');
      addLog('Creating Robot A', 'info', 'A');
      const robotA = new YjsEngine(testDocId, 'robot-a');
      robotARef.current = robotA;
      await sleep(500);

      addLog('Creating Robot B', 'info', 'B');
      const robotB = new YjsEngine(testDocId, 'robot-b');
      robotBRef.current = robotB;
      await sleep(500);

      // Set up text observers
      robotA.onTextChange((text) => {
        setRobotAText(text);
        addLog(`Text updated: "${text}"`, 'success', 'A');
      });

      robotB.onTextChange((text) => {
        setRobotBText(text);
        addLog(`Text updated: "${text}"`, 'success', 'B');
      });

      // Wait for connection
      setStep('Waiting for connection...');
      addLog('Waiting for WebSocket connection...', 'info');
      await sleep(2500);

      if (!robotA.isConnected || !robotB.isConnected) {
        throw new Error('Failed to connect to WebSocket server. Make sure y-websocket is running on port 1234.');
      }

      addLog('✓ Both robots connected!', 'success');
      await sleep(2000);

      // Step 1: Robot A types at the beginning
      setStep('Step 1: Robot A types "AAA"');
      addLog('Inserting "AAA" at position 0', 'info', 'A');
      robotA.insert(0, 'AAA');
      await sleep(2500);

      // Step 2: Robot B types at the same position (concurrent edit)
      setStep('Step 2: Robot B types "BBB" at the same position');
      addLog('Inserting "BBB" at position 0 (concurrent with A)', 'info', 'B');
      robotB.insert(0, 'BBB');
      await sleep(2500);

      // Step 3: Robot A adds more text
      setStep('Step 3: Robot A adds " more text"');
      const len = robotA.getText().length;
      addLog(`Inserting " more text" at position ${len}`, 'info', 'A');
      robotA.insert(len, ' more text');
      await sleep(3000);

      // Step 4: Robot A goes offline
      setStep('Step 4: Robot A goes offline - Check both windows!');
      addLog('Going offline...', 'warning', 'A');
      addLog('⚠ Robot A is now OFFLINE - only local changes visible', 'warning');
      robotA.disconnect();
      await sleep(3500);

      // Step 5: Robot A inserts in the middle while offline
      setStep('Step 5: Robot A inserts "XXX" (OFFLINE) - Notice only Robot A updates!');
      addLog('Inserting "XXX" at position 3 (OFFLINE)', 'warning', 'A');
      addLog('⚠ This change will NOT sync to Robot B yet', 'warning', 'A');
      robotA.insert(3, 'XXX');
      await sleep(4000);

      // Step 6: Robot B also edits while A is offline
      setStep('Step 6: Robot B inserts "YYY" - Robot A won\'t see this!');
      const lenB = robotB.getText().length;
      addLog(`Inserting "YYY" at position ${lenB}`, 'info', 'B');
      addLog('⚠ Robot A is still offline and cannot see this change', 'warning', 'B');
      robotB.insert(lenB, 'YYY');
      await sleep(4000);

      // Step 7: Robot A reconnects
      setStep('Step 7: Robot A reconnects - Watch the merge happen!');
      addLog('Reconnecting to server...', 'info', 'A');
      addLog('🔄 Syncing offline changes...', 'info', 'A');
      robotA.connect();
      await sleep(5000); // Wait for sync

      // Verification
      setStep('Verifying results...');
      addLog('Checking convergence...', 'info');
      await sleep(1000);

      const textA = robotA.getText();
      const textB = robotB.getText();

      addLog(`Robot A final text (${textA.length} chars): "${textA}"`, 'info', 'A');
      addLog(`Robot B final text (${textB.length} chars): "${textB}"`, 'info', 'B');

      if (textA === textB) {
        addLog('✓ SUCCESS: Both robots converged to identical state!', 'success');
        addLog('✓ No lost updates - all edits preserved', 'success');
        addLog('✓ Deterministic merge - texts match exactly', 'success');

        // Check all edits are present
        const hasAAA = textA.includes('AAA');
        const hasBBB = textA.includes('BBB');
        const hasXXX = textA.includes('XXX');
        const hasYYY = textA.includes('YYY');
        const hasMoreText = textA.includes('more text');

        if (hasAAA && hasBBB && hasXXX && hasYYY && hasMoreText) {
          addLog('✓ All edits preserved: AAA, BBB, XXX, YYY, "more text"', 'success');
          addLog(`✓ Final merged text: "${textA}"`, 'success');
          setTestStatus('passed');
        } else {
          addLog('✗ Some edits missing!', 'error');
          addLog(`Missing: ${!hasAAA ? 'AAA ' : ''}${!hasBBB ? 'BBB ' : ''}${!hasXXX ? 'XXX ' : ''}${!hasYYY ? 'YYY ' : ''}${!hasMoreText ? 'more text' : ''}`, 'error');
          setTestStatus('failed');
        }
      } else {
        addLog('✗ FAILURE: Robots did not converge!', 'error');
        addLog(`Difference: ${Math.abs(textA.length - textB.length)} characters`, 'error');
        setTestStatus('failed');
      }

      // Cleanup
      setTimeout(() => {
        robotA.destroy();
        robotB.destroy();
      }, 2000);

    } catch (error) {
      addLog(`✗ Error: ${error.message}`, 'error');
      setTestStatus('failed');
    }
  };

  const getLogColor = (type, robot) => {
    if (robot === 'A') return '#06b6d4'; // Cyan
    if (robot === 'B') return '#a855f7'; // Purple
    if (type === 'success') return '#10b981'; // Green
    if (type === 'error') return '#ef4444'; // Red
    if (type === 'warning') return '#f59e0b'; // Orange
    return '#64748b'; // Gray
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>CRDT Visual Test Runner</h1>
        <p style={styles.subtitle}>
          Watch the robots perform concurrent edits in real-time
        </p>
      </div>

      <div style={styles.controls}>
        <button
          onClick={runTest}
          disabled={testStatus === 'running'}
          style={{
            ...styles.button,
            opacity: testStatus === 'running' ? 0.5 : 1,
          }}
        >
          {testStatus === 'running' ? (
            <>
              <Loader2 size={20} style={{ marginRight: 8, animation: 'spin 1s linear infinite' }} />
              Running Test...
            </>
          ) : (
            <>
              <Play size={20} style={{ marginRight: 8 }} />
              Run Test
            </>
          )}
        </button>

        {testStatus === 'passed' && (
          <div style={styles.statusPassed}>
            <CheckCircle size={20} />
            <span>Test Passed!</span>
          </div>
        )}

        {testStatus === 'failed' && (
          <div style={styles.statusFailed}>
            <XCircle size={20} />
            <span>Test Failed</span>
          </div>
        )}
      </div>

      {step && (
        <div style={styles.step}>
          <strong>Current Step:</strong> {step}
        </div>
      )}

      <div style={styles.robotsContainer}>
        <div style={styles.robot}>
          <h3 style={{ ...styles.robotTitle, color: '#06b6d4' }}>Robot A</h3>
          <textarea
            value={robotAText}
            readOnly
            placeholder="Robot A's view..."
            style={{ ...styles.textarea, borderColor: '#06b6d4' }}
          />
        </div>

        <div style={styles.robot}>
          <h3 style={{ ...styles.robotTitle, color: '#a855f7' }}>Robot B</h3>
          <textarea
            value={robotBText}
            readOnly
            placeholder="Robot B's view..."
            style={{ ...styles.textarea, borderColor: '#a855f7' }}
          />
        </div>
      </div>

      <div style={styles.logsContainer}>
        <h3 style={styles.logsTitle}>Test Log</h3>
        <div style={styles.logs}>
          {logs.map((log, idx) => (
            <div
              key={idx}
              style={{
                ...styles.logEntry,
                color: getLogColor(log.type, log.robot),
              }}
            >
              <span style={styles.timestamp}>{log.timestamp}</span>
              {log.robot && (
                <span style={styles.robotLabel}>[Robot {log.robot}]</span>
              )}
              <span>{log.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '2rem',
  },
  header: {
    textAlign: 'center',
    marginBottom: '2rem',
  },
  title: {
    fontSize: '2rem',
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: '0.5rem',
  },
  subtitle: {
    color: '#64748b',
    fontSize: '1rem',
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    marginBottom: '1.5rem',
    justifyContent: 'center',
  },
  button: {
    display: 'flex',
    alignItems: 'center',
    padding: '0.75rem 1.5rem',
    fontSize: '1rem',
    background: '#4f46e5',
    color: 'white',
    border: 'none',
    borderRadius: '0.5rem',
    cursor: 'pointer',
    fontWeight: '600',
  },
  statusPassed: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    color: '#10b981',
    fontWeight: '600',
  },
  statusFailed: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    color: '#ef4444',
    fontWeight: '600',
  },
  step: {
    padding: '1rem',
    background: '#fef3c7',
    borderLeft: '4px solid #f59e0b',
    marginBottom: '1.5rem',
    borderRadius: '0.25rem',
  },
  robotsContainer: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1.5rem',
    marginBottom: '2rem',
  },
  robot: {
    display: 'flex',
    flexDirection: 'column',
  },
  robotTitle: {
    fontSize: '1.25rem',
    fontWeight: '600',
    marginBottom: '0.5rem',
  },
  textarea: {
    width: '100%',
    height: '200px',
    padding: '1rem',
    fontSize: '1rem',
    fontFamily: 'monospace',
    border: '2px solid',
    borderRadius: '0.5rem',
    resize: 'vertical',
    background: 'white',
  },
  logsContainer: {
    background: 'white',
    borderRadius: '0.5rem',
    padding: '1.5rem',
    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
  },
  logsTitle: {
    fontSize: '1.25rem',
    fontWeight: '600',
    marginBottom: '1rem',
    color: '#1e293b',
  },
  logs: {
    background: '#1e293b',
    padding: '1rem',
    borderRadius: '0.5rem',
    maxHeight: '400px',
    overflowY: 'auto',
    fontFamily: 'monospace',
    fontSize: '0.875rem',
  },
  logEntry: {
    padding: '0.25rem 0',
    display: 'flex',
    gap: '0.5rem',
  },
  timestamp: {
    color: '#64748b',
  },
  robotLabel: {
    fontWeight: '600',
  },
};

// Add keyframe animation for spinner
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(styleSheet);
