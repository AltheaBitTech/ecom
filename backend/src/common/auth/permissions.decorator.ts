import { SetMetadata } from '@nestjs/common';

export const REQUIRED_PERMISSIONS_KEY = 'requiredPermissions';
/**
 * Deny-by-default: a route with no @RequirePermissions() is only reachable if @Public().
 * Call with no args to mean "authenticated only, no specific permission required".
 */
export const RequirePermissions = (...permissions: string[]) => SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);
