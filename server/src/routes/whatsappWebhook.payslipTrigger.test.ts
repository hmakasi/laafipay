import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';

const mockResolveEmployee = vi.fn();
const mockGetActiveSession = vi.fn();
const mockSendText = vi.fn().mockResolvedValue({ ok: true });
const mockFindFirstPayslip = vi.fn();

vi.mock('../lib/whatsappSession.js', () => ({
  resolveEmployeeByWhatsAppPhone: (...args: unknown[]) => mockResolveEmployee(...args),
  getActiveSession: (...args: unknown[]) => mockGetActiveSession(...args),
  startSession: vi.fn().mockResolvedValue({ id: 's1', phone: '22670123456', flow: 'payslip_delivery', step: 'awaiting_pin', data: {} }),
}));
vi.mock('../lib/whatsapp.js', () => ({ sendWhatsAppTextMessage: (...args: unknown[]) => mockSendText(...args) }));
vi.mock('../lib/whatsappFlows/payslip.js', () => ({ PAYSLIP_FLOW: 'payslip_delivery', handlePayslipFlowMessage: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../lib/prisma.js', () => ({ prisma: { payslip: { findFirst: (...args: unknown[]) => mockFindFirstPayslip(...args) } } }));

const { default: app } = await import('../app.js');

describe('POST /api/whatsapp/webhook — payslip trigger', () => {
  beforeEach(() => {
    mockResolveEmployee.mockReset();
    mockGetActiveSession.mockReset();
    mockFindFirstPayslip.mockReset();
    process.env.WHATSAPP_APP_SECRET = 'test-secret';
  });

  function signedRequest(body: object) {
    const raw = JSON.stringify(body);
    const digest = crypto.createHmac('sha256', 'test-secret').update(raw).digest('hex');
    return request(app).post('/api/whatsapp/webhook').set('Content-Type', 'application/json').set('X-Hub-Signature-256', `sha256=${digest}`).send(raw);
  }

  it('starts the payslip flow when a known employee has no session and a sent payslip exists', async () => {
    mockResolveEmployee.mockResolvedValue({ id: 'e1', phone: '70123456', company: { countryCode: 'BF' } });
    mockGetActiveSession.mockResolvedValue(null);
    mockFindFirstPayslip.mockResolvedValue({ id: 'p1' });
    const body = { entry: [{ changes: [{ value: { messages: [{ from: '22670123456', type: 'text', text: { body: 'hi' } }] } }] }] };
    const res = await signedRequest(body);
    expect(res.status).toBe(200);
  });

  it('tells the employee no payslip is available when none has been sent yet', async () => {
    mockResolveEmployee.mockResolvedValue({ id: 'e1', phone: '70123456', company: { countryCode: 'BF' } });
    mockGetActiveSession.mockResolvedValue(null);
    mockFindFirstPayslip.mockResolvedValue(null);
    const body = { entry: [{ changes: [{ value: { messages: [{ from: '22670123456', type: 'text', text: { body: 'hi' } }] } }] }] };
    const res = await signedRequest(body);
    expect(res.status).toBe(200);
    expect(mockSendText).toHaveBeenCalledWith('22670123456', expect.stringContaining('Aucun bulletin'));
  });
});
