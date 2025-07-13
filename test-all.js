#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('🧪 Running all tests...\n');

let totalTests = 0;
let totalFiles = 0;
let allPassed = true;

// Run AI tests
console.log('📦 Running AI package tests...');
try {
  const aiOutput = execSync('cd packages/ai && pnpm test', { encoding: 'utf8' });
  const aiMatch = aiOutput.match(/Tests\s+(\d+)\s+passed/);
  const aiFilesMatch = aiOutput.match(/Test Files\s+(\d+)\s+passed/);
  
  if (aiMatch) {
    const aiTests = parseInt(aiMatch[1]);
    const aiFiles = parseInt(aiFilesMatch[1]);
    totalTests += aiTests;
    totalFiles += aiFiles;
    console.log(`✅ AI: ${aiTests} tests passed in ${aiFiles} files`);
  }
} catch (error) {
  console.log('❌ AI tests failed');
  allPassed = false;
}

// Run API tests
console.log('\n📦 Running API package tests...');
try {
  const apiOutput = execSync('cd packages/api && pnpm test', { encoding: 'utf8' });
  const apiMatch = apiOutput.match(/Tests\s+(\d+)\s+passed/);
  const apiFilesMatch = apiOutput.match(/Test Files\s+(\d+)\s+passed/);
  
  if (apiMatch) {
    const apiTests = parseInt(apiMatch[1]);
    const apiFiles = parseInt(apiFilesMatch[1]);
    totalTests += apiTests;
    totalFiles += apiFiles;
    console.log(`✅ API: ${apiTests} tests passed in ${apiFiles} files`);
  }
} catch (error) {
  console.log('❌ API tests failed');
  allPassed = false;
}

// Summary
console.log('\n' + '='.repeat(50));
console.log('📊 TOTAL TEST SUMMARY:');
console.log('='.repeat(50));
console.log(`Total Test Files: ${totalFiles}`);
console.log(`Total Tests: ${totalTests}`);
console.log(`Status: ${allPassed ? '✅ All Passed' : '❌ Some Failed'}`);
console.log('='.repeat(50));