// server/src/lib/leaveRequests.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreate = vi.fn();
const mockUpsert = vi.fn();
const mockFindFirst = vi.fn();
const mockSendLeaveManagerNotification = vi.fn();

vi.mock('./prisma.js', () => ({
  prisma: {
    leaveRequest: { create: (...args: unknown[]) => mockCreate(...args) },
    leaveBalance: { upsert: (...args: unknown[]) => mockUpsert(...args) },
    employee: { findFirst: (...args: unknown[]) => mockFindFirst(...args) },
  },
}));
vi.mock('./whatsapp.js', () => ({ sendLeaveManagerNotification: (...args: unknown[]) => mockSendLeaveManagerNotification(...args) }));

const { createLeaveRequestRecord } = await import('./leaveRequests.js');

describe('createLeaveRequestRecord', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockUpsert.mockReset();
    mockFindFirst.mockReset();
    mockSendLeaveManagerNotification.mockReset();
  });

  const baseParams = {
    companyId: 'c1',
    employeeId: 'e1',
    type: 'conge_paye' as const,
    startDate: new Date('2026-08-10T00:00:00Z'),
    endDate: new Date('2026-08-21T00:00:00Z'),
    daysCount: 12,
    channel: 'whatsapp' as const,
  };

  it('creates the request, upserts the pending balance, and notifies a manager with a phone number', async () => {
    mockCreate.mockResolvedValue({ id: 'req1', ...baseParams });
    mockFindFirst.mockResolvedValue({
      id: 'e1', firstName: 'Awa', lastName: 'Ouédraogo', managerId: 'mgr1',
      manager: { phone: '70123456' }, company: { countryCode: 'BF' },
    });

    const result = await createLeaveRequestRecord(baseParams);

    expect(result.id).toBe('req1');
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        companyId: 'c1', employeeId: 'e1', type: 'conge_paye',
        startDate: baseParams.startDate, endDate: baseParams.endDate,
        daysCount: 12, reason: undefined, channel: 'whatsapp',
      },
    });
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockSendLeaveManagerNotification).toHaveBeenCalledWith('70123456', 'BF', {
      employeeName: 'Awa Ouédraogo', startDate: '10/08/2026', endDate: '21/08/2026',
    });
  });

  it('skips the WhatsApp manager notification when the employee has no manager', async () => {
    mockCreate.mockResolvedValue({ id: 'req2', ...baseParams });
    mockFindFirst.mockResolvedValue({ id: 'e1', firstName: 'Awa', lastName: 'Ouédraogo', managerId: null, manager: null, company: { countryCode: 'BF' } });

    await createLeaveRequestRecord(baseParams);

    expect(mockSendLeaveManagerNotification).not.toHaveBeenCalled();
  });
});
