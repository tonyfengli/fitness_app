#!/usr/bin/env node

const assert = (cond, msg) => { 
  if (!cond) { 
    console.error(`❌ ${msg}`); 
    process.exit(1); 
  } 
};

try {
  const tv = require('../package.json');
  const tw = require('tailwindcss/package.json').version;
  const pc = require('postcss/package.json').version;

  console.log('Checking NativeWind v2 dependency versions...');
  
  assert(tw === '3.2.7', `Tailwind must be 3.2.7, got ${tw}`);
  
  // PostCSS 8.5.6 is bundled by NativeWind v2, which is OK
  // The important thing is that we don't have newer async versions
  const pcMajor = parseInt(pc.split('.')[0]);
  const pcMinor = parseInt(pc.split('.')[1]);
  assert(pcMajor === 8 && pcMinor <= 5, `PostCSS must be 8.5.x or lower for NativeWind v2, got ${pc}`);

  console.log('✅ Tailwind CSS version:', tw);
  console.log('✅ PostCSS version:', pc, '(OK for NativeWind v2)');
  console.log('✅ All dependency versions OK for NativeWind v2');
} catch (error) {
  console.error('❌ Failed to check dependencies:', error.message);
  process.exit(1);
}