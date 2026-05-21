'use client';

export type Role = 'Security' | 'Cleaning' | 'Supervisor' | 'Medical';

export interface PermissionSet {
  canViewDashboard: boolean;
  canViewMap: boolean;
  canUseNavigation: boolean;
  canViewAlerts: boolean;
  canUseChat: boolean;
  canUseEmergencyButton: boolean;
  canViewTasks: boolean;
  canViewMedicalIncidents: boolean;
  canViewAnalytics: boolean;
  canViewTeam: boolean;
  canViewHeatmap: boolean;
  canViewBins: boolean;
  canAcknowledgeAlerts: boolean;
  canCreateIncidents: boolean;
  canManageIncidents: boolean;
  canDispatchIncidents: boolean;
  canResolveIncidents: boolean;
  canManageCameraDensity: boolean;
}

export interface NavItemConfig {
  name: string;
  href: string;
  permission: keyof PermissionSet;
  roles?: Role[];
}

export function normalizeRole(value: string | undefined | null): Role {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (['cleaning', 'cleaner', 'maintenance'].includes(normalized)) return 'Cleaning';
  if (['supervisor', 'admin'].includes(normalized)) return 'Supervisor';
  if (['medical', 'medic', 'doctor'].includes(normalized)) return 'Medical';
  return 'Security';
}

export function permissionsForRole(roleInput: string | undefined | null): PermissionSet {
  const role = normalizeRole(roleInput);
  const supervisor = role === 'Supervisor';
  const security = role === 'Security';
  const cleaning = role === 'Cleaning';
  const medical = role === 'Medical';

  return {
    canViewDashboard: true,
    canViewMap: true,
    canUseNavigation: true,
    canViewAlerts: true,
    canUseChat: !supervisor,
    canUseEmergencyButton: security,
    canViewTasks: !medical,
    canViewMedicalIncidents: medical,
    canViewAnalytics: supervisor,
    canViewTeam: supervisor,
    canViewHeatmap: security || supervisor || medical,
    canViewBins: cleaning || supervisor,
    canAcknowledgeAlerts: security || supervisor,
    canCreateIncidents: supervisor,
    canManageIncidents: supervisor,
    canDispatchIncidents: supervisor,
    canResolveIncidents: supervisor || medical,
    canManageCameraDensity: supervisor,
  };
}

export function mergePermissions(
  role: Role,
  serverPermissions?: Partial<Record<keyof PermissionSet, boolean>>,
): PermissionSet {
  return {
    ...permissionsForRole(role),
    ...(serverPermissions ?? {}),
  };
}

export const NAV_ITEMS: NavItemConfig[] = [
  { name: 'Dashboard', href: '/app-routes/dashboard', permission: 'canViewDashboard' },
  { name: 'Analytics', href: '/app-routes/analytics', permission: 'canViewAnalytics' },
  { name: 'Equipa', href: '/app-routes/team', permission: 'canViewTeam' },
  { name: 'Mapa', href: '/app-routes/map', permission: 'canViewMap' },
  { name: 'Navegação', href: '/app-routes/navigation', permission: 'canUseNavigation' },
  { name: 'Tarefas', href: '/app-routes/tasks', permission: 'canViewTasks', roles: ['Security', 'Cleaning'] },
  { name: 'Incidentes Médicos', href: '/app-routes/medical/incidents', permission: 'canViewMedicalIncidents', roles: ['Medical'] },
  { name: 'Alertas', href: '/app-routes/alerts', permission: 'canViewAlerts' },
  { name: 'Chat', href: '/app-routes/chat', permission: 'canUseChat' },
  { name: 'Emergência', href: '/app-routes/emergency', permission: 'canUseEmergencyButton' },
  { name: 'Perfil', href: '/app-routes/profile', permission: 'canViewDashboard' },
];

export function defaultRouteForRole(roleInput: string | undefined | null): string {
  const role = normalizeRole(roleInput);
  if (role === 'Supervisor') return '/app-routes/dashboard';
  if (role === 'Medical') return '/app-routes/medical/incidents';
  return '/app-routes/map';
}

export function canAccessRoute(
  pathname: string,
  roleInput: string | undefined | null,
  permissionsInput?: PermissionSet,
): boolean {
  if (pathname === '/app-routes/profile') return true;
  const permissions = permissionsInput ?? permissionsForRole(roleInput);
  const route = NAV_ITEMS
    .filter((item) => item.href !== '/app-routes/profile')
    .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));

  if (!route) return true;
  if (route.roles && !route.roles.includes(normalizeRole(roleInput))) return false;
  return permissions[route.permission];
}
