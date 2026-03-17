import type { RouteObject } from 'react-router-dom';

export const workbenchRoutes = [
  {
    path: '/chat',
    lazy: () => import('./pages/workspace/chat/index'),
  },
  {
    path: '/all',
    lazy: () => import('./pages/workspace/all-page/all-page'),
  },
  {
    path: '/collection',
    lazy: () => import('./pages/workspace/all-collection'),
  },
  {
    path: '/collection/:collectionId',
    lazy: () => import('./pages/workspace/collection/index'),
  },
  {
    path: '/tag',
    lazy: () => import('./pages/workspace/all-tag'),
  },
  {
    path: '/tag/:tagId',
    lazy: () => import('./pages/workspace/tag'),
  },
  {
    path: '/trash',
    lazy: () => import('./pages/workspace/trash-page'),
  },
  {
    path: '/journals',
    lazy: () => import('./pages/workspace/journals'),
  },
  {
    path: '/settings',
    lazy: () => import('./pages/workspace/settings'),
  },
  // EcoDigital internal staff modules (El Consultorio) - sidebar entries (no replacement).
  {
    path: '/intelligence',
    lazy: () => import('./pages/workspace/consultorio/intelligence'),
  },
  {
    path: '/cloud',
    lazy: () => import('./pages/workspace/consultorio/cloud'),
  },
  {
    path: '/tasks',
    lazy: () => import('./pages/workspace/consultorio/tasks'),
  },
  {
    path: '/appointments',
    lazy: () => import('./pages/workspace/consultorio/appointments'),
  },
  {
    path: '/reports',
    lazy: () => import('./pages/workspace/consultorio/reports'),
  },
  {
    path: '/files',
    lazy: () => import('./pages/workspace/consultorio/files'),
  },
  {
    path: '/admin/logs',
    lazy: () => import('./pages/workspace/consultorio/admin-logs'),
  },
  {
    path: '/calendar',
    lazy: () => import('./pages/workspace/consultorio/calendar'),
  },
  {
    path: '/volview',
    lazy: () => import('./pages/workspace/consultorio/volview'),
  },
  {
    path: '/ai-workflow',
    lazy: () => import('./pages/workspace/consultorio/ai-workflow'),
  },
  {
    path: '/stirling-pdf',
    lazy: () => import('./pages/workspace/consultorio/stirling-pdf'),
  },
  // NOTE: Keep all fixed routes above dynamic doc routes.
  {
    path: '/:pageId',
    lazy: () => import('./pages/workspace/detail-page/detail-page'),
  },
  {
    path: '/:pageId/attachments/:attachmentId',
    lazy: () => import('./pages/workspace/attachment/index'),
  },
  {
    path: '*',
    lazy: () => import('./pages/404'),
  },
] satisfies RouteObject[];
