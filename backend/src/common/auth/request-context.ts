import { ClsService } from 'nestjs-cls';

// What we stash in AsyncLocalStorage per request, once the access token is verified.
export interface AuthContext {
  userId: string;
  tenantId: string;
  email: string;
  permissions: string[];
}

export type AppClsStore = { auth?: AuthContext };
export type AppClsService = ClsService<AppClsStore>;
