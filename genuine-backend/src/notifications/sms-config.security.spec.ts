import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../common/logger/logger.service';
import { PERMISSION_KEY } from '../common/decorators';
import { PrismaService } from '../database/prisma.service';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

describe('SMS provider configuration security', () => {
  const previousEncryptionKey = process.env.NOTIFICATION_CONFIG_ENCRYPTION_KEY;
  const testEncryptionKey = 'test-only-not-a-real-provider-key-32chars';

  afterAll(() => {
    if (previousEncryptionKey === undefined) delete process.env.NOTIFICATION_CONFIG_ENCRYPTION_KEY;
    else process.env.NOTIFICATION_CONFIG_ENCRYPTION_KEY = previousEncryptionKey;
  });

  it('encrypts API credentials at rest and excludes them from the audit record', async () => {
    process.env.NOTIFICATION_CONFIG_ENCRYPTION_KEY = testEncryptionKey;
    const tx = {
      sMSConfig: { findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((work: (tx: any) => unknown) => work(tx)) };
    const service = new NotificationsService(prisma as unknown as PrismaService, {} as LoggerService);
    const apiKey = 'test-only-fake-sms-api-key';

    await expect(service.setSmsConfig('business-a', 'user-a', {
      provider: 'SASISMS',
      fromNumber: '',
      apiKey,
    })).resolves.toEqual({ message: 'SMS configuration saved' });

    const saved = tx.sMSConfig.upsert.mock.calls[0][0];
    expect(saved.where).toEqual({ businessId: 'business-a' });
    expect(saved.create.config).toMatch(/^v1\./);
    expect(saved.create.config).not.toContain(apiKey);
    expect(JSON.stringify(tx.auditLog.create.mock.calls[0][0])).not.toContain(apiKey);
    expect(tx.auditLog.create.mock.calls[0][0].data.businessId).toBe('business-a');
  });

  it('requires credentials again before replacing an existing provider configuration', async () => {
    const prisma = { $transaction: jest.fn() };
    const service = new NotificationsService(prisma as unknown as PrismaService, {} as LoggerService);

    await expect(service.setSmsConfig('business-a', 'user-a', {
      provider: 'SASISMS',
      fromNumber: '',
    })).rejects.toThrow('This SMS provider requires an API key');
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('returns and audits the provider message ID after an accepted test send', async () => {
    const prisma = { auditLog: { create: jest.fn() }, notification: { create: jest.fn() } };
    const service = new NotificationsService(prisma as unknown as PrismaService, {} as LoggerService);
    jest.spyOn(service as any, 'sendSms').mockResolvedValue('fake-provider-message-id');

    await expect(service.sendTestSms('business-a', 'user-a', { to: '0650745642' })).resolves.toEqual({
      message: 'Test SMS accepted and recorded in the delivery log',
      providerId: 'fake-provider-message-id',
    });
    expect(JSON.parse(prisma.auditLog.create.mock.calls[0][0].data.afterData)).toEqual({ providerId: 'fake-provider-message-id' });
    expect(prisma.notification.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        businessId: 'business-a',
        type: 'SMS',
        eventType: 'SMS_TEST',
        status: 'SENT',
        recipients: { create: [expect.objectContaining({ phoneNumber: '0650745642', providerId: 'fake-provider-message-id', status: 'SENT' })] },
        logs: { create: [expect.objectContaining({ recipient: '0650745642', status: 'SENT', message: expect.stringContaining('fake-provider-message-id') })] },
      }),
    }));
  });

  it('records a rejected test SMS with a safe failure reason in the delivery log', async () => {
    const prisma = { auditLog: { create: jest.fn() }, notification: { create: jest.fn() } };
    const service = new NotificationsService(prisma as unknown as PrismaService, {} as LoggerService);
    jest.spyOn(service as any, 'sendSms').mockRejectedValue(new Error('provider rejected fake credential'));

    await expect(service.sendTestSms('business-a', 'user-a', { to: '0650745642' })).rejects.toThrow('provider rejected fake credential');
    expect(prisma.notification.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 'SMS', eventType: 'SMS_TEST', status: 'FAILED',
        recipients: { create: [expect.objectContaining({ phoneNumber: '0650745642', status: 'FAILED', failureReason: 'provider rejected fake credential' })] },
        logs: { create: [expect.objectContaining({ recipient: '0650745642', status: 'FAILED', message: 'provider rejected fake credential' })] },
      }),
    }));
  });

  it('returns only provider status metadata for the requested business', async () => {
    const apiKey = 'must-never-be-returned';
    const prisma = {
      sMSConfig: {
        findUnique: jest.fn().mockResolvedValue({
          businessId: 'business-a',
          provider: 'SASISMS',
          fromNumber: '',
          config: `v1.encrypted.${apiKey}`,
        }),
      },
    };
    const service = new NotificationsService(prisma as unknown as PrismaService, {} as LoggerService);

    await expect(service.getSmsConfig('business-a')).resolves.toEqual({
      provider: 'SASISMS',
      fromNumber: '',
      configured: true,
    });
    expect(prisma.sMSConfig.findUnique).toHaveBeenCalledWith({ where: { businessId: 'business-a' } });
    expect(JSON.stringify(await service.getSmsConfig('business-a'))).not.toContain(apiKey);
  });

  it('resolves delivery credentials only for the notification business', async () => {
    const prisma = { sMSConfig: { findUnique: jest.fn().mockResolvedValue(null) } };
    const service = new NotificationsService(prisma as unknown as PrismaService, {} as LoggerService);

    await expect((service as any).sendSms('business-a', '+255700000000', 'safe test')).rejects.toThrow(
      'Configure an SMS provider before sending SMS',
    );
    expect(prisma.sMSConfig.findUnique).toHaveBeenCalledWith({ where: { businessId: 'business-a' } });
  });

  it('reuses the same SasiSMS idempotency key when a delivery is retried after an ambiguous timeout', async () => {
    process.env.NOTIFICATION_CONFIG_ENCRYPTION_KEY = testEncryptionKey;
    const apiKey = 'test-only-fake-sms-api-key';
    const prisma = { sMSConfig: { findUnique: jest.fn() } };
    const service = new NotificationsService(prisma as unknown as PrismaService, {} as LoggerService);
    const config = (service as any).encrypt({ apiKey });
    prisma.sMSConfig.findUnique.mockResolvedValue({ provider: 'SASISMS', fromNumber: '', config });
    const fetchSpy = jest.spyOn(global, 'fetch')
      .mockRejectedValueOnce(Object.assign(new Error('simulated timeout'), { name: 'TimeoutError' }))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { id: 'fake-provider-message' } }),
      } as Response);

    try {
      await expect((service as any).sendSms('business-a', '255700000000', 'safe test', 'notification-1:recipient-1'))
        .rejects.toThrow('request timed out');
      await expect((service as any).sendSms('business-a', '255700000000', 'safe test', 'notification-1:recipient-1'))
        .resolves.toBe('fake-provider-message');

      expect(fetchSpy).toHaveBeenCalledTimes(2);
      expect(fetchSpy.mock.calls.map(([url, init]) => ({ url, key: new Headers(init?.headers).get('Idempotency-Key') }))).toEqual([
        { url: 'https://sms.sasidigital.co.tz/v1/messages', key: 'notification-1:recipient-1' },
        { url: 'https://sms.sasidigital.co.tz/v1/messages', key: 'notification-1:recipient-1' },
      ]);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it.each([
    {
      provider: 'TWILIO', fromNumber: '+255700000000', secrets: { accountSid: 'AC00000000000000000000000000000000', apiKey: 'fake-twilio-secret' },
      response: { message: 'provider echoed fake-twilio-secret' },
    },
    {
      provider: 'AFRICAS_TALKING', fromNumber: '', secrets: { username: 'test-user', apiKey: 'fake-africa-secret' },
      response: { SMSMessageData: { Recipients: [{ status: 'provider echoed fake-africa-secret', statusCode: 401 }] } },
    },
    {
      provider: 'SASISMS', fromNumber: '', secrets: { apiKey: 'fake-sasi-secret' },
      response: { success: false, error: { code: 'send_failed', message: 'provider echoed fake-sasi-secret' } },
    },
    {
      provider: 'DARSMS', fromNumber: '', secrets: { apiKey: 'fake-darsms-secret' },
      response: { success: false, message: 'provider echoed fake-darsms-secret' },
    },
    {
      provider: 'EHUB', fromNumber: '11111111-1111-4111-8111-111111111111', secrets: { apiKey: 'fake-ehub-key', apiSecret: 'fake-ehub-secret' },
      response: { success: false, message: 'provider echoed fake-ehub-key and fake-ehub-secret' },
    },
    {
      provider: 'SAKURA', fromNumber: '', secrets: { apiKey: 'fake-sakura-secret' },
      response: { status: 'failed', message: 'provider echoed fake-sakura-secret' },
    },
  ])('redacts provider credentials from $provider error messages', async ({ provider, fromNumber, secrets, response }) => {
    process.env.NOTIFICATION_CONFIG_ENCRYPTION_KEY = testEncryptionKey;
    const prisma = { sMSConfig: { findUnique: jest.fn() } };
    const service = new NotificationsService(prisma as unknown as PrismaService, {} as LoggerService);
    prisma.sMSConfig.findUnique.mockResolvedValue({
      provider,
      fromNumber,
      config: (service as any).encrypt(secrets),
    });
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => response,
    } as Response);

    try {
      let failure: Error | undefined;
      try {
        await (service as any).sendSms('business-a', '+255700000000', 'safe test');
      } catch (error) {
        failure = error as Error;
      }
      expect(failure).toBeDefined();
      for (const value of Object.values(secrets)) expect(failure?.message).not.toContain(value);
      expect(failure?.message).toContain('[redacted credential]');
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('caps notification delivery retries before another provider call', async () => {
    const prisma = {
      notification: {
        findFirst: jest.fn().mockResolvedValue({ type: 'SMS' }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      sMSConfig: { findUnique: jest.fn().mockResolvedValue({ businessId: 'business-a' }) },
    };
    const service = new NotificationsService(prisma as unknown as PrismaService, {} as LoggerService);

    await expect((service as any).deliver('notification-a', 'business-a')).resolves.toBe(false);

    expect(prisma.notification.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'notification-a', businessId: 'business-a', attemptCount: { lt: 5 } }),
    }));
  });

  it('allows settings.view for status reads but requires settings.edit for saves and real test sends', () => {
    expect(Reflect.getMetadata(PERMISSION_KEY, NotificationsController.prototype.getSmsConfig)).toEqual(['settings.view', 'settings.edit']);
    expect(Reflect.getMetadata(PERMISSION_KEY, NotificationsController.prototype.setSmsConfig)).toEqual(['settings.edit']);
    expect(Reflect.getMetadata(PERMISSION_KEY, NotificationsController.prototype.testSmsConfig)).toEqual(['settings.edit']);
  });
});
