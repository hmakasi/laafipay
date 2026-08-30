import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFindFirst = vi.fn();
const mockSessionFindUnique = vi.fn();
const mockSessionUpsert = vi.fn();
const mockSessionUpdate = vi.fn();
const mockSessionDelete = vi.fn();

vi.mock('./prisma.js', () => ({
  prisma: {
    employee: { findFirst: (...args: unknown[]) => mockFindFirst(...args) },
    whatsAppSession: {
      findUnique: (...args: unknown[]) => mockSessionFindUnique(...args),
      upsert: (...args: unknown[]) => mockSessionUpsert(...args),
      update: (...args: unknown[]) => mockSessionUpdate(...args),
      delete: (...args: unknown[]) => mockSessionDelete(...args),
    },
  },
}));

const { resolveEmployeeByWhatsAppPhone, getActiveSession, startSession, advanceSession, endSession } = await import('./whatsappSession.js');

describe('resolveEmployeeByWhatsAppPhone', () => {
  beforeEach(() => mockFindFirst.mockReset());

  it('matches by the last 8 digits of the inbound phone number', async () => {
    mockFindFirst.mockResolvedValue({ id: 'e1', phone: '70123456' });
    const result = await resolveEmployeeByWhatsAppPhone('22670123456');
    expect(result).toEqual({ id: 'e1', phone: '70123456' });
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { OR: [{ phone: '22670123456' }, { phone: '70123456' }, { phone: { endsWith: '70123456' } }] },
      include: { company: true },
    });
  });

  it('returns null when no employee matches', async () => {
    mockFindFirst.mockResolvedValue(null);
    expect(await resolveEmployeeByWhatsAppPhone('22670123456')).toBeNull();
  });
});

describe('session lifecycle', () => {
  beforeEach(() => {
    mockSessionFindUnique.mockReset();
    mockSessionUpsert.mockReset();
    mockSessionUpdate.mockReset();
    mockSessionDelete.mockReset();
  });

  it('getActiveSession returns null when no session row exists', async () => {
    mockSessionFindUnique.mockResolvedValue(null);
    expect(await getActiveSession('22670123456')).toBeNull();
  });

  it('getActiveSession returns null when the session has expired', async () => {
    mockSessionFindUnique.mockResolvedValue({ id: 's1', phone: '22670123456', expiresAt: new Date('2026-08-30T09:00:00Z') });
    expect(await getActiveSession('22670123456', new Date('2026-08-30T09:30:00Z'))).toBeNull();
  });

  it('getActiveSession returns the session when still within TTL', async () => {
    const session = { id: 's1', phone: '22670123456', expiresAt: new Date('2026-08-30T09:15:00Z') };
    mockSessionFindUnique.mockResolvedValue(session);
    expect(await getActiveSession('22670123456', new Date('2026-08-30T09:10:00Z'))).toEqual(session);
  });

  it('startSession upserts with a fresh 10-minute expiry', async () => {
    mockSessionUpsert.mockResolvedValue({ id: 's1' });
    const now = new Date('2026-08-30T09:00:00Z');
    await startSession({ phone: '22670123456', employeeId: 'e1', flow: 'leave_request', step: 'choosing_type', data: { foo: 'bar' } }, now);
    expect(mockSessionUpsert).toHaveBeenCalledWith({
      where: { phone: '22670123456' },
      create: { phone: '22670123456', employeeId: 'e1', flow: 'leave_request', step: 'choosing_type', data: { foo: 'bar' }, expiresAt: new Date('2026-08-30T09:10:00Z') },
      update: { employeeId: 'e1', flow: 'leave_request', step: 'choosing_type', data: { foo: 'bar' }, expiresAt: new Date('2026-08-30T09:10:00Z') },
    });
  });

  it('advanceSession updates the step/data and renews the expiry', async () => {
    mockSessionUpdate.mockResolvedValue({ id: 's1' });
    const now = new Date('2026-08-30T09:05:00Z');
    await advanceSession('s1', { step: 'awaiting_start_date', data: { leaveType: 'conge_paye' } }, now);
    expect(mockSessionUpdate).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { step: 'awaiting_start_date', data: { leaveType: 'conge_paye' }, expiresAt: new Date('2026-08-30T09:15:00Z') },
    });
  });

  it('endSession deletes the row', async () => {
    await endSession('s1');
    expect(mockSessionDelete).toHaveBeenCalledWith({ where: { id: 's1' } });
  });
});
