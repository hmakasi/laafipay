import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hashPin } from '../whatsappPin.js';

const mockAdvanceSession = vi.fn();
const mockEndSession = vi.fn();
const mockSendText = vi.fn().mockResolvedValue({ ok: true });
const mockSendDocument = vi.fn().mockResolvedValue({ ok: true });
const mockFindEmployee = vi.fn();
const mockFindPayslip = vi.fn();
const mockUpdatePayslip = vi.fn();
const mockBlobPut = vi.fn().mockResolvedValue({ url: 'https://blob.example.com/p.pdf' });

vi.mock('../whatsappSession.js', () => ({ advanceSession: (...a: unknown[]) => mockAdvanceSession(...a), endSession: (...a: unknown[]) => mockEndSession(...a) }));
vi.mock('../whatsapp.js', () => ({ sendWhatsAppTextMessage: (...a: unknown[]) => mockSendText(...a), sendWhatsAppDocument: (...a: unknown[]) => mockSendDocument(...a) }));
vi.mock('../payslipPdf.js', () => ({ generatePayslipPdf: () => Buffer.from('%PDF-fake') }));
vi.mock('@vercel/blob', () => ({ put: (...a: unknown[]) => mockBlobPut(...a) }));
vi.mock('../prisma.js', () => ({
  prisma: {
    employee: { update: (...a: unknown[]) => mockFindEmployee(...a) },
    payslip: { findFirst: (...a: unknown[]) => mockFindPayslip(...a), update: (...a: unknown[]) => mockUpdatePayslip(...a) },
  },
}));

const { handlePayslipFlowMessage } = await import('./payslip.js');

const employee = {
  id: 'e1', phone: '70123456', firstName: 'Awa', lastName: 'Ouédraogo',
  whatsappPinHash: '$2a$10$fakehashfakehashfakehashfakehashfakehash', whatsappPinFailedAttempts: 0, whatsappPinLockedUntil: null,
  company: { countryCode: 'BF' },
};
const session = { id: 's1', phone: '22670123456', flow: 'payslip_delivery', step: 'awaiting_pin', data: { payslipId: 'p1' } };

describe('handlePayslipFlowMessage — awaiting_pin step', () => {
  beforeEach(() => {
    mockAdvanceSession.mockReset();
    mockEndSession.mockReset();
    mockSendText.mockReset().mockResolvedValue({ ok: true });
    mockSendDocument.mockReset().mockResolvedValue({ ok: true });
    mockFindPayslip.mockReset();
    mockUpdatePayslip.mockReset();
  });

  it('rejects a non-4-digit reply without consuming an attempt', async () => {
    await handlePayslipFlowMessage(session as never, employee as never, { from: '22670123456', kind: 'text', text: 'abcd' });
    expect(mockSendText).toHaveBeenCalledWith('22670123456', expect.stringContaining('4 chiffres'));
    expect(mockAdvanceSession).not.toHaveBeenCalled();
    expect(mockEndSession).not.toHaveBeenCalled();
  });

  it('sends the cached PDF and ends the session on a correct PIN', async () => {
    const pinHash = await hashPin('4821');
    mockFindPayslip.mockResolvedValue({ id: 'p1', pdfUrl: 'https://blob.example.com/cached.pdf', period: '2026-07' });
    await handlePayslipFlowMessage(session as never, { ...employee, whatsappPinHash: pinHash } as never, { from: '22670123456', kind: 'text', text: '4821' });
    expect(mockSendDocument).toHaveBeenCalledWith('22670123456', { link: 'https://blob.example.com/cached.pdf', filename: expect.stringContaining('.pdf') });
    expect(mockEndSession).toHaveBeenCalledWith('s1');
  });

  it('generates and caches the PDF when none exists yet', async () => {
    const pinHash = await hashPin('4821');
    mockFindPayslip.mockResolvedValue({ id: 'p1', pdfUrl: null, period: '2026-07' });
    mockUpdatePayslip.mockResolvedValue({});
    await handlePayslipFlowMessage(session as never, { ...employee, whatsappPinHash: pinHash } as never, { from: '22670123456', kind: 'text', text: '4821' });
    expect(mockBlobPut).toHaveBeenCalledTimes(1);
    expect(mockUpdatePayslip).toHaveBeenCalledWith({ where: { id: 'p1' }, data: { pdfUrl: 'https://blob.example.com/p.pdf' } });
    expect(mockSendDocument).toHaveBeenCalledWith('22670123456', { link: 'https://blob.example.com/p.pdf', filename: expect.stringContaining('.pdf') });
  });

  it('rejects an incorrect PIN and keeps the session open with attempts remaining', async () => {
    const pinHash = await hashPin('4821');
    await handlePayslipFlowMessage(session as never, { ...employee, whatsappPinHash: pinHash } as never, { from: '22670123456', kind: 'text', text: '0000' });
    expect(mockSendText).toHaveBeenCalledWith('22670123456', expect.stringContaining('incorrect'));
    expect(mockAdvanceSession).toHaveBeenCalledWith('s1', { step: 'awaiting_pin', data: { payslipId: 'p1' } });
    expect(mockEndSession).not.toHaveBeenCalled();
  });
});
