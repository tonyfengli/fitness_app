#!/usr/bin/env node
import { spawn } from 'child_process';
import { writeFileSync } from 'fs';

console.log('Running tests and capturing failures...\n');

let output = '';
let failedTests = [];

const vitest = spawn('vitest', ['run'], {
  stdio: ['inherit', 'pipe', 'pipe'],
  shell: true
});

// Capture stdout
vitest.stdout.on('data', (data) => {
  const text = data.toString();
  process.stdout.write(text);
  output += text;
});

// Capture stderr
vitest.stderr.on('data', (data) => {
  const text = data.toString();
  process.stderr.write(text);
  output += text;
});

vitest.on('close', (code) => {
  // Parse the output for failed tests
  const lines = output.split('\n');
  let currentFile = '';
  
  lines.forEach((line) => {
    // Match test file
    if (line.includes('FAIL') && line.includes('.test.ts')) {
      currentFile = line.match(/([^\s]+\.test\.ts)/)?.[1] || '';
    }
    
    // Match failed test names (✗ or ×)
    if ((line.includes('✗') || line.includes('×')) && !line.includes('FAIL')) {
      const testName = line.replace(/^\s*[✗×]\s*/, '').trim();
      if (testName) {
        failedTests.push({
          file: currentFile,
          test: testName
        });
      }
    }
  });

  if (failedTests.length > 0) {
    const report = {
      timestamp: new Date().toISOString(),
      totalFailed: failedTests.length,
      failures: failedTests,
      summary: output.match(/Tests\s+\d+\s+failed.*/)?.[0] || ''
    };
    
    writeFileSync('test-failures.json', JSON.stringify(report, null, 2));
    console.log(`\n📝 ${failedTests.length} failed tests saved to test-failures.json`);
  } else {
    console.log('\n✅ All tests passed!');
  }
  
  process.exit(code);
});