#!/usr/bin/env node
import { save, list, generate, listSavedScenarios, generateTestFromScenario } from './debugToTest.js';

const command = process.argv[2];
const args = process.argv.slice(3);

console.log('🧪 Debug to Test CLI\n');

switch (command) {
  case 'save':
    if (args.length < 2) {
      console.error('Usage: npm run debug-to-test save <name> <description> [notes]');
      process.exit(1);
    }
    save(args[0]!, args[1]!, args[2]);
    break;
    
  case 'list':
    list();
    break;
    
  case 'generate':
    if (args.length < 1) {
      console.error('Usage: npm run debug-to-test generate <scenario_id_or_name>');
      process.exit(1);
    }
    const testCode = generateTestFromScenario(args[0]!);
    if (testCode) {
      console.log('\n' + testCode);
    }
    break;
    
  default:
    console.log(`Usage:
  npm run debug-to-test save <name> <description> [notes]
  npm run debug-to-test list
  npm run debug-to-test generate <scenario_id_or_name>

Examples:
  npm run debug-to-test save joint_bug "Knee restriction not respected"
  npm run debug-to-test list
  npm run debug-to-test generate joint_bug
`);
}