import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We'll test normalizePhoneNumber directly without mocking
describe('TwilioService', () => {
  // Import the actual function for testing
  let normalizePhoneNumber: (phone: string) => string;

  beforeEach(async () => {
    // Import the module fresh for each test
    const module = await import('../../src/services/twilio');
    normalizePhoneNumber = module.normalizePhoneNumber;
  });

  describe('normalizePhoneNumber', () => {
    it('should normalize US numbers with country code', () => {
      expect(normalizePhoneNumber('+12345678901')).toBe('+12345678901');
      expect(normalizePhoneNumber('+1 234 567 8901')).toBe('+12345678901');
      expect(normalizePhoneNumber('+1-234-567-8901')).toBe('+12345678901');
      expect(normalizePhoneNumber('+1 (234) 567-8901')).toBe('+12345678901');
    });

    it('should add +1 to 10-digit US numbers', () => {
      expect(normalizePhoneNumber('2345678901')).toBe('+12345678901');
      expect(normalizePhoneNumber('234-567-8901')).toBe('+12345678901');
      expect(normalizePhoneNumber('(234) 567-8901')).toBe('+12345678901');
      expect(normalizePhoneNumber('234.567.8901')).toBe('+12345678901');
    });

    it('should handle numbers with spaces and special characters', () => {
      expect(normalizePhoneNumber('234 567 8901')).toBe('+12345678901');
      expect(normalizePhoneNumber('(234)567-8901')).toBe('+12345678901');
      expect(normalizePhoneNumber('234/567/8901')).toBe('+12345678901');
    });

    it('should preserve international numbers', () => {
      expect(normalizePhoneNumber('+442071234567')).toBe('+442071234567');
      expect(normalizePhoneNumber('+33123456789')).toBe('+33123456789');
      expect(normalizePhoneNumber('+8613912345678')).toBe('+8613912345678');
    });

    it('should handle edge cases', () => {
      expect(normalizePhoneNumber('')).toBe('+');
      expect(normalizePhoneNumber('invalid')).toBe('+');
      expect(normalizePhoneNumber('123')).toBe('+123'); 
      expect(normalizePhoneNumber('12345678901234567890')).toBe('+12345678901234567890');
    });

    it('should handle 11-digit US numbers', () => {
      expect(normalizePhoneNumber('12345678901')).toBe('+12345678901');
      expect(normalizePhoneNumber('1-234-567-8901')).toBe('+12345678901');
    });
  });

  describe('sendSMS', () => {
    // For sendSMS, we'll create a separate test file that properly mocks Twilio
    // or test it as an integration test
    it.skip('should be tested with proper Twilio mocking', () => {
      // Placeholder - actual SMS sending tests would require proper Twilio client mocking
    });
  });
});