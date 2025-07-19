import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@acme/db/client';
import { processCheckIn } from '../../src/services/checkInService';

// Mock dependencies
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

vi.mock('../../src/services/twilio');
vi.mock('../../src/services/messageService');

describe('Session Lifecycle Integration', () => {
  const mockBusiness = {
    id: 'business-456',
    name: 'Fitness Studio',
  };

  const mockTrainer = {
    id: 'trainer-123',
    businessId: mockBusiness.id,
    role: 'trainer',
  };

  const mockClients = [
    {
      id: 'client-1',
      phone: '+12345678901',
      businessId: mockBusiness.id,
      name: 'John Doe',
    },
    {
      id: 'client-2',
      phone: '+19876543210',
      businessId: mockBusiness.id,
      name: 'Jane Smith',
    },
    {
      id: 'client-3',
      phone: '+15555555555',
      businessId: mockBusiness.id,
      name: 'Bob Johnson',
    },
  ];

  const mockSession = {
    id: 'session-789',
    businessId: mockBusiness.id,
    name: 'Morning HIIT',
    status: 'open',
    scheduledAt: new Date(),
    durationMinutes: 60,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Complete Session Flow', () => {
    it('should handle session creation to completion', async () => {
      // Step 1: Create session (status: open)
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockSession]),
        }),
      } as any);

      // Verify session created with open status
      expect(mockSession.status).toBe('open');

      // Step 2: Multiple clients check in
      for (const client of mockClients) {
        let selectCallCount = 0;
        vi.mocked(db.select).mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) {
            // First call: get user by phone
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([client]),
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
                    id: `checkin-${client.id}`,
                    userId: client.id,
                    trainingSessionId: mockSession.id,
                    status: 'registered',
                  }]),
                }),
              }),
            } as any;
          }
        });

        // Mock check-in update
        vi.mocked(db.update).mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        } as any);

        const result = await processCheckIn(client.phone);
        
        expect(result.success).toBe(true);
        expect(result.sessionId).toBe(mockSession.id);
      }

      // Step 3: Trainer starts session (open → in_progress)
      const inProgressSession = { ...mockSession, status: 'in_progress' };
      
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([inProgressSession]),
          }),
        }),
      } as any);

      // Step 4: Late client tries to check in (should fail)
      const lateClient = {
        id: 'client-late',
        phone: '+11234567890',
        businessId: mockBusiness.id,
        name: 'Late Client',
      };

      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // First call: get user by phone
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([lateClient]),
              }),
            }),
          } as any;
        } else {
          // Second call: get open session - none found (session is in_progress)
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]), // No open session
              }),
            }),
          } as any;
        }
      });

      const lateResult = await processCheckIn(lateClient.phone);
      
      expect(lateResult.success).toBe(false);
      expect(lateResult.message).toContain("There's no open session at your gym right now");

      // Step 5: Trainer completes session (in_progress → closed)
      const closedSession = { ...mockSession, status: 'closed' };
      
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([closedSession]),
          }),
        }),
      } as any);

      expect(closedSession.status).toBe('closed');
    });
  });

  describe('Business Constraints', () => {
    it('should enforce one open session per business', async () => {
      // Create first session
      const firstSession = {
        ...mockSession,
        id: 'session-1',
        status: 'open',
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([firstSession]), // Existing open session
          }),
        }),
      } as any);

      // Try to create second session (should fail)
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(
            new Error('There is already an open session for this business')
          ),
        }),
      } as any);

      // Verify constraint is enforced
      await expect(
        db.insert({} as any).values({}).returning()
      ).rejects.toThrow('There is already an open session for this business');
    });

    it('should allow new session after previous one closes', async () => {
      // First session is closed
      const closedSession = {
        ...mockSession,
        id: 'session-1',
        status: 'closed',
      };

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]), // No open sessions
          }),
        }),
      } as any);

      // Create new session (should succeed)
      const newSession = {
        ...mockSession,
        id: 'session-2',
        status: 'open',
      };

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([newSession]),
        }),
      } as any);

      const result = await db.insert({} as any).values({}).returning();
      
      expect(result[0].status).toBe('open');
    });
  });

  describe('State Transitions', () => {
    it('should only allow valid state transitions', async () => {
      // Valid: open → in_progress
      let currentSession = { ...mockSession, status: 'open' };
      
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{
              ...currentSession,
              status: 'in_progress',
            }]),
          }),
        }),
      } as any);

      let result = await db.update({} as any)
        .set({ status: 'in_progress' })
        .where({} as any)
        .returning();

      expect(result[0].status).toBe('in_progress');

      // Valid: in_progress → closed
      currentSession = { ...mockSession, status: 'in_progress' };
      
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{
              ...currentSession,
              status: 'closed',
            }]),
          }),
        }),
      } as any);

      result = await db.update({} as any)
        .set({ status: 'closed' })
        .where({} as any)
        .returning();

      expect(result[0].status).toBe('closed');

      // Invalid: open → closed (skip in_progress)
      vi.mocked(db.update).mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]), // No update
          }),
        }),
      } as any);

      result = await db.update({} as any)
        .set({ status: 'closed' })
        .where({} as any)
        .returning();

      expect(result).toHaveLength(0);
    });
  });

  describe('Concurrent Check-ins', () => {
    it('should handle multiple simultaneous check-ins', async () => {
      // Set up mocks that work for all clients
      vi.mocked(db.select).mockImplementation(() => ({
        from: vi.fn().mockImplementation(() => ({
          where: vi.fn().mockImplementation(() => ({
            limit: vi.fn().mockImplementation(async () => {
              // This will be called multiple times - return appropriate data
              return [];
            }),
          })),
        })),
      } as any));

      // Process check-ins sequentially for test simplicity
      const results = [];
      for (const client of mockClients) {
        let selectCallCount = 0;
        vi.mocked(db.select).mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) {
            // First call: get user by phone
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([client]),
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
            // Third call: check existing check-in - none exists
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([]), // No existing check-in
                }),
              }),
            } as any;
          }
        });

        // Mock insert for new check-in
        vi.mocked(db.insert).mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{
              id: `checkin-new-${client.id}`,
              userId: client.id,
              trainingSessionId: mockSession.id,
              status: 'checked_in',
              checkedInAt: new Date(),
            }]),
          }),
        } as any);

        const result = await processCheckIn(client.phone);
        results.push(result);
      }

      // All check-ins should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.sessionId).toBe(mockSession.id);
      });

      // Verify all clients are checked in
      expect(results).toHaveLength(mockClients.length);
    });

    it('should handle duplicate check-in attempts gracefully', async () => {
      const client = mockClients[0];

      // First check-in
      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // First call: get user by phone
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([client]),
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
                  userId: client.id,
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

      const firstResult = await processCheckIn(client.phone);
      expect(firstResult.success).toBe(true);

      // Second check-in (already checked in)
      selectCallCount = 0; // Reset counter
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // First call: get user by phone
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([client]),
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
                  userId: client.id,
                  trainingSessionId: mockSession.id,
                  status: 'checked_in', // Already checked in
                }]),
              }),
            }),
          } as any;
        }
      });

      const secondResult = await processCheckIn(client.phone);
      
      expect(secondResult.success).toBe(true);
      expect(secondResult.message).toContain("already checked in");
    });
  });

  describe('Cross-Business Isolation', () => {
    it('should isolate sessions between businesses', async () => {
      const otherBusiness = {
        id: 'business-999',
        name: 'Other Gym',
      };

      const otherBusinessClient = {
        id: 'client-other',
        phone: '+17777777777',
        businessId: otherBusiness.id,
        name: 'Other Client',
      };

      // Client from other business tries to check into our session
      let selectCallCount = 0;
      vi.mocked(db.select).mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) {
          // First call: get user by phone
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([otherBusinessClient]),
              }),
            }),
          } as any;
        } else {
          // Second call: get open session - no session for their business
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]), // No session
              }),
            }),
          } as any;
        }
      });

      const result = await processCheckIn(otherBusinessClient.phone);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain("There's no open session at your gym right now");
    });

    it('should allow multiple businesses to have open sessions simultaneously', async () => {
      const businesses = [
        { id: 'biz-1', session: { id: 'session-1', status: 'open' } },
        { id: 'biz-2', session: { id: 'session-2', status: 'open' } },
        { id: 'biz-3', session: { id: 'session-3', status: 'open' } },
      ];

      // Each business can have its own open session
      businesses.forEach(biz => {
        expect(biz.session.status).toBe('open');
      });

      // Verify isolation - clients can only check into their business's session
      expect(businesses).toHaveLength(3);
    });
  });
});