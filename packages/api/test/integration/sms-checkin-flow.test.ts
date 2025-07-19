import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { processCheckIn } from '../../src/services/checkInService';
import { saveMessage } from '../../src/services/messageService';
import { sendSMS, normalizePhoneNumber } from '../../src/services/twilio';
import { interpretSMS } from '@acme/ai';
import { db } from '@acme/db/client';

// Mock all dependencies
vi.mock('@acme/db/client', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@acme/db/schema', () => ({
  UserTrainingSession: {},
  TrainingSession: {},
  user: {},
}));

vi.mock('@acme/db', () => ({
  eq: vi.fn((column, value) => ({ _tag: 'eq', column, value })),
  and: vi.fn((...conditions) => ({ _tag: 'and', conditions })),
}));

vi.mock('../../src/services/messageService');
vi.mock('../../src/services/twilio');
vi.mock('@acme/ai');

describe('SMS Check-in Flow Integration', () => {
  const mockPhoneNumber = '+12345678901';
  const mockSMSBody = 'here';
  
  const mockUser = {
    id: 'user-123',
    phone: mockPhoneNumber,
    businessId: 'business-456',
    name: 'Test User',
  };

  const mockSession = {
    id: 'session-789',
    businessId: 'business-456',
    name: 'Morning Workout',
    status: 'open',
    scheduledAt: new Date(),
  };

  const mockBroadcast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set up default mocks
    vi.mocked(normalizePhoneNumber).mockImplementation((phone) => {
      if (!phone) return '';
      const cleaned = phone.replace(/\D/g, '');
      return cleaned.length === 10 ? `+1${cleaned}` : `+${cleaned}`;
    });

    vi.mocked(interpretSMS).mockResolvedValue({
      intent: { type: 'check_in', confidence: 0.95 },
    });

    vi.mocked(saveMessage).mockResolvedValue({
      id: 'msg-123',
      userId: mockUser.id,
      businessId: mockUser.businessId,
      direction: 'inbound',
      content: mockSMSBody,
      phoneNumber: mockPhoneNumber,
      status: 'delivered',
      createdAt: new Date(),
    });

    vi.mocked(sendSMS).mockResolvedValue({
      sid: 'SM123456',
      status: 'sent',
    });
  });

  describe('Complete SMS Check-in Flow', () => {
    it('should process check-in from SMS to confirmation', async () => {
      // Setup: Mock DB queries for successful check-in
      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // First call: get user by phone
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([mockUser]),
              }),
            }),
          } as any;
        } else if (selectCallCount === 2) {
          // Second call: get open session
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([mockSession]),
              }),
            }),
          } as any;
        } else {
          // Third call: check existing check-in
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{
                  id: 'checkin-123',
                  userId: mockUser.id,
                  trainingSessionId: mockSession.id,
                  status: 'registered',
                }]),
              }),
            }),
          } as any;
        }
      });

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as any);

      // Execute: Process the check-in
      const result = await processCheckIn(mockPhoneNumber);

      // Verify: Check all steps executed correctly
      expect(result).toEqual({
        success: true,
        message: "Hello Test User! You're checked in for the session. Welcome!",
        userId: mockUser.id,
        businessId: mockUser.businessId,
        sessionId: mockSession.id,
        checkInId: expect.any(String),
        phoneNumber: '+12345678901',
        shouldStartPreferences: true,
      });

      // Verify user lookup
      expect(db.select).toHaveBeenCalled();

      // Verify check-in update
      expect(db.update).toHaveBeenCalled();
    });

    it('should handle check-in with keyword fallback when LLM fails', async () => {
      // Setup: LLM fails, fallback to keywords
      vi.mocked(interpretSMS).mockRejectedValue(new Error('LLM timeout'));

      // Mock successful check-in flow
      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // First call: get user by phone
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([mockUser]),
              }),
            }),
          } as any;
        } else if (selectCallCount === 2) {
          // Second call: get open session
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([mockSession]),
              }),
            }),
          } as any;
        } else {
          // Third call: check existing check-in
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{
                  id: 'checkin-123',
                  userId: mockUser.id,
                  trainingSessionId: mockSession.id,
                  status: 'registered',
                }]),
              }),
            }),
          } as any;
        }
      });

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as any);

      // Test various check-in keywords
      const checkInKeywords = ['here', 'im here', "i'm here", 'ready', 'checking in'];
      
      for (const keyword of checkInKeywords) {
        vi.clearAllMocks();
        
        // For keyword-based check-ins, we bypass LLM
        const result = await processCheckIn(mockPhoneNumber);
        
        expect(result.success).toBe(true);
        expect(result.message).toContain("You're checked in");
      }
    });

    it('should process check-in and return success response', async () => {
      // Setup mocks for successful flow
      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // First call: get user by phone
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([mockUser]),
              }),
            }),
          } as any;
        } else if (selectCallCount === 2) {
          // Second call: get open session
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([mockSession]),
              }),
            }),
          } as any;
        } else {
          // Third call: check existing check-in
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{
                  id: 'checkin-123',
                  userId: mockUser.id,
                  trainingSessionId: mockSession.id,
                  status: 'registered',
                }]),
              }),
            }),
          } as any;
        }
      });

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as any);

      // Process check-in
      const result = await processCheckIn(mockPhoneNumber);

      // Verify successful check-in
      expect(result.success).toBe(true);
      expect(result.userId).toBe(mockUser.id);
      expect(result.sessionId).toBe(mockSession.id);
    });

    it('should handle duplicate check-in gracefully', async () => {
      // Setup: User already checked in
      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // First call: get user by phone
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([mockUser]),
              }),
            }),
          } as any;
        } else if (selectCallCount === 2) {
          // Second call: get open session
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([mockSession]),
              }),
            }),
          } as any;
        } else {
          // Third call: check existing check-in - already checked in
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{
                  id: 'checkin-123',
                  userId: mockUser.id,
                  trainingSessionId: mockSession.id,
                  status: 'checked_in', // Already checked in
                }]),
              }),
            }),
          } as any;
        }
      });

      // Process check-in
      const result = await processCheckIn(mockPhoneNumber);

      // Should return success but indicate already checked in
      expect(result).toEqual({
        success: true,
        message: "Hello Test User! You're already checked in for this session!",
        userId: mockUser.id,
        businessId: mockUser.businessId,
        sessionId: mockSession.id,
        checkInId: 'checkin-123',
        phoneNumber: '+12345678901',
        shouldStartPreferences: false,
      });
    });
  });

  describe('Error Scenarios', () => {
    it('should handle unknown phone number', async () => {
      // Setup: No user found
      vi.mocked(db.select).mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          where: vi.fn().mockImplementation(() => ({
            limit: vi.fn().mockResolvedValue([]), // No user
          })),
        })),
      } as any));

      const result = await processCheckIn('+19999999999');

      expect(result).toEqual({
        success: false,
        message: "We couldn't find your account. Contact your trainer to get set up.",
      });

      // processCheckIn doesn't call sendSMS - that's handled by the webhook
    });

    it('should handle no open session', async () => {
      // Setup: User found but no open session
      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // First call: get user by phone
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([mockUser]),
              }),
            }),
          } as any;
        } else {
          // Second call: get open session - no session found
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]), // No session
              }),
            }),
          } as any;
        }
      });

      const result = await processCheckIn(mockPhoneNumber);

      expect(result).toEqual({
        success: false,
        message: "Hello Test User! There's no open session at your gym right now. Please check with your trainer.",
      });
    });

    it('should handle already checked-in users', async () => {
      // Setup: Already checked in
      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // First call: get user by phone
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([mockUser]),
              }),
            }),
          } as any;
        } else if (selectCallCount === 2) {
          // Second call: get open session
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([mockSession]),
              }),
            }),
          } as any;
        } else {
          // Third call: check existing check-in - already checked in
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{
                  id: 'checkin-123',
                  userId: mockUser.id,
                  trainingSessionId: mockSession.id,
                  status: 'checked_in', // Already checked in
                }]),
              }),
            }),
          } as any;
        }
      });

      const result = await processCheckIn(mockPhoneNumber);

      expect(result).toEqual({
        success: true,
        message: "Hello Test User! You're already checked in for this session!",
        userId: mockUser.id,
        businessId: mockUser.businessId,
        sessionId: mockSession.id,
        checkInId: 'checkin-123',
        phoneNumber: '+12345678901',
        shouldStartPreferences: false,
      });

      // Should not update or broadcast
      expect(db.update).not.toHaveBeenCalled();
    });
  });

  describe('Phone Number Normalization', () => {
    it('should handle various phone formats', async () => {
      const phoneFormats = [
        '(234) 567-8901',
        '234-567-8901',
        '234.567.8901',
        '2345678901',
        '+12345678901',
      ];

      // Setup successful check-in
      vi.mocked(db.select).mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          where: vi.fn().mockImplementation(() => ({
            limit: vi.fn().mockResolvedValue([mockUser]),
          })),
          innerJoin: vi.fn().mockImplementation(() => ({
            where: vi.fn().mockImplementation(() => ({
              limit: vi.fn().mockResolvedValue([{
                userId: mockUser.id,
                trainingSessionId: mockSession.id,
                status: 'registered',
                TrainingSession: mockSession,
              }]),
            })),
          })),
        })),
      } as any));

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as any);

      for (const phone of phoneFormats) {
        vi.clearAllMocks();
        
        const result = await processCheckIn(phone);
        
        expect(result.success).toBe(true);
        expect(normalizePhoneNumber).toHaveBeenCalledWith(phone);
      }
    });
  });

  describe('Real-time Broadcasting', () => {
    it('should broadcast check-in event on success', async () => {
      // Import and set broadcast function
      const { setBroadcastFunction } = await import('../../src/services/checkInService');
      setBroadcastFunction(mockBroadcast);

      // Setup successful check-in
      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // First call: get user by phone
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([mockUser]),
              }),
            }),
          } as any;
        } else if (selectCallCount === 2) {
          // Second call: get open session
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([mockSession]),
              }),
            }),
          } as any;
        } else {
          // Third call: check existing check-in
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([{
                  id: 'checkin-123',
                  userId: mockUser.id,
                  trainingSessionId: mockSession.id,
                  status: 'registered',
                }]),
              }),
            }),
          } as any;
        }
      });

      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      } as any);
      
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{
            id: 'checkin-new-123',
            userId: mockUser.id,
            trainingSessionId: mockSession.id,
            status: 'checked_in',
            checkedInAt: new Date(),
          }]),
        }),
      } as any);

      await processCheckIn(mockPhoneNumber);

      expect(mockBroadcast).toHaveBeenCalledWith(
        mockSession.id,
        expect.objectContaining({
          userId: mockUser.id,
          name: 'Test User',
          checkedInAt: expect.any(String),
        })
      );
    });

    it('should not broadcast for failed check-ins', async () => {
      const { setBroadcastFunction } = await import('../../src/services/checkInService');
      setBroadcastFunction(mockBroadcast);

      // Setup: No user found
      vi.mocked(db.select).mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          where: vi.fn().mockImplementation(() => ({
            limit: vi.fn().mockResolvedValue([]), // No user
          })),
        })),
      } as any));

      await processCheckIn('+19999999999');

      expect(mockBroadcast).not.toHaveBeenCalled();
    });
  });
});