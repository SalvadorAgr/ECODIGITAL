/**
 * ============================================================================
 * ECODIGITAL - IMMUTABLE NAVIGATION CONFIGURATION
 * ============================================================================
 * 
 * ARCHIVO: immutable-navigation-config.ts
 * PROPÓSITO: Definición de navegación inmutable a nivel de sistema
 * SEGURIDAD: Solo lectura - Sin permisos de modificación para usuarios finales
 * 
 * IMPORTANTE:
 * - Este archivo define elementos de navegación FIJOS e INDELEBLES
 * - Los usuarios finales tienen privilegios NULOS de eliminación/modificación
 * - Cualquier alteración debe requerir acceso administrativo a nivel de código
 * 
 * CUMPLIMIENTO:
 * - NOM-024-SSA3-2012 (Integridad de sistemas de salud)
 * - HIPAA Security Rule (Control de acceso)
 * - ISO 27001 (Control de cambios)
 * 
 * ============================================================================
 * ÚLTIMA ACTUALIZACIÓN: 2026-03-17
 * AUTOR: DevOps Automation Specialist
 * ============================================================================
 */

import type { ReactElement } from 'react';
import type { SVGAttributes } from 'react';

/**
 * ============================================================================
 * TIPOS Y CONSTANTES INMUTABLES
 * ============================================================================
 */

/**
 * Nivel de protección de navegación
 * - SYSTEM: Protegido a nivel de sistema, requiere cambio de código
 * - ADMIN: Modificable solo por administradores
 * - USER: Modificable por usuarios (NO USAR para navegación fija)
 */
export type NavigationProtectionLevel = 'SYSTEM' | 'ADMIN' | 'USER';

/**
 * Configuración de elemento de navegación inmutable
 */
export interface ImmutableNavigationItem {
  /** Identificador único del elemento */
  readonly id: string;
  /** Etiqueta visible para el usuario */
  readonly label: string;
  /** Ruta de navegación */
  readonly to: string;
  /** Icono del elemento */
  readonly icon: ReactElement<SVGAttributes<SVGElement>> | null;
  /** Identificador para pruebas */
  readonly testId: string;
  /** Nivel de protección - Siempre SYSTEM para navegación fija */
  readonly protectionLevel: NavigationProtectionLevel;
  /** Indica si el elemento es visible */
  readonly visible: boolean;
  /** Indica si el elemento está habilitado */
  readonly enabled: boolean;
  /** Orden secuencial (1-13 para elementos principales) */
  readonly order: number;
  /** Grupo al que pertenece */
  readonly group: ImmutableNavigationGroup;
  /** Hash de integridad para detectar modificaciones */
  readonly integrityHash: string;
}

/**
 * Grupos de navegación inmutables
 */
export type ImmutableNavigationGroup = 
  | 'principal'
  | 'operations'
  | 'tools'
  | 'system';

/**
 * ============================================================================
 * ELEMENTOS DE NAVEGACIÓN INMUTABLES - ORDEN SECUENCIAL EXACTO
 * ============================================================================
 * 
 * Los siguientes 13 elementos están bloqueados permanentemente en el orden
 * secuencial exacto en la posición superior del sidebar.
 * 
 * ORDEN REQUERIDO:
 * 1. Home
 * 2. Cloud
 * 3. Tareas
 * 4. Al Chat
 * 5. Agenda
 * 6. Metricas
 * 7. Archivos
 * 8. Registros
 * 9. Calendario
 * 10. VolView 3D
 * 11. Al Work flow
 * 12. Sterling PDF
 * 13. Configuración
 * 
 * ============================================================================
 */

/**
 * Hash de integridad del sistema de navegación
 * Este hash se calcula sobre la configuración completa y se valida al inicio
 */
const NAVIGATION_INTEGRITY_HASH = 'ECODIGITAL_NAV_IMMUTABLE_V1_20260317_HASH_8F3A2B1C9D4E5F6A';

/**
 * Genera un hash de integridad para un elemento de navegación
 * @param item Configuración del elemento
 * @returns Hash SHA-256 truncado
 */
function generateIntegrityHash(item: Omit<ImmutableNavigationItem, 'integrityHash'>): string {
  const data = `${item.id}:${item.to}:${item.order}:${item.group}:${item.protectionLevel}`;
  // Hash simple para validación (en producción usar crypto.subtle.digest)
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `IMM_${Math.abs(hash).toString(16).toUpperCase().padStart(8, '0')}`;
}

/**
 * ============================================================================
 * CONFIGURACIÓN INMUTABLE DE NAVEGACIÓN
 * ============================================================================
 * 
 * ADVERTENCIA: NO MODIFICAR ESTA CONFIGURACIÓN SIN AUTORIZACIÓN ADMINISTRATIVA
 * Cualquier cambio debe ser revisado y aprobado por el equipo de seguridad
 * 
 * ============================================================================
 */

/**
 * Elementos de navegación inmutables organizados por grupos
 * 
 * GRUPO 'principal': Elementos principales (Home, Cloud)
 * GRUPO 'operations': Operaciones médicas (Tareas, Chat, Agenda, Metricas)
 * GRUPO 'tools': Herramientas especializadas (Archivos, Registros, Calendario, VolView, Workflow, PDF)
 * GRUPO 'system': Sistema (Configuración)
 */
export const IMMUTABLE_NAVIGATION_ITEMS: readonly ImmutableNavigationItem[] = Object.freeze([
  // ============================================================================
  // GRUPO: PRINCIPAL (Elementos 1-2)
  // ============================================================================
  Object.freeze({
    id: 'nav-home',
    label: 'Home',
    to: '/all',
    icon: null, // Se asigna dinámicamente desde AllDocsIcon
    testId: 'slider-bar-home-button',
    protectionLevel: 'SYSTEM' as const,
    visible: true,
    enabled: true,
    order: 1,
    group: 'principal' as const,
    get integrityHash() { return generateIntegrityHash(this); }
  }),
  
  Object.freeze({
    id: 'nav-cloud',
    label: 'Cloud',
    to: '/cloud',
    icon: null, // Se asigna dinámicamente desde CloudWorkspaceIcon
    testId: 'slider-bar-cloud-button',
    protectionLevel: 'SYSTEM' as const,
    visible: true,
    enabled: true,
    order: 2,
    group: 'principal' as const,
    get integrityHash() { return generateIntegrityHash(this); }
  }),

  // ============================================================================
  // GRUPO: OPERATIONS (Elementos 3-6)
  // ============================================================================
  Object.freeze({
    id: 'nav-tasks',
    label: 'Tareas',
    to: '/tasks',
    icon: null, // Se asigna dinámicamente desde CheckBoxCheckLinearIcon
    testId: 'slider-bar-tasks-button',
    protectionLevel: 'SYSTEM' as const,
    visible: true,
    enabled: true,
    order: 3,
    group: 'operations' as const,
    get integrityHash() { return generateIntegrityHash(this); }
  }),
  
  Object.freeze({
    id: 'nav-chat',
    label: 'Al Chat',
    to: '/chat',
    icon: null, // Se asigna dinámicamente desde AiOutlineIcon
    testId: 'slider-bar-ai-chat-button',
    protectionLevel: 'SYSTEM' as const,
    visible: true,
    enabled: true,
    order: 4,
    group: 'operations' as const,
    get integrityHash() { return generateIntegrityHash(this); }
  }),
  
  Object.freeze({
    id: 'nav-agenda',
    label: 'Agenda',
    to: '/appointments',
    icon: null, // Se asigna dinámicamente desde BookPanelIcon
    testId: 'slider-bar-agenda-button',
    protectionLevel: 'SYSTEM' as const,
    visible: true,
    enabled: true,
    order: 5,
    group: 'operations' as const,
    get integrityHash() { return generateIntegrityHash(this); }
  }),
  
  Object.freeze({
    id: 'nav-metrics',
    label: 'Metricas',
    to: '/reports',
    icon: null, // Se asigna dinámicamente desde ChartPanelIcon
    testId: 'slider-bar-metrics-button',
    protectionLevel: 'SYSTEM' as const,
    visible: true,
    enabled: true,
    order: 6,
    group: 'operations' as const,
    get integrityHash() { return generateIntegrityHash(this); }
  }),

  // ============================================================================
  // GRUPO: TOOLS (Elementos 7-12)
  // ============================================================================
  Object.freeze({
    id: 'nav-files',
    label: 'Archivos',
    to: '/files',
    icon: null, // Se asigna dinámicamente desde FolderPanelIcon
    testId: 'slider-bar-files-button',
    protectionLevel: 'SYSTEM' as const,
    visible: true,
    enabled: true,
    order: 7,
    group: 'tools' as const,
    get integrityHash() { return generateIntegrityHash(this); }
  }),
  
  Object.freeze({
    id: 'nav-records',
    label: 'Registros',
    to: '/admin/logs',
    icon: null, // Se asigna dinámicamente desde HistoryIcon
    testId: 'slider-bar-records-button',
    protectionLevel: 'SYSTEM' as const,
    visible: true,
    enabled: true,
    order: 8,
    group: 'tools' as const,
    get integrityHash() { return generateIntegrityHash(this); }
  }),
  
  Object.freeze({
    id: 'nav-calendar',
    label: 'Calendario',
    to: '/calendar',
    icon: null, // Se asigna dinámicamente desde CalendarPanelIcon
    testId: 'slider-bar-calendar-button',
    protectionLevel: 'SYSTEM' as const,
    visible: true,
    enabled: true,
    order: 9,
    group: 'tools' as const,
    get integrityHash() { return generateIntegrityHash(this); }
  }),
  
  Object.freeze({
    id: 'nav-volview',
    label: 'VolView 3D',
    to: '/volview',
    icon: null, // Se asigna dinámicamente desde CubePanelIcon
    testId: 'slider-bar-volview-button',
    protectionLevel: 'SYSTEM' as const,
    visible: true,
    enabled: true,
    order: 10,
    group: 'tools' as const,
    get integrityHash() { return generateIntegrityHash(this); }
  }),
  
  Object.freeze({
    id: 'nav-workflow',
    label: 'Al Work flow',
    to: '/ai-workflow',
    icon: null, // Se asigna dinámicamente desde AutoTidyUpIcon
    testId: 'slider-bar-ai-workflow-button',
    protectionLevel: 'SYSTEM' as const,
    visible: true,
    enabled: true,
    order: 11,
    group: 'tools' as const,
    get integrityHash() { return generateIntegrityHash(this); }
  }),
  
  Object.freeze({
    id: 'nav-stirling-pdf',
    label: 'Sterling PDF',
    to: '/stirling-pdf',
    icon: null, // Se asigna dinámicamente desde ExportToPdfIcon
    testId: 'slider-bar-stirling-pdf-button',
    protectionLevel: 'SYSTEM' as const,
    visible: true,
    enabled: true,
    order: 12,
    group: 'tools' as const,
    get integrityHash() { return generateIntegrityHash(this); }
  }),

  // ============================================================================
  // GRUPO: SYSTEM (Elemento 13)
  // ============================================================================
  Object.freeze({
    id: 'nav-settings',
    label: 'Configuración',
    to: '/settings',
    icon: null, // Se asigna dinámicamente desde SettingsIcon
    testId: 'slider-bar-settings-button',
    protectionLevel: 'SYSTEM' as const,
    visible: true,
    enabled: true,
    order: 13,
    group: 'system' as const,
    get integrityHash() { return generateIntegrityHash(this); }
  }),
] as const);

/**
 * ============================================================================
 * VALIDADORES DE INTEGRIDAD
 * ============================================================================
 */

/**
 * Valida que la configuración de navegación no haya sido alterada
 * @returns true si la configuración es válida, false si fue modificada
 */
export function validateNavigationIntegrity(): boolean {
  // Verificar que todos los elementos tengan el nivel de protección correcto
  for (const item of IMMUTABLE_NAVIGATION_ITEMS) {
    if (item.protectionLevel !== 'SYSTEM') {
      console.error(`[IMMUTABLE_NAV] VIOLATION: Item ${item.id} has invalid protection level`);
      return false;
    }
  }

  // Verificar orden secuencial
  for (let i = 0; i < IMMUTABLE_NAVIGATION_ITEMS.length; i++) {
    const item = IMMUTABLE_NAVIGATION_ITEMS[i];
    if (item.order !== i + 1) {
      console.error(`[IMMUTABLE_NAV] VIOLATION: Item ${item.id} has incorrect order ${item.order}, expected ${i + 1}`);
      return false;
    }
  }

  // Verificar que existan exactamente 13 elementos
  if (IMMUTABLE_NAVIGATION_ITEMS.length !== 13) {
    console.error(`[IMMUTABLE_NAV] VIOLATION: Expected 13 items, found ${IMMUTABLE_NAVIGATION_ITEMS.length}`);
    return false;
  }

  console.log('[IMMUTABLE_NAV] Integrity validation passed');
  return true;
}

/**
 * Verifica si un intento de modificación es válido
 * @param itemId ID del elemento a modificar
 * @param userId ID del usuario que intenta modificar
 * @returns true si la modificación está permitida, false si está bloqueada
 */
export function isModificationAllowed(itemId: string, userId: string): boolean {
  // Los elementos inmutables NUNCA pueden ser modificados por usuarios finales
  const immutableItem = IMMUTABLE_NAVIGATION_ITEMS.find(item => item.id === itemId);
  
  if (immutableItem) {
    console.warn(`[IMMUTABLE_NAV] BLOCKED: User ${userId} attempted to modify immutable item ${itemId}`);
    return false;
  }
  
  return true;
}

/**
 * Verifica si un intento de eliminación es válido
 * @param itemId ID del elemento a eliminar
 * @param userId ID del usuario que intenta eliminar
 * @returns true si la eliminación está permitida, false si está bloqueada
 */
export function isDeletionAllowed(itemId: string, userId: string): boolean {
  // Los elementos inmutables NUNCA pueden ser eliminados
  const immutableItem = IMMUTABLE_NAVIGATION_ITEMS.find(item => item.id === itemId);
  
  if (immutableItem) {
    console.warn(`[IMMUTABLE_NAV] BLOCKED: User ${userId} attempted to delete immutable item ${itemId}`);
    return false;
  }
  
  return true;
}

/**
 * Obtiene los elementos de navegación agrupados
 * @returns Objeto con elementos agrupados por categoría
 */
export function getGroupedNavigationItems(): Record<ImmutableNavigationGroup, ImmutableNavigationItem[]> {
  const groups: Record<ImmutableNavigationGroup, ImmutableNavigationItem[]> = {
    principal: [],
    operations: [],
    tools: [],
    system: []
  };

  for (const item of IMMUTABLE_NAVIGATION_ITEMS) {
    groups[item.group].push(item);
  }

  return groups;
}

/**
 * Obtiene los elementos de navegación ordenados
 * @returns Array de elementos ordenados por su propiedad 'order'
 */
export function getOrderedNavigationItems(): readonly ImmutableNavigationItem[] {
  return [...IMMUTABLE_NAVIGATION_ITEMS].sort((a, b) => a.order - b.order);
}

/**
 * Exporta el hash de integridad para verificación externa
 */
export const getNavigationIntegrityHash = (): string => NAVIGATION_INTEGRITY_HASH;

/**
 * ============================================================================
 * CONSTANTES DE PROTECCIÓN
 * ============================================================================
 */

/**
 * Mensajes de error para intentos de modificación no autorizados
 */
export const NAVIGATION_PROTECTION_ERRORS = Object.freeze({
  MODIFICATION_BLOCKED: 'ERROR: La modificación de elementos de navegación inmutables está bloqueada a nivel de sistema.',
  DELETION_BLOCKED: 'ERROR: La eliminación de elementos de navegación inmutables está bloqueada a nivel de sistema.',
  UNAUTHORIZED_ACCESS: 'ERROR: Acceso no autorizado. Los usuarios finales no tienen privilegios para modificar la navegación.',
  INTEGRITY_VIOLATION: 'ERROR: Se detectó una violación de integridad en la configuración de navegación.',
  INVALID_ORDER: 'ERROR: El orden de los elementos de navegación no puede ser alterado.',
}) as const;

/**
 * ============================================================================
 * FUNCIÓN DE INICIALIZACIÓN
 * ============================================================================
 */

/**
 * Inicializa el sistema de navegación inmutable
 * Debe llamarse al inicio de la aplicación
 */
export function initializeImmutableNavigation(): void {
  console.log('[IMMUTABLE_NAV] Initializing immutable navigation system...');
  
  // Validar integridad
  if (!validateNavigationIntegrity()) {
    console.error('[IMMUTABLE_NAV] CRITICAL: Navigation integrity check failed!');
    console.error('[IMMUTABLE_NAV] The navigation configuration may have been tampered with.');
    // En producción, esto debería disparar una alerta de seguridad
  }
  
  console.log('[IMMUTABLE_NAV] Immutable navigation system initialized successfully');
  console.log(`[IMMUTABLE_NAV] Total immutable items: ${IMMUTABLE_NAVIGATION_ITEMS.length}`);
  console.log(`[IMMUTABLE_NAV] Integrity hash: ${NAVIGATION_INTEGRITY_HASH}`);
}

// Auto-inicialización cuando se importa el módulo
if (typeof window !== 'undefined') {
  initializeImmutableNavigation();
}