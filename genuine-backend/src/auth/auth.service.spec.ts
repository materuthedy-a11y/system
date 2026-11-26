import { AuthService } from './auth.service';

describe('AuthService registration', () => {
  it('uses a bounded transaction timeout suitable for provisioning a new workspace', async () => {
    const transactionResult = { accessToken: 'access', refreshToken: 'refresh' };
    const tx = {
      business: { create: jest.fn().mockResolvedValue({ id: 'business-1' }) },
      user: {
        create: jest.fn().mockResolvedValue({
          id: 'user-1',
          email: 'owner@example.test',
          firstName: 'Test',
          lastName: 'Owner',
        }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          userRoles: [{ role: { name: 'Owner', permissions: [] } }],
          permissions: [],
        }),
      },
      userRole: { create: jest.fn().mockResolvedValue({}) },
      userSession: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(async (callback: (client: unknown) => unknown) => callback(tx)),
    };
    const service = new AuthService(
      prisma as any,
      {} as any,
      { get: jest.fn().mockReturnValue(undefined) } as any,
      { log: jest.fn() } as any,
      {} as any,
    );
    jest
      .spyOn(service as any, '_createDefaultRolesAndPermissions')
      .mockResolvedValue([{ id: 'owner-role', name: 'Owner' }]);
    jest.spyOn(service as any, '_generateTokens').mockResolvedValue(transactionResult);

    await service.register(
      {
        email: 'owner@example.test',
        password: 'StrongPass1!',
        firstName: 'Test',
        lastName: 'Owner',
        businessName: 'Test Workspace',
        businessType: 'Retail',
      } as any,
      '127.0.0.1',
    );

    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      maxWait: 10_000,
      timeout: 30_000,
    });
    expect(tx.business.create).toHaveBeenCalledTimes(1);
    expect(tx.user.create).toHaveBeenCalledTimes(1);
    expect(tx.userSession.create).toHaveBeenCalledTimes(1);
  });

  it('creates permissions with their final display names to avoid per-permission repair writes', async () => {
    const createdPermissions: Array<Record<string, any>> = [];
    const tx = {
      role: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(async ({ data }: any) => ({ ...data, permissions: [] })),
        update: jest.fn(),
      },
      permission: {
        findMany: jest.fn().mockImplementation(async () => createdPermissions),
        createMany: jest.fn(async ({ data }: any) => {
          createdPermissions.push(
            ...data.map((permission: any, index: number) => ({
              ...permission,
              id: `permission-${index}`,
            })),
          );
          return { count: data.length };
        }),
        update: jest.fn(),
      },
      user: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
      userSession: { deleteMany: jest.fn() },
    };
    const service = new AuthService(
      {} as any,
      {} as any,
      {} as any,
      { log: jest.fn() } as any,
      {} as any,
    );

    const roles = await (service as any)._createDefaultRolesAndPermissions('business-1', tx);

    expect(roles.map(({ name }: { name: string }) => name)).toContain('Owner');
    expect(createdPermissions.length).toBeGreaterThan(0);
    expect(createdPermissions[0].name).toBe('Products · View');
    expect(
      createdPermissions.every(
        ({ name, category, action }) =>
          name === `${category} · ${action[0].toUpperCase()}${action.slice(1)}`,
      ),
    ).toBe(true);
    expect(tx.permission.update).not.toHaveBeenCalled();
  });
});
