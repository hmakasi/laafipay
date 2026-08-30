import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendWhatsAppTextMessage, sendWhatsAppListMessage, sendWhatsAppReplyButtons, sendWhatsAppDocument } from './whatsapp.js';

describe('interactive WhatsApp senders', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.WHATSAPP_PHONE_NUMBER_ID = 'phone123';
    process.env.WHATSAPP_ACCESS_TOKEN = 'token123';
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function mockFetchOk() {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ messages: [{ id: 'wamid.1' }] }) });
    global.fetch = fetchMock as unknown as typeof fetch;
    return fetchMock;
  }

  it('sends a free-text message (already-normalized "to")', async () => {
    const fetchMock = mockFetchOk();
    await sendWhatsAppTextMessage('22670123456', 'Bonjour');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toMatchObject({ messaging_product: 'whatsapp', to: '22670123456', type: 'text', text: { body: 'Bonjour' } });
  });

  it('sends an interactive list message with sections and rows', async () => {
    const fetchMock = mockFetchOk();
    await sendWhatsAppListMessage('22670123456', {
      bodyText: 'Choisissez un type de congé',
      buttonLabel: 'Voir les options',
      sections: [{ title: 'Types de congé', rows: [{ id: 'conge_paye', title: 'Congé payé légal' }] }],
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.type).toBe('interactive');
    expect(body.interactive.type).toBe('list');
    expect(body.interactive.action.sections[0].rows[0]).toEqual({ id: 'conge_paye', title: 'Congé payé légal' });
  });

  it('sends interactive reply buttons', async () => {
    const fetchMock = mockFetchOk();
    await sendWhatsAppReplyButtons('22670123456', { bodyText: 'Confirmez ?', buttons: [{ id: 'confirm', title: '✅ Confirmer' }, { id: 'cancel', title: '❌ Annuler' }] });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.interactive.type).toBe('button');
    expect(body.interactive.action.buttons).toHaveLength(2);
  });

  it('rejects more than 3 reply buttons', async () => {
    await expect(
      sendWhatsAppReplyButtons('22670123456', { bodyText: 'x', buttons: [{ id: '1', title: 'a' }, { id: '2', title: 'b' }, { id: '3', title: 'c' }, { id: '4', title: 'd' }] })
    ).rejects.toThrow(/3/);
  });

  it('sends a document message by link', async () => {
    const fetchMock = mockFetchOk();
    await sendWhatsAppDocument('22670123456', { link: 'https://blob.example.com/x.pdf', filename: 'Bulletin.pdf' });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.type).toBe('document');
    expect(body.document).toEqual({ link: 'https://blob.example.com/x.pdf', filename: 'Bulletin.pdf' });
  });
});
