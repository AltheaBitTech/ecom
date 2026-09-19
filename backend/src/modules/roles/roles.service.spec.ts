import { ConflictException, ForbiddenException } from '@nestjs/common';
import { RolesService } from './roles.service';
import { PERMISSIONS } from './permissions.catalog';

// Minimal fake standing in for PrismaService.forTenant(tenantId) — enough surface
// for the RBAC guard logic under test, not a full DB.
function fakePrisma(existingRoleNames: string[] = []) {
  return {
    forTenant: () => ({
      role: {
        findFirst: async ({ where }: { where: { name: string } }) =>
          existingRoleNames.includes(where.name) ? { id: 'r1', name: where.name } : null,
        create: async ({ data }: { data: unknown }) => ({ id: 'new-role', ...(data as object) }),
      },
    }),
  } as never;
}

// Fake for a single, known role by id — used by update/clone/archive tests.
function fakePrismaWithRole(role: {
  id: string;
  name: string;
  permissions: string[];
  isSystem?: boolean;
  users?: { user: { email: string } }[];
}) {
  const state = { ...role, isSystem: role.isSystem ?? false, users: role.users ?? [] };
  return {
    forTenant: () => ({
      role: {
        findFirst: async ({ where }: { where: { id?: string; name?: string } }) =>
          (where.id && where.id === state.id) || (where.name && where.name === state.name) ? { ...state } : null,
        update: async ({ data }: { data: Record<string, unknown> }) => Object.assign(state, data),
        create: async ({ data }: { data: unknown }) => ({ id: 'cloned-role', ...(data as object) }),
      },
    }),
  } as never;
}

describe('RolesService.create — custom roles cannot exceed the creator\'s own permissions', () => {
  it('rejects a permission the creator does not hold', async () => {
    const service = new RolesService(fakePrisma());
    await expect(
      service.create('t1', [PERMISSIONS.USERS_VIEW], {
        name: 'Limited Manager',
        permissions: [PERMISSIONS.USERS_VIEW, PERMISSIONS.ROLES_MANAGE],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects an unknown permission string', async () => {
    const service = new RolesService(fakePrisma());
    await expect(
      service.create('t1', [PERMISSIONS.USERS_VIEW], { name: 'Bad Role', permissions: ['not.a.real.permission'] }),
    ).rejects.toThrow(/Unknown permission/);
  });

  it('allows a role scoped to a subset of the creator\'s permissions', async () => {
    const service = new RolesService(fakePrisma());
    const role = await service.create('t1', [PERMISSIONS.USERS_VIEW, PERMISSIONS.ROLES_MANAGE], {
      name: 'Read Only',
      permissions: [PERMISSIONS.USERS_VIEW],
    });
    expect(role.permissions).toEqual([PERMISSIONS.USERS_VIEW]);
  });
});

describe('RolesService.update', () => {
  it('rejects granting a permission the actor does not hold', async () => {
    const service = new RolesService(fakePrismaWithRole({ id: 'r1', name: 'Limited Manager', permissions: [PERMISSIONS.USERS_VIEW] }));
    await expect(
      service.update('t1', 'r1', [PERMISSIONS.USERS_VIEW], { permissions: [PERMISSIONS.USERS_VIEW, PERMISSIONS.ROLES_MANAGE] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('RolesService.clone', () => {
  it('rejects cloning a role whose permissions the actor does not fully hold', async () => {
    const service = new RolesService(
      fakePrismaWithRole({ id: 'r1', name: 'Tenant Owner', permissions: [PERMISSIONS.USERS_VIEW, PERMISSIONS.ROLES_MANAGE], isSystem: true }),
    );
    await expect(service.clone('t1', 'r1', [PERMISSIONS.USERS_VIEW], { name: 'Copy of Owner' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});

describe('RolesService.archive', () => {
  it('blocks archiving a role with assigned users', async () => {
    const service = new RolesService(
      fakePrismaWithRole({
        id: 'r1',
        name: 'Warehouse Staff',
        permissions: [PERMISSIONS.USERS_VIEW],
        users: [{ user: { email: 'a@b.com' } }],
      }),
    );
    await expect(service.archive('t1', 'r1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('archives a role with no assigned users', async () => {
    const service = new RolesService(fakePrismaWithRole({ id: 'r1', name: 'Warehouse Staff', permissions: [PERMISSIONS.USERS_VIEW] }));
    await service.archive('t1', 'r1');
  });
});

describe('RolesService.list', () => {
  it('excludes archived roles by default', async () => {
    const seen: unknown[] = [];
    const service = new RolesService({
      forTenant: () => ({
        role: {
          findMany: async (args: unknown) => {
            seen.push(args);
            return [];
          },
        },
      }),
    } as never);
    await service.list('t1');
    expect(seen[0]).toMatchObject({ where: { archivedAt: null } });
  });
});
