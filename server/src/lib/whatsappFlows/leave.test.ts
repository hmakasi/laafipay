import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockAdvanceSession = vi.fn();
const mockEndSession = vi.fn();
const mockSendText = vi.fn().mockResolvedValue({ ok: true });
const mockSendList = vi.fn().mockResolvedValue({ ok: true });
const mockSendButtons = vi.fn().mockResolvedValue({ ok: true });
const mockCreateLeaveRequest = vi.fn();
const mockFindBalances = vi.fn();

vi.mock('../whatsappSession.js', () => ({ startSession: vi.fn().mockResolvedValue({ id: 's1' }), advanceSession: (...a: unknown[]) => mockAdvanceSession(...a), endSession: (...a: unknown[]) => mockEndSession(...a) }));
vi.mock('../whatsapp.js', () => ({ sendWhatsAppTextMessage: (...a: unknown[]) => mockSendText(...a), sendWhatsAppListMessage: (...a: unknown[]) => mockSendList(...a), sendWhatsAppReplyButtons: (...a: unknown[]) => mockSendButtons(...a) }));
vi.mock('../leaveRequests.js', () => ({ createLeaveRequestRecord: (...a: unknown[]) => mockCreateLeaveRequest(...a) }));
vi.mock('../prisma.js', () => ({ prisma: { leaveBalance: { findMany: (...a: unknown[]) => mockFindBalances(...a) } } }));

const { startLeaveFlow, handleLeaveFlowMessage } = await import('./leave.js');

const employee = { id: 'e1', companyId: 'c1', firstName: 'Awa', lastName: 'Ouédraogo', company: { countryCode: 'BF' } };

describe('startLeaveFlow', () => {
  beforeEach(() => {
    mockSendText.mockReset().mockResolvedValue({ ok: true });
    mockSendList.mockReset().mockResolvedValue({ ok: true });
    mockFindBalances.mockReset();
  });

  it('shows current balances followed by the leave-type list', async () => {
    mockFindBalances.mockResolvedValue([
      { type: 'conge_paye', remaining: 18 },
      { type: 'conge_anciennete', remaining: 2 },
    ]);
    await startLeaveFlow(employee as never, '22670123456');
    expect(mockSendText).toHaveBeenCalledWith('22670123456', expect.stringContaining('18 jours'));
    expect(mockSendList).toHaveBeenCalledTimes(1);
    const [, params] = mockSendList.mock.calls[0];
    expect(params.sections[0].rows).toHaveLength(6);
    expect(params.sections[0].rows[0]).toEqual({ id: 'conge_paye', title: 'Congé payé légal' });
  });
});

describe('handleLeaveFlowMessage — choosing_type step', () => {
  const session = { id: 's1', phone: '22670123456', flow: 'leave_request', step: 'choosing_type', data: {} };

  beforeEach(() => {
    mockAdvanceSession.mockReset();
    mockSendText.mockReset().mockResolvedValue({ ok: true });
  });

  it('advances to awaiting_start_date on a valid list reply', async () => {
    await handleLeaveFlowMessage(session as never, employee as never, { from: '22670123456', kind: 'list_reply', id: 'conge_paye' });
    expect(mockAdvanceSession).toHaveBeenCalledWith('s1', { step: 'awaiting_start_date', data: { leaveType: 'conge_paye' } });
    expect(mockSendText).toHaveBeenCalledWith('22670123456', expect.stringContaining('JJ/MM/AAAA'));
  });
});

