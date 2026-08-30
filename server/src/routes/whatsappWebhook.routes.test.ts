import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';

const mockResolveEmployee = vi.fn();
const mockGetActiveSession = vi.fn();
const mockSendText = vi.fn().mockResolvedValue({ ok: true });
const mockHandlePayslipFlowMessage = vi.fn().mockResolvedValue(undefined);
const mockStartLeaveFlow = vi.fn().mockResolvedValue(undefined);
const mockHandleLeaveFlowMessage = vi.fn().mockResolvedValue(undefined);

vi.mock('../lib/whatsappSession.js', () => ({
  resolveEmployeeByWhatsAppPhone: (...args: unknown[]) => mockResolveEmployee(...args),
  getActiveSession: (...args: unknown[]) => mockGetActiveSession(...args),
}));
vi.mock('../lib/whatsapp.js', () => ({ sendWhatsAppTextMessage: (...args: unknown[]) => mockSendText(...args) }));
vi.mock('../lib/whatsappFlows/payslip.js', () => ({ PAYSLIP_FLOW: 'payslip_delivery', handlePayslipFlowMessage: (...a: unknown[]) => mockHandlePayslipFlowMessage(...a) }));
vi.mock('../lib/whatsappFlows/leave.js', () => ({ LEAVE_FLOW: 'leave_request', startLeaveFlow: (...a: unknown[]) => mockStartLeaveFlow(...a), handleLeaveFlowMessage: (...a: unknown[]) => mockHandleLeaveFlowMessage(...a) }));
vi.mock('../lib/prisma.js', () => ({ prisma: { payslip: { findFirst: vi.fn().mockResolvedValue(null) } } }));

const { extractIncomingMessage, verifyMetaSignature } = await import('./whatsappWebhook.routes.js');
const { default: app } = await import('../app.js');

describe('extractIncomingMessage', () => {
  it('extracts a plain text message', () => {
    const body = { entry: [{ changes: [{ value: { messages: [{ from: '22670123456', type: 'text', text: { body: 'salut' } }] } }] }] };
    expect(extractIncomingMessage(body)).toEqual({ from: '22670123456', kind: 'text', text: 'salut' });
  });

  it('extracts a list reply', () => {
    const body = { entry: [{ changes: [{ value: { messages: [{ from: '22670123456', type: 'interactive', interactive: { type: 'list_reply', list_reply: { id: 'conge_paye', title: 'Congé payé' } } }] } }] }] };
    expect(extractIncomingMessage(body)).toEqual({ from: '22670123456', kind: 'list_reply', id: 'conge_paye' });
  });

  it('extracts a button reply', () => {
    const body = { entry: [{ changes: [{ value: { messages: [{ from: '22670123456', type: 'interactive', interactive: { type: 'button_reply', button_reply: { id: 'confirm', title: '✅ Confirmer' } } }] } }] }] };
    expect(extractIncomingMessage(body)).toEqual({ from: '22670123456', kind: 'button_reply', id: 'confirm' });
  });

  it('returns null when there is no message (e.g. a status update webhook)', () => {
    const body = { entry: [{ changes: [{ value: { statuses: [{ status: 'delivered' }] } }] }] };
    expect(extractIncomingMessage(body)).toBeNull();
  });
});

describe('verifyMetaSignature', () => {
  const appSecret = 'test-secret';
  const rawBody = Buffer.from(JSON.stringify({ hello: 'world' }));

  it('accepts a correctly signed body', () => {
    const digest = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
    expect(verifyMetaSignature(rawBody, `sha256=${digest}`, appSecret)).toBe(true);
  });

  it('rejects a missing signature header', () => {
    expect(verifyMetaSignature(rawBody, undefined, appSecret)).toBe(false);
  });

  it('rejects a wrong signature', () => {
    expect(verifyMetaSignature(rawBody, 'sha256=deadbeef', appSecret)).toBe(false);
  });
});

describe('GET /api/whatsapp/webhook', () => {
  it('echoes hub.challenge when the verify token matches', async () => {
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'verify-me';
    const res = await request(app).get('/api/whatsapp/webhook').query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'verify-me', 'hub.challenge': '12345' });
    expect(res.status).toBe(200);
    expect(res.text).toBe('12345');
  });

  it('rejects a wrong verify token', async () => {
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'verify-me';
    const res = await request(app).get('/api/whatsapp/webhook').query({ 'hub.mode': 'subscribe', 'hub.verify_token': 'wrong', 'hub.challenge': '12345' });
    expect(res.status).toBe(403);
  });
});

describe('POST /api/whatsapp/webhook', () => {
  beforeEach(() => {
    mockResolveEmployee.mockReset();
    mockGetActiveSession.mockReset();
    mockSendText.mockReset().mockResolvedValue({ ok: true });
    process.env.WHATSAPP_APP_SECRET = 'test-secret';
  });

  function signedRequest(body: object) {
    const raw = JSON.stringify(body);
    const digest = crypto.createHmac('sha256', 'test-secret').update(raw).digest('hex');
    return request(app).post('/api/whatsapp/webhook').set('Content-Type', 'application/json').set('X-Hub-Signature-256', `sha256=${digest}`).send(raw);
  }

  it('rejects a request with an invalid signature', async () => {
    const res = await request(app).post('/api/whatsapp/webhook').set('X-Hub-Signature-256', 'sha256=bad').send({ entry: [] });
    expect(res.status).toBe(403);
  });

  it('acknowledges with 200 and does nothing when the sender is not a known employee', async () => {
    mockResolveEmployee.mockResolvedValue(null);
    const body = { entry: [{ changes: [{ value: { messages: [{ from: '22600000000', type: 'text', text: { body: 'hi' } }] } }] }] };
    const res = await signedRequest(body);
    expect(res.status).toBe(200);
    expect(mockSendText).not.toHaveBeenCalled();
  });

  it('starts the leave flow on the "Demander un congé" trigger phrase', async () => {
    mockResolveEmployee.mockResolvedValue({ id: 'e1', phone: '70123456', company: { countryCode: 'BF' } });
    mockGetActiveSession.mockResolvedValue(null);
    const body = { entry: [{ changes: [{ value: { messages: [{ from: '22670123456', type: 'text', text: { body: 'Demander un congé' } }] } }] }] };
    const res = await signedRequest(body);
    expect(res.status).toBe(200);
    expect(mockStartLeaveFlow).toHaveBeenCalledWith({ id: 'e1', phone: '70123456', company: { countryCode: 'BF' } }, '22670123456');
  });

  it('dispatches to the leave flow handler when a leave_request session is active', async () => {
    mockResolveEmployee.mockResolvedValue({ id: 'e1', phone: '70123456', company: { countryCode: 'BF' } });
    mockGetActiveSession.mockResolvedValue({ id: 's1', phone: '22670123456', flow: 'leave_request', step: 'choosing_type', data: {} });
    const body = { entry: [{ changes: [{ value: { messages: [{ from: '22670123456', type: 'interactive', interactive: { type: 'list_reply', list_reply: { id: 'conge_paye', title: 'Congé payé légal' } } }] } }] }] };
    const res = await signedRequest(body);
    expect(res.status).toBe(200);
    expect(mockHandleLeaveFlowMessage).toHaveBeenCalledTimes(1);
  });
});
