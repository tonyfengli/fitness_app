/**
 * Block system debugging utilities
 * Provides comprehensive logging for block transformations
 */

export class BlockDebugger {
  private static enabled = true;
  private static logs: any[] = [];

  static enable() {
    this.enabled = true;
  }

  static disable() {
    this.enabled = false;
  }

  static clearLogs() {
    this.logs = [];
  }

  static getLogs() {
    return [...this.logs];
  }

  static log(stage: string, data: any) {
    if (!this.enabled) return;

    const logEntry = {
      timestamp: new Date().toISOString(),
      stage,
      data: JSON.parse(JSON.stringify(data)) // Deep clone to avoid reference issues
    };

    this.logs.push(logEntry);
    
    console.log(`🔍 [${stage}]`, data);
  }

  static logBlockTransformation(
    stage: string,
    input: any,
    output: any,
    metadata?: any
  ) {
    if (!this.enabled) return;

    const logEntry = {
      timestamp: new Date().toISOString(),
      stage,
      input: JSON.parse(JSON.stringify(input)),
      output: JSON.parse(JSON.stringify(output)),
      metadata
    };

    this.logs.push(logEntry);

    console.log(`🔄 [${stage}]`);
    console.log('  📥 Input:', input);
    console.log('  📤 Output:', output);
    if (metadata) {
      console.log('  📋 Metadata:', metadata);
    }
  }
  
  static logConstraintViolation(
    block: string, 
    constraint: string, 
    details: {
      expected: any;
      actual: any;
      severity: 'warning' | 'error';
      message?: string;
    }
  ) {
    if (!this.enabled) return;

    const logEntry = {
      timestamp: new Date().toISOString(),
      stage: `Constraint Violation - ${block}`,
      type: 'constraint_violation',
      data: {
        block,
        constraint,
        ...details
      }
    };

    this.logs.push(logEntry);
    
    const icon = details.severity === 'error' ? '❌' : '⚠️';
    console.log(`${icon} [Constraint Violation - ${block}]`);
    console.log(`  Constraint: ${constraint}`);
    console.log(`  Expected: ${JSON.stringify(details.expected)}`);
    console.log(`  Actual: ${JSON.stringify(details.actual)}`);
    if (details.message) {
      console.log(`  Message: ${details.message}`);
    }
  }

  static validateBlockStructure(blocks: any, expectedStructure?: string[]) {
    const actualKeys = Object.keys(blocks).sort();
    const issues: string[] = [];

    // Check if blocks is an object
    if (typeof blocks !== 'object' || blocks === null) {
      issues.push(`Blocks is not an object: ${typeof blocks}`);
      return { valid: false, issues };
    }

    // Check each block has exercises array
    for (const [blockName, exercises] of Object.entries(blocks)) {
      if (!Array.isArray(exercises)) {
        issues.push(`Block ${blockName} is not an array: ${typeof exercises}`);
      }
    }

    // Check against expected structure if provided
    if (expectedStructure) {
      const expectedKeys = expectedStructure.sort();
      const missing = expectedKeys.filter(key => !actualKeys.includes(key));
      const extra = actualKeys.filter(key => !expectedKeys.includes(key));

      if (missing.length > 0) {
        issues.push(`Missing blocks: ${missing.join(', ')}`);
      }
      if (extra.length > 0) {
        issues.push(`Extra blocks: ${extra.join(', ')}`);
      }
    }

    const valid = issues.length === 0;
    
    this.log('Block Structure Validation', {
      valid,
      actualKeys,
      expectedStructure,
      issues
    });

    return { valid, issues };
  }

  static generateReport(): string {
    const report = [
      '=== Block System Debug Report ===',
      `Generated at: ${new Date().toISOString()}`,
      `Total log entries: ${this.logs.length}`,
      '',
      '=== Transformation Flow ==='
    ];

    // Check for constraint violations
    const violations = this.logs.filter(log => log.type === 'constraint_violation');
    if (violations.length > 0) {
      report.push('', '=== ⚠️ CONSTRAINT VIOLATIONS ===');
      report.push(`Found ${violations.length} constraint violation(s):`);
      
      violations.forEach((v, idx) => {
        const data = v.data as any;
        report.push(`\n${idx + 1}. ${data.severity === 'error' ? '❌' : '⚠️'} ${v.stage}`);
        report.push(`   Constraint: ${data.constraint}`);
        report.push(`   Expected: ${JSON.stringify(data.expected)}`);
        report.push(`   Actual: ${JSON.stringify(data.actual)}`);
        if (data.message) {
          report.push(`   Message: ${data.message}`);
        }
      });
      
      report.push('', '=== Full Log Details ===');
    }

    for (const log of this.logs) {
      report.push(`\n[${log.timestamp}] ${log.stage}`);
      if (log.input) {
        report.push(`Input: ${JSON.stringify(log.input, null, 2)}`);
      }
      if (log.output) {
        report.push(`Output: ${JSON.stringify(log.output, null, 2)}`);
      }
      if (log.data) {
        report.push(`Data: ${JSON.stringify(log.data, null, 2)}`);
      }
    }

    return report.join('\n');
  }
  
  static getConstraintViolations() {
    return this.logs.filter(log => log.type === 'constraint_violation');
  }
}

// Export convenience functions
export const logBlock = BlockDebugger.log.bind(BlockDebugger);
export const logBlockTransformation = BlockDebugger.logBlockTransformation.bind(BlockDebugger);
export const logConstraintViolation = BlockDebugger.logConstraintViolation.bind(BlockDebugger);
export const validateBlockStructure = BlockDebugger.validateBlockStructure.bind(BlockDebugger);