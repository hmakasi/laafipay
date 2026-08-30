import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const mockUpdate = vi.fn();

vi.mock('../lib/prisma.js', () => ({
  prisma: {
    employee: { update: (...args: unknown[]) => mockUpdate(...args) },
  },
}));

const { default: app } = await import('../app.js');
const { signToken } = await import('../middleware/auth.js');

describe('PATCH /api/auth/whatsapp-pin', () => {
  beforeEach(() => {
    mockUpdate.mockReset();
  });

  it('rejects unauthenticated requests', async () => {
    const res = await request(app).patch('/api/auth/whatsapp-pin').send({ pin: '4821' });
    expect(res.status).toBe(401);
  });

  it('rejects a user with no linked employee record', async () => {
    const token = signToken({ id: 'u1', email: 'a@b.com', role: 'employee', companyId: 'c1' });
    const res = await request(app).patch('/api/auth/whatsapp-pin').set('Authorization', `Bearer ${token}`).send({ pin: '4821' });
    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('rejects a PIN that is not exactly 4 digits', async () => {
    const token = signToken({ id: 'u1', email: 'a@b.com', role: 'employee', companyId: 'c1', employeeId: 'e1' });
    const res = await request(app).patch('/api/auth/whatsapp-pin').set('Authorization', `Bearer ${token}`).send({ pin: '12' });
    expect(res.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('hashes and stores a valid PIN, resetting any prior lockout', async () => {
    mockUpdate.mockResolvedValue({ id: 'e1' });
    const token = signToken({ id: 'u1', email: 'a@b.com', role: 'employee', companyId: 'c1', employeeId: 'e1' });
    const res = await request(app).patch('/api/auth/whatsapp-pin').set('Authorization', `Bearer ${token}`).send({ pin: '4821' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ whatsappPinSet: true });
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    const call = mockUpdate.mock.calls[0][0];
    expect(call.where).toEqual({ id: 'e1' });
    expect(call.data.whatsappPinFailedAttempts).toBe(0);
    expect(call.data.whatsappPinLockedUntil).toBeNull();
    expect(typeof call.data.whatsappPinHash).toBe('string');
    expect(call.data.whatsappPinHash).not.toBe('4821');
  });
});
