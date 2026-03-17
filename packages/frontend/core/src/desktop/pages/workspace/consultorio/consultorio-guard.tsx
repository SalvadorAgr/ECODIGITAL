import { AuthService } from '@affine/core/modules/cloud';
import { WorkspacePermissionService } from '@affine/core/modules/permissions';
import { useLiveData, useService } from '@toeverything/infra';
import { type PropsWithChildren, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { PageNotFound } from '../../404';

export type ConsultorioRole = 'Admin' | 'Invitado';

export function useConsultorioRole(): ConsultorioRole {
  const permission = useService(WorkspacePermissionService).permission;
  const isOwnerOrAdmin = useLiveData(permission.isOwnerOrAdmin$);
  return isOwnerOrAdmin ? 'Admin' : 'Invitado';
}

/**
 * Route guard for internal staff-only pages.
 * - Requires an authenticated session (redirects to /sign-in preserving return URL).
 * - Optionally requires Consultorio "Admin" role (derived from workspace owner/admin).
 */
export function ConsultorioGuard({
  children,
  requireAdmin = false,
}: PropsWithChildren<{
  requireAdmin?: boolean;
}>) {
  const auth = useService(AuthService);
  const sessionStatus = useLiveData(auth.session.status$);
  const role = useConsultorioRole();

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      const redirectUri = location.pathname + location.search + location.hash;
      // Desktop router registers '/sign-In' (and legacy '/signIn').
      navigate(`/sign-In?redirect_uri=${encodeURIComponent(redirectUri)}`, {
        replace: true,
      });
    }
  }, [
    location.hash,
    location.pathname,
    location.search,
    navigate,
    sessionStatus,
  ]);

  // While redirecting, render nothing to avoid flicker.
  if (sessionStatus === 'unauthenticated') {
    return null;
  }

  if (requireAdmin && role !== 'Admin') {
    return <PageNotFound noPermission />;
  }

  return <>{children}</>;
}
