/**
 * ============================================================================
 * ECODIGITAL - ROOT APP SIDEBAR WITH IMMUTABLE NAVIGATION
 * ============================================================================
 *
 * ARCHIVO: index.tsx
 * PROPÓSITO: Sidebar principal con navegación inmutable
 * SEGURIDAD: Navegación fija con protección a nivel de sistema
 *
 * IMPORTANTE:
 * - Los 13 elementos de navegación inmutables están bloqueados permanentemente
 * - Los usuarios finales tienen privilegios NULOS de eliminación/modificación
 * - La configuración inmutable está definida en 'immutable-navigation-config.ts'
 *
 * ORDEN SECUENCIAL EXACTO DE ELEMENTOS INMUTABLES:
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
 * ÚLTIMA ACTUALIZACIÓN: 2026-03-17
 * AUTOR: DevOps Automation Specialist
 * ============================================================================
 */

import {
  AddPageButton,
  AppDownloadButton,
  AppSidebar,
  MenuItem,
  MenuLinkItem,
  QuickSearchInput,
  SidebarContainer,
  SidebarScrollableContainer,
} from '@affine/core/modules/app-sidebar/views';
import { ExternalMenuLinkItem } from '@affine/core/modules/app-sidebar/views/menu-item/external-menu-link-item';
import { AuthService, ServerService } from '@affine/core/modules/cloud';
import { WorkspaceDialogService } from '@affine/core/modules/dialogs';
import { FeatureFlagService } from '@affine/core/modules/feature-flag';
import { CMDKQuickSearchService } from '@affine/core/modules/quicksearch/services/cmdk';
import type { Workspace } from '@affine/core/modules/workspace';
import { useI18n } from '@affine/i18n';
import { track } from '@affine/track';
import type { Store } from '@blocksuite/affine/store';
import {
  AiOutlineIcon,
  AllDocsIcon,
  AutoTidyUpIcon,
  BookPanelIcon,
  CalendarPanelIcon,
  ChartPanelIcon,
  CheckBoxCheckLinearIcon,
  CloudWorkspaceIcon,
  CubePanelIcon,
  ExportToPdfIcon,
  FolderPanelIcon,
  HistoryIcon,
  ImportIcon,
  JournalIcon,
  SettingsIcon,
} from '@blocksuite/icons/rc';
import { useLiveData, useService, useServices } from '@toeverything/infra';
import type { ReactElement } from 'react';
import type { SVGAttributes } from 'react';
import { memo, useCallback, useEffect } from 'react';

import {
  CollapsibleSection,
  NavigationPanelCollections,
  NavigationPanelFavorites,
  NavigationPanelMigrationFavorites,
  NavigationPanelOrganize,
  NavigationPanelTags,
} from '../../desktop/components/navigation-panel';
import { AppSidebarService } from '../../modules/app-sidebar';
import { SidebarSwitch } from '../../modules/app-sidebar/views/sidebar-header';
import { WorkbenchService } from '../../modules/workbench';
import { WorkspaceNavigator } from '../workspace-selector';
import {
  bottomContainer,
  quickSearch,
  quickSearchAndNewPage,
  workspaceAndUserWrapper,
  workspaceWrapper,
} from './index.css';
import {
  initializeImmutableNavigation,
  validateNavigationIntegrity,
  IMMUTABLE_NAVIGATION_ITEMS,
  NAVIGATION_PROTECTION_ERRORS,
} from './immutable-navigation-config';
import { InviteMembersButton } from './invite-members-button';
import { AppSidebarJournalButton } from './journal-button';
import { NotificationButton } from './notification-button';
import { SidebarAudioPlayer } from './sidebar-audio-player';
import { TemplateDocEntrance } from './template-doc-entrance';
import { TrashButton } from './trash-button';
import { UpdaterButton } from './updater-button';

export type RootAppSidebarProps = {
  isPublicWorkspace: boolean;
  onOpenQuickSearchModal: () => void;
  onOpenSettingModal: () => void;
  currentWorkspace: Workspace;
  openPage: (pageId: string) => void;
  createPage: () => Store;
  paths: {
    all: (workspaceId: string) => string;
    trash: (workspaceId: string) => string;
    shared: (workspaceId: string) => string;
  };
};

const AllDocsButton = () => {
  const t = useI18n();
  const { workbenchService } = useServices({
    WorkbenchService,
  });
  const workbench = workbenchService.workbench;
  const allPageActive = useLiveData(
    workbench.location$.selector(location => location.pathname === '/all')
  );

  return (
    <MenuLinkItem icon={<AllDocsIcon />} active={allPageActive} to={'/all'}>
      <span data-testid="all-pages">
        {t['com.affine.workspaceSubPath.all']()}
      </span>
    </MenuLinkItem>
  );
};

const AIChatButton = () => {
  const t = useI18n();
  const featureFlagService = useService(FeatureFlagService);
  const serverService = useService(ServerService);
  const serverFeatures = useLiveData(serverService.server.features$);
  const enableAI = useLiveData(featureFlagService.flags.enable_ai.$);

  const { workbenchService } = useServices({
    WorkbenchService,
  });
  const workbench = workbenchService.workbench;
  const aiChatActive = useLiveData(
    workbench.location$.selector(location => location.pathname === '/chat')
  );

  if (!enableAI || !serverFeatures?.copilot) {
    return null;
  }

  return (
    <MenuLinkItem icon={<AiOutlineIcon />} active={aiChatActive} to={'/chat'}>
      <span data-testid="ai-chat">
        {t['com.affine.workspaceSubPath.chat']()}
      </span>
    </MenuLinkItem>
  );
};

const SidebarModuleLink = ({
  icon,
  to,
  label,
  testId,
}: {
  icon: ReactElement<SVGAttributes<SVGElement>>;
  to: string;
  label: string;
  testId: string;
}) => {
  const { workbenchService } = useServices({
    WorkbenchService,
  });
  const workbench = workbenchService.workbench;
  const active = useLiveData(
    workbench.location$.selector(location => {
      return location.pathname === to || location.pathname.startsWith(`${to}/`);
    })
  );

  return (
    <MenuLinkItem data-testid={testId} icon={icon} active={active} to={to}>
      <span>{label}</span>
    </MenuLinkItem>
  );
};

/**
 * ============================================================================
 * IMMUTABLE NAVIGATION SIDEBAR COMPONENT
 * ============================================================================
 *
 * Este componente implementa los 13 elementos de navegación inmutables
 * en el orden secuencial exacto especificado, manteniendo los elementos
 * existentes organizados por grupos.
 *
 * ORDEN SECUENCIAL EXACTO DE ELEMENTOS INMUTABLES:
 * 1. Home          - Grupo: principal
 * 2. Cloud         - Grupo: principal
 * 3. Tareas        - Grupo: operations
 * 4. Al Chat       - Grupo: operations
 * 5. Agenda        - Grupo: operations
 * 6. Metricas      - Grupo: operations
 * 7. Archivos      - Grupo: tools
 * 8. Registros     - Grupo: tools
 * 9. Calendario    - Grupo: tools
 * 10. VolView 3D   - Grupo: tools
 * 11. Al Work flow - Grupo: tools
 * 12. Sterling PDF - Grupo: tools
 * 13. Configuración - Grupo: system
 *
 * PROTECCIÓN:
 * - Los elementos inmutables NO pueden ser eliminados por usuarios finales
 * - Los elementos inmutables NO pueden ser modificados por usuarios finales
 * - La integridad se valida al inicio de la aplicación
 *
 * ============================================================================
 */
export const RootAppSidebar = memo((): ReactElement => {
  const { workbenchService, cMDKQuickSearchService, authService } = useServices(
    {
      WorkbenchService,
      CMDKQuickSearchService,
      AuthService,
    }
  );

  // ============================================================================
  // VALIDACIÓN DE INTEGRIDAD DE NAVEGACIÓN INMUTABLE
  // Se ejecuta una vez al montar el componente
  // ============================================================================
  useEffect(() => {
    // Validar integridad de la navegación inmutable al inicio
    if (!validateNavigationIntegrity()) {
      console.error('[IMMUTABLE_NAV] CRITICAL: Navigation integrity validation failed!');
      console.error(NAVIGATION_PROTECTION_ERRORS.INTEGRITY_VIOLATION);
      // En producción, esto debería disparar una alerta de seguridad
    }
    // Inicializar el sistema de navegación inmutable
    initializeImmutableNavigation();
  }, []);

  const sessionStatus = useLiveData(authService.session.status$);
  const t = useI18n();
  const workspaceDialogService = useService(WorkspaceDialogService);
  const workbench = workbenchService.workbench;
  const appSidebar = useService(AppSidebarService).sidebar;
  const appSidebarOpen = useLiveData(appSidebar.open$);
  const appSidebarHovering = useLiveData(appSidebar.hovering$);
  const showSidebarSwitch = appSidebarOpen || appSidebarHovering;
  const workspaceSelectorOpen = useLiveData(workbench.workspaceSelectorOpen$);
  const onOpenQuickSearchModal = useCallback(() => {
    cMDKQuickSearchService.toggle();
  }, [cMDKQuickSearchService]);

  const onWorkspaceSelectorOpenChange = useCallback(
    (open: boolean) => {
      workbench.setWorkspaceSelectorOpen(open);
    },
    [workbench]
  );

  const onOpenSettingModal = useCallback(() => {
    workspaceDialogService.open('setting', {
      activeTab: 'appearance',
    });
    track.$.navigationPanel.$.openSettings();
  }, [workspaceDialogService]);

  const handleOpenDocs = useCallback(
    (result: {
      docIds: string[];
      entryId?: string;
      isWorkspaceFile?: boolean;
    }) => {
      const { docIds, entryId, isWorkspaceFile } = result;
      // If the imported file is a workspace file, open the entry page.
      if (isWorkspaceFile && entryId) {
        workbench.openDoc(entryId);
      } else if (!docIds.length) {
        return;
      }
      // Open all the docs when there are multiple docs imported.
      if (docIds.length > 1) {
        workbench.openAll();
      } else {
        // Otherwise, open the only doc.
        workbench.openDoc(docIds[0]);
      }
    },
    [workbench]
  );

  const onOpenImportModal = useCallback(() => {
    track.$.navigationPanel.importModal.open();
    workspaceDialogService.open('import', undefined, payload => {
      if (!payload) {
        return;
      }
      handleOpenDocs(payload);
    });
  }, [workspaceDialogService, handleOpenDocs]);

  return (
    <AppSidebar>
      <SidebarContainer>
        {/* ============================================================================ */}
        {/* SECCIÓN SUPERIOR: Selector de workspace y búsqueda */}
        {/* ============================================================================ */}
        <div className={workspaceAndUserWrapper}>
          <div className={workspaceWrapper}>
            <WorkspaceNavigator
              showSyncStatus
              open={workspaceSelectorOpen}
              onOpenChange={onWorkspaceSelectorOpenChange}
              dense
            />
          </div>
          <SidebarSwitch show={showSidebarSwitch} />
        </div>
        <div className={quickSearchAndNewPage}>
          <QuickSearchInput
            className={quickSearch}
            data-testid="slider-bar-quick-search-button"
            data-event-props="$.navigationPanel.$.quickSearch"
            onClick={onOpenQuickSearchModal}
          />
          <AddPageButton />
        </div>

        {/* ============================================================================ */}
        {/* ELEMENTOS INMUTABLES - GRUPO PRINCIPAL (1-2) */}
        {/* Orden secuencial exacto: Home, Cloud */}
        {/* PROTEGIDO: Solo lectura - Sin permisos de modificación/eliminación */}
        {/* ============================================================================ */}
        {/* 1. Home - Elemento inmutable */}
        <AllDocsButton />
        {/* 2. Cloud - Elemento inmutable */}
        <SidebarModuleLink
          testId="slider-bar-cloud-button"
          icon={<CloudWorkspaceIcon />}
          to={'/cloud'}
          label={'Cloud'}
        />

        {/* ============================================================================ */}
        {/* ELEMENTOS INMUTABLES - GRUPO OPERATIONS (3-6) */}
        {/* Orden secuencial exacto: Tareas, Al Chat, Agenda, Metricas */}
        {/* PROTEGIDO: Solo lectura - Sin permisos de modificación/eliminación */}
        {/* ============================================================================ */}
        <CollapsibleSection
          path={['immutable', 'operations']}
          title={'Operations'}
          contentStyle={{ padding: '6px 8px 0 8px' }}
        >
          {/* 3. Tareas - Elemento inmutable */}
          <SidebarModuleLink
            testId="slider-bar-tasks-button"
            icon={<CheckBoxCheckLinearIcon />}
            to={'/tasks'}
            label={'Tareas'}
          />
          {/* 4. Al Chat - Elemento inmutable */}
          <AIChatButton />
          {/* 5. Agenda - Elemento inmutable */}
          <SidebarModuleLink
            testId="slider-bar-agenda-button"
            icon={<BookPanelIcon />}
            to={'/appointments'}
            label={'Agenda'}
          />
          {/* 6. Metricas - Elemento inmutable */}
          <SidebarModuleLink
            testId="slider-bar-metrics-button"
            icon={<ChartPanelIcon />}
            to={'/reports'}
            label={'Metricas'}
          />
        </CollapsibleSection>

        {/* ============================================================================ */}
        {/* ELEMENTOS INMUTABLES - GRUPO TOOLS (7-12) */}
        {/* Orden secuencial exacto: Archivos, Registros, Calendario, VolView 3D, Al Work flow, Sterling PDF */}
        {/* PROTEGIDO: Solo lectura - Sin permisos de modificación/eliminación */}
        {/* ============================================================================ */}
        <CollapsibleSection
          path={['immutable', 'tools']}
          title={'Tools'}
          contentStyle={{ padding: '6px 8px 0 8px' }}
        >
          {/* 7. Archivos - Elemento inmutable */}
          <SidebarModuleLink
            testId="slider-bar-files-button"
            icon={<FolderPanelIcon />}
            to={'/files'}
            label={'Archivos'}
          />
          {/* 8. Registros - Elemento inmutable */}
          <SidebarModuleLink
            testId="slider-bar-records-button"
            icon={<HistoryIcon />}
            to={'/admin/logs'}
            label={'Registros'}
          />
          {/* 9. Calendario - Elemento inmutable */}
          <SidebarModuleLink
            testId="slider-bar-calendar-button"
            icon={<CalendarPanelIcon />}
            to={'/calendar'}
            label={'Calendario'}
          />
          {/* 10. VolView 3D - Elemento inmutable */}
          <SidebarModuleLink
            testId="slider-bar-volview-button"
            icon={<CubePanelIcon />}
            to={'/volview'}
            label={'VolView 3D'}
          />
          {/* 11. Al Work flow - Elemento inmutable */}
          <SidebarModuleLink
            testId="slider-bar-ai-workflow-button"
            icon={<AutoTidyUpIcon />}
            to={'/ai-workflow'}
            label={'Al Work flow'}
          />
          {/* 12. Sterling PDF - Elemento inmutable */}
          <SidebarModuleLink
            testId="slider-bar-stirling-pdf-button"
            icon={<ExportToPdfIcon />}
            to={'/stirling-pdf'}
            label={'Sterling PDF'}
          />
        </CollapsibleSection>

        {/* ============================================================================ */}
        {/* ELEMENTOS EXISTENTES - Navegación dinámica del usuario */}
        {/* Estos elementos NO son inmutables y pueden ser personalizados */}
        {/* ============================================================================ */}
        <AppSidebarJournalButton />
        {sessionStatus === 'authenticated' && <NotificationButton />}
      </SidebarContainer>

      <SidebarScrollableContainer>
        {/* ============================================================================ */}
        {/* ELEMENTOS DINÁMICOS - Favoritos, Organización, Tags, Colecciones */}
        {/* Estos elementos son personalizables por el usuario */}
        {/* ============================================================================ */}
        <NavigationPanelFavorites />
        <NavigationPanelOrganize />
        <NavigationPanelMigrationFavorites />
        <NavigationPanelTags />
        <NavigationPanelCollections />

        {/* ============================================================================ */}
        {/* ELEMENTOS INMUTABLES - GRUPO SYSTEM (13) */}
        {/* Orden secuencial exacto: Configuración */}
        {/* PROTEGIDO: Solo lectura - Sin permisos de modificación/eliminación */}
        {/* ============================================================================ */}
        <CollapsibleSection
          path={['immutable', 'system']}
          title={'System'}
          contentStyle={{ padding: '6px 8px 0 8px' }}
        >
          {/* 13. Configuración - Elemento inmutable */}
          <MenuItem
            data-testid="slider-bar-settings-button"
            icon={<SettingsIcon />}
            onClick={onOpenSettingModal}
            style={{ paddingTop: 15, paddingBottom: 15 }}
          >
            <span data-testid="settings-modal-trigger">
              {t['com.affine.settingSidebar.title']()}
            </span>
          </MenuItem>
        </CollapsibleSection>

        {/* ============================================================================ */}
        {/* ELEMENTOS ADICIONALES EXISTENTES - Sección Others */}
        {/* Estos elementos NO son inmutables y se mantienen como estaban */}
        {/* ============================================================================ */}
        <CollapsibleSection
          path={['others']}
          title={t['com.affine.rootAppSidebar.others']()}
          contentStyle={{ padding: '6px 8px 0 8px' }}
        >
          <TrashButton />
          <MenuItem
            data-testid="slider-bar-import-button"
            icon={<ImportIcon />}
            onClick={onOpenImportModal}
          >
            <span data-testid="import-modal-trigger">{t['Import']()}</span>
          </MenuItem>
          <InviteMembersButton />
          <TemplateDocEntrance />
          <ExternalMenuLinkItem
            href="https://ecodigital.io/blog?tag=Release+Note"
            icon={<JournalIcon />}
            label={t['com.affine.app-sidebar.learn-more']()}
          />
        </CollapsibleSection>
      </SidebarScrollableContainer>

      {/* ============================================================================ */}
      {/* CONTENEDOR INFERIOR - Reproductor de audio y actualizaciones */}
      {/* ============================================================================ */}
      <SidebarContainer className={bottomContainer}>
        <SidebarAudioPlayer />
        {BUILD_CONFIG.isElectron ? <UpdaterButton /> : <AppDownloadButton />}
      </SidebarContainer>
    </AppSidebar>
  );
});

RootAppSidebar.displayName = 'memo(RootAppSidebar)';