describe('handleLeaveFlowMessage — awaiting_start_date step', () => {
  const session = { id: 's1', phone: '22670123456', flow: 'leave_request', step: 'awaiting_start_date', data: { leaveType: 'conge_paye' } };

  beforeEach(() => {
    mockAdvanceSession.mockReset();
    mockSendText.mockReset().mockResolvedValue({ ok: true });
  });

  it('rejects an invalid date format', async () => {
    await handleLeaveFlowMessage(session as never, employee as never, { from: '22670123456', kind: 'text', text: 'pas une date' });
    expect(mockSendText).toHaveBeenCalledWith('22670123456', expect.stringContaining('JJ/MM/AAAA'));
    expect(mockAdvanceSession).not.toHaveBeenCalled();
  });

  it('advances to awaiting_end_date on a valid date', async () => {
    await handleLeaveFlowMessage(session as never, employee as never, { from: '22670123456', kind: 'text', text: '10/08/2026' });
    expect(mockAdvanceSession).toHaveBeenCalledWith('s1', { step: 'awaiting_end_date', data: { leaveType: 'conge_paye', startDate: '10/08/2026' } });
  });
});

describe('handleLeaveFlowMessage — awaiting_end_date step', () => {
  const session = { id: 's1', phone: '22670123456', flow: 'leave_request', step: 'awaiting_end_date', data: { leaveType: 'conge_paye', startDate: '10/08/2026' } };

  beforeEach(() => {
    mockAdvanceSession.mockReset();
    mockSendText.mockReset().mockResolvedValue({ ok: true });
    mockSendButtons.mockReset().mockResolvedValue({ ok: true });
    mockFindBalances.mockReset().mockResolvedValue([{ type: 'conge_paye', remaining: 18 }]);
  });

  it('rejects an end date before the start date', async () => {
    await handleLeaveFlowMessage(session as never, employee as never, { from: '22670123456', kind: 'text', text: '05/08/2026' });
    expect(mockSendText).toHaveBeenCalledWith('22670123456', expect.stringContaining('après'));
    expect(mockAdvanceSession).not.toHaveBeenCalled();
  });

  it('shows the recap with confirm/cancel buttons on a valid range', async () => {
    await handleLeaveFlowMessage(session as never, employee as never, { from: '22670123456', kind: 'text', text: '21/08/2026' });
    expect(mockAdvanceSession).toHaveBeenCalledWith('s1', { step: 'awaiting_confirmation', data: { leaveType: 'conge_paye', startDate: '10/08/2026', endDate: '21/08/2026', daysCount: 12 } });
    expect(mockSendButtons).toHaveBeenCalledWith('22670123456', expect.objectContaining({ buttons: [{ id: 'confirm', title: '✅ Confirmer' }, { id: 'cancel', title: '❌ Annuler' }] }));
  });
});

describe('handleLeaveFlowMessage — awaiting_confirmation step', () => {
  const session = { id: 's1', phone: '22670123456', flow: 'leave_request', step: 'awaiting_confirmation', data: { leaveType: 'conge_paye', startDate: '10/08/2026', endDate: '21/08/2026', daysCount: 12 } };

  beforeEach(() => {
    mockEndSession.mockReset();
    mockSendText.mockReset().mockResolvedValue({ ok: true });
    mockCreateLeaveRequest.mockReset().mockResolvedValue({ id: 'req1' });
  });

  it('cancels on the cancel button without creating a request', async () => {
    await handleLeaveFlowMessage(session as never, employee as never, { from: '22670123456', kind: 'button_reply', id: 'cancel' });
    expect(mockCreateLeaveRequest).not.toHaveBeenCalled();
    expect(mockSendText).toHaveBeenCalledWith('22670123456', expect.stringContaining('annulée'));
    expect(mockEndSession).toHaveBeenCalledWith('s1');
  });

  it('creates the leave request on confirm', async () => {
    await handleLeaveFlowMessage(session as never, employee as never, { from: '22670123456', kind: 'button_reply', id: 'confirm' });
    expect(mockCreateLeaveRequest).toHaveBeenCalledWith({
      companyId: 'c1', employeeId: 'e1', type: 'conge_paye',
      startDate: new Date(Date.UTC(2026, 7, 10)), endDate: new Date(Date.UTC(2026, 7, 21)),
      daysCount: 12, channel: 'whatsapp',
    });
    expect(mockSendText).toHaveBeenCalledWith('22670123456', expect.stringContaining('envoyée'));
    expect(mockEndSession).toHaveBeenCalledWith('s1');
  });
});
