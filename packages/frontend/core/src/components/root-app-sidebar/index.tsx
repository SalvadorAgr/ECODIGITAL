// Import is already correct, no changes needed
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
import { memo, useCallback } from 'react';

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
 * This is for the whole affine app sidebar.
 * This component wraps the app sidebar in `@affine/component` with logic and data.
 *
 */
export const RootAppSidebar = memo((): ReactElement => {
  const { workbenchService, cMDKQuickSearchService, authService } = useServices(
    {
      WorkbenchService,
      CMDKQuickSearchService,
      AuthService,
    }
  );

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
        <div className={workspaceAndUserWrapper}>
          <div className={workspaceWrapper}>
            <WorkspaceNavigator
              showEnableCloudButton
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
        <AllDocsButton />
        <AppSidebarJournalButton />
        {sessionStatus === 'authenticated' && <NotificationButton />}
        <AIChatButton />
      </SidebarContainer>
      <SidebarScrollableContainer>
        {/* EcoDigital fixed modules (El Consultorio) - add only, grouped and native (no replacement). */}
        <CollapsibleSection
          path={['consultorio', 'system']}
          title={'System'}
          contentStyle={{ padding: '6px 8px 0 8px' }}
        >
          <MenuItem
            data-testid="slider-bar-workspace-setting-button"
            icon={<SettingsIcon />}
            onClick={onOpenSettingModal}
          >
            <span data-testid="settings-modal-trigger">
              {t['com.affine.settingSidebar.title']()}
            </span>
          </MenuItem>
          <SidebarModuleLink
            testId="slider-bar-cloud-button"
            icon={<CloudWorkspaceIcon />}
            to={'/cloud'}
            label={'Cloud'}
          />
          <SidebarModuleLink
            testId="slider-bar-files-button"
            icon={<FolderPanelIcon />}
            to={'/files'}
            label={'Archivos'}
          />
          <SidebarModuleLink
            testId="slider-bar-records-button"
            icon={<HistoryIcon />}
            to={'/admin/logs'}
            label={'Registros'}
          />
        </CollapsibleSection>

        <CollapsibleSection
          path={['consultorio', 'operations']}
          title={'Operations'}
          contentStyle={{ padding: '6px 8px 0 8px' }}
        >
          <SidebarModuleLink
            testId="slider-bar-tasks-button"
            icon={<CheckBoxCheckLinearIcon />}
            to={'/tasks'}
            label={'Tareas'}
          />
          <SidebarModuleLink
            testId="slider-bar-agenda-button"
            icon={<BookPanelIcon />}
            to={'/appointments'}
            label={'Agenda'}
          />
          <SidebarModuleLink
            testId="slider-bar-calendar-button"
            icon={<CalendarPanelIcon />}
            to={'/calendar'}
            label={'Calendario'}
          />
          <SidebarModuleLink
            testId="slider-bar-metrics-button"
            icon={<ChartPanelIcon />}
            to={'/reports'}
            label={'Metricas'}
          />
        </CollapsibleSection>

        <CollapsibleSection
          path={['consultorio', 'tools']}
          title={'Tools'}
          contentStyle={{ padding: '6px 8px 0 8px' }}
        >
          <SidebarModuleLink
            testId="slider-bar-volview-button"
            icon={<CubePanelIcon />}
            to={'/volview'}
            label={'VolView 3D'}
          />
          <SidebarModuleLink
            testId="slider-bar-ai-workflow-button"
            icon={<AutoTidyUpIcon />}
            to={'/ai-workflow'}
            label={'AI Workflow'}
          />
          <SidebarModuleLink
            testId="slider-bar-stirling-pdf-button"
            icon={<ExportToPdfIcon />}
            to={'/stirling-pdf'}
            label={'Sterling PDF'}
          />
        </CollapsibleSection>

        <NavigationPanelFavorites />
        <NavigationPanelOrganize />
        <NavigationPanelMigrationFavorites />
        <NavigationPanelTags />
        <NavigationPanelCollections />
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
      <SidebarContainer className={bottomContainer}>
        <SidebarAudioPlayer />
        {BUILD_CONFIG.isElectron ? <UpdaterButton /> : <AppDownloadButton />}
      </SidebarContainer>
    </AppSidebar>
  );
});

RootAppSidebar.displayName = 'memo(RootAppSidebar)';
