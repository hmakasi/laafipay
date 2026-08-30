import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendLeaveDecisionNotification } from './whatsapp.js';

describe('sendLeaveDecisionNotification', () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = 'phone123';
    process.env.WHATSAPP_ACCESS_TOKEN = 'token123';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  it('sends the conge_valide template on approval', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ messages: [{ id: 'wamid.1' }] }) });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await sendLeaveDecisionNotification('70123456', 'BF', 'valide', { startDate: '10/08/2026', endDate: '21/08/2026' });

    expect(result.ok).toBe(true);
    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body as string);
    expect(body.template.name).toBe('conge_valide');
    expect(body.to).toBe('22670123456');
  });

  it('sends the conge_refuse template on refusal', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ messages: [{ id: 'wamid.2' }] }) });
    global.fetch = fetchMock as unknown as typeof fetch;

    await sendLeaveDecisionNotification('70123456', 'BF', 'refuse', { startDate: '10/08/2026', endDate: '21/08/2026' });

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body as string);
    expect(body.template.name).toBe('conge_refuse');
  });

  it('fails gracefully when Meta credentials are missing', async () => {
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
    const result = await sendLeaveDecisionNotification('70123456', 'BF', 'valide', { startDate: '10/08/2026', endDate: '21/08/2026' });
    expect(result.ok).toBe(false);
  });
});
