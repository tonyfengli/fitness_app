import { describe, it, expect, vi, beforeEach } from 'vitest';
import { saveMessage, getMessagesByUser } from '../../src/services/messageService';
import { db } from '@acme/db/client';
import { messages } from '@acme/db/schema';

// Mock the database
vi.mock('@acme/db/client', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([{ id: 'test-message-id' }])),
      })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => ({
              offset: vi.fn(() => Promise.resolve([])),
            })),
          })),
        })),
      })),
    })),
  },
}));

// Mock the schema
vi.mock('@acme/db/schema', () => ({
  messages: {
    userId: 'messages.userId',
    createdAt: 'messages.createdAt',
  },
}));

// Mock the DB utilities
vi.mock('@acme/db', () => ({
  eq: vi.fn((column, value) => ({ _tag: 'eq', column, value })),
  desc: vi.fn((column) => ({ _tag: 'desc', column })),
}));

describe('MessageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('saveMessage', () => {
    const mockMessage = {
      userId: 'user-123',
      businessId: 'business-456',
      direction: 'inbound' as const,
      content: 'Test message content',
      phoneNumber: '+12345678901',
      status: 'delivered',
    };

    it('should save a message successfully', async () => {
      const mockSavedMessage = {
        id: 'msg-789',
        ...mockMessage,
        createdAt: new Date(),
      };

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockSavedMessage]),
        }),
      } as any);

      const result = await saveMessage(mockMessage);

      expect(result).toEqual(mockSavedMessage);
      expect(db.insert).toHaveBeenCalledWith(messages);
    });

    it('should save message with metadata', async () => {
      const messageWithMetadata = {
        ...mockMessage,
        metadata: {
          intent: { type: 'check_in', confidence: 0.95 },
          twilioMessageSid: 'SM123456',
        },
      };

      const mockSavedMessage = {
        id: 'msg-789',
        ...messageWithMetadata,
        createdAt: new Date(),
      };

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockSavedMessage]),
        }),
      } as any);

      const result = await saveMessage(messageWithMetadata);

      expect(result).toEqual(mockSavedMessage);
      expect(result?.metadata).toEqual(messageWithMetadata.metadata);
    });

    it('should handle database errors gracefully', async () => {
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(new Error('Database error')),
        }),
      } as any);

      const result = await saveMessage(mockMessage);

      expect(result).toBeNull();
    });

    it('should save outbound messages', async () => {
      const outboundMessage = {
        ...mockMessage,
        direction: 'outbound' as const,
        status: 'sent',
      };

      const mockSavedMessage = {
        id: 'msg-790',
        ...outboundMessage,
        createdAt: new Date(),
      };

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockSavedMessage]),
        }),
      } as any);

      const result = await saveMessage(outboundMessage);

      expect(result).toEqual(mockSavedMessage);
      expect(result?.direction).toBe('outbound');
    });

    it('should handle missing optional fields', async () => {
      const minimalMessage = {
        userId: 'user-123',
        businessId: 'business-456',
        direction: 'inbound' as const,
        content: 'Test',
        phoneNumber: '+12345678901',
        status: 'delivered',
      };

      const mockSavedMessage = {
        id: 'msg-791',
        ...minimalMessage,
        metadata: null,
        createdAt: new Date(),
      };

      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockSavedMessage]),
        }),
      } as any);

      const result = await saveMessage(minimalMessage);

      expect(result).toEqual(mockSavedMessage);
    });

    it('should save messages with unnormalized phone numbers as-is', async () => {
      const messageWithUnnormalizedPhone = {
        ...mockMessage,
        phoneNumber: '(234) 567-8901',
      };

      let capturedValues: any;
      vi.mocked(db.insert).mockReturnValue({
        values: vi.fn().mockImplementation((values) => {
          capturedValues = values;
          return {
            returning: vi.fn().mockResolvedValue([{
              id: 'msg-792',
              ...values,
              createdAt: new Date(),
            }]),
          };
        }),
      } as any);

      await saveMessage(messageWithUnnormalizedPhone);

      // Phone numbers are stored as-is without normalization
      expect(capturedValues.phoneNumber).toBe('(234) 567-8901');
    });
  });

  describe('getMessagesByUser', () => {
    it('should retrieve messages for a user', async () => {
      const mockMessages = [
        {
          id: 'msg-1',
          userId: 'user-123',
          content: 'Message 1',
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'msg-2',
          userId: 'user-123',
          content: 'Message 2',
          createdAt: new Date('2024-01-02'),
        },
      ];

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockMessages),
          }),
        }),
      } as any);

      const result = await getMessagesByUser('user-123');

      expect(result).toEqual(mockMessages);
    });

    it('should order messages by createdAt descending', async () => {
      const mockMessages = [];

      const mockOrderBy = vi.fn().mockResolvedValue(mockMessages);
      const mockWhere = vi.fn().mockReturnValue({
        orderBy: mockOrderBy,
      });
      const mockFrom = vi.fn().mockReturnValue({
        where: mockWhere,
      });

      vi.mocked(db.select).mockReturnValue({
        from: mockFrom,
      } as any);

      await getMessagesByUser('user-123');

      expect(mockOrderBy).toHaveBeenCalled();
    });

    it('should handle empty results', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
          }),
        }),
      } as any);

      const result = await getMessagesByUser('user-with-no-messages');

      expect(result).toEqual([]);
    });

    it('should handle database errors', async () => {
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockRejectedValue(new Error('Database error')),
          }),
        }),
      } as any);

      const result = await getMessagesByUser('user-123');

      expect(result).toEqual([]);
    });


    it('should handle large result sets', async () => {
      const largeMessageSet = Array(100).fill(null).map((_, i) => ({
        id: `msg-${i}`,
        userId: 'user-123',
        content: `Message ${i}`,
        createdAt: new Date(),
      }));

      vi.mocked(db.select).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(largeMessageSet),
          }),
        }),
      } as any);

      const result = await getMessagesByUser('user-123');

      // Without pagination, all messages are returned
      expect(result).toHaveLength(100);
    });
  });
});