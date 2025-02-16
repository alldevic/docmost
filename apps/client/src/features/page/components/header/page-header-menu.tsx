import { ActionIcon, Group, Menu, Tooltip } from "@mantine/core";
import {
  IconAlignRight2,
  IconArrowsHorizontal,
  IconDots,
  IconFileExport,
  IconHistory,
  IconLink,
  IconList,
  IconMessage,
  IconPrinter,
  IconSearch,
  IconTrash,
  IconWifiOff,
} from "@tabler/icons-react";
import React from "react";
import useToggleAside from "@/hooks/use-toggle-aside.tsx";
import { useAtom } from "jotai";
import { historyAtoms } from "@/features/page-history/atoms/history-atoms.ts";
import { useClipboard, useDisclosure, useHotkeys } from "@mantine/hooks";
import { useParams } from "react-router-dom";
import { usePageQuery } from "@/features/page/queries/page-query.ts";
import { buildPageUrl } from "@/features/page/page.utils.ts";
import { notifications } from "@mantine/notifications";
import { getAppUrl } from "@/lib/config.ts";
import { extractPageSlugId } from "@/lib";
import { treeApiAtom } from "@/features/page/tree/atoms/tree-api-atom.ts";
import { useDeletePageModal } from "@/features/page/hooks/use-delete-page-modal.tsx";
import { PageWidthToggle } from "@/features/user/components/page-width-pref.tsx";
import { useTranslation } from "react-i18next";
import ExportModal from "@/components/common/export-modal";
import { pageEditorAtom,yjsConnectionStatusAtom } from "@/features/editor/atoms/editor-atoms.ts";
import { ViewHeadingsToggle } from "@/features/user/components/view-headings";
import { viewHeadingsAtom } from "@/components/layouts/global/hooks/atoms/sidebar-atom";
import { userAtom } from "@/features/user/atoms/current-user-atom";
import { PageStateSegmentedControl } from "@/features/user/components/page-state-pref.tsx";
import { searchAndReplaceStateAtom } from "@/features/editor/components/search-and-replace/atoms/search-and-replace-state-atom.ts";

interface PageHeaderMenuProps {
  readOnly?: boolean;
}
export default function PageHeaderMenu({ readOnly }: PageHeaderMenuProps) {
  const { t } = useTranslation();
  const toggleAside = useToggleAside();
  const [yjsConnectionStatus] = useAtom(yjsConnectionStatusAtom);
  const [_, setViewHeadings] = useAtom(viewHeadingsAtom);
  const [user] = useAtom(userAtom);
  const fullPageWidth = user.settings?.preferences?.fullPageWidth;
  const viewHeadings = user.settings?.preferences?.viewHeadings;
  const [editor, setEditor] = useAtom(pageEditorAtom);
  const [pageFindState, setPageFindState] = useAtom(searchAndReplaceStateAtom);

  useHotkeys(
    [
      [
        "ctrl+F",
        () => {
          const event = new CustomEvent("openFindDialogFromEditor", {});
          document.dispatchEvent(event);
        },
      ],
      [
        "Escape",
        () => {
          const event = new CustomEvent("closeFindDialogFromEditor", {});
          document.dispatchEvent(event);
        },
      ],
    ],
    [],
  );

  return (
    <>
      {yjsConnectionStatus === "disconnected" && (
        <Tooltip
          label={t("Real-time editor connection lost. Retrying...")}
          openDelay={250}
          withArrow
        >
          <ActionIcon variant="default" c="red" style={{ border: "none" }}>
            <IconWifiOff size={20} stroke={2} />
          </ActionIcon>
        </Tooltip>
      )}

      {!readOnly && <PageStateSegmentedControl />}

      <Tooltip label={t("Find (Ctrl-F)")} openDelay={250} withArrow>
        <ActionIcon
          variant="default"
          style={{ border: "none" }}
          onClick={() => setPageFindState({ isOpen: true })}
        >
          <IconSearch size={20} stroke={2} />
        </ActionIcon>
      </Tooltip>

      <Tooltip label={t("Comments")} openDelay={250} withArrow>
        <ActionIcon
          variant="default"
          style={{ border: "none" }}
          onClick={() => toggleAside("comments")}
        >
          <IconMessage size={20} stroke={2} />
        </ActionIcon>
      </Tooltip>

      {(fullPageWidth && viewHeadings) ? (
        <Tooltip label={t("View headings")} openDelay={250} withArrow>
          <ActionIcon
            variant="default"
            style={{ border: "none" }}
            onClick={() => setViewHeadings(true)}
          >
            <IconList size={20} stroke={2} />
          </ActionIcon>
        </Tooltip>
      ) : null}
      <PageActionMenu readOnly={readOnly} />
    </>
  );
}

interface PageActionMenuProps {
  readOnly?: boolean;
}
function PageActionMenu({ readOnly }: PageActionMenuProps) {
  const { t } = useTranslation();
  const [, setHistoryModalOpen] = useAtom(historyAtoms);
  const clipboard = useClipboard({ timeout: 500 });
  const { pageSlug, spaceSlug } = useParams();
  const { data: page, isLoading } = usePageQuery({
    pageId: extractPageSlugId(pageSlug),
  });
  const { openDeleteModal } = useDeletePageModal();
  const [tree] = useAtom(treeApiAtom);
  const [exportOpened, { open: openExportModal, close: closeExportModal }] =
    useDisclosure(false);

  const handleCopyLink = () => {
    const pageUrl =
      getAppUrl() + buildPageUrl(spaceSlug, page.slugId, page.title);

    clipboard.copy(pageUrl);
    notifications.show({ message: t("Link copied") });
  };

  const handlePrint = () => {
    setTimeout(() => {
      window.print();
    }, 250);
  };

  const openHistoryModal = () => {
    setHistoryModalOpen(true);
  };

  const handleDeletePage = () => {
    openDeleteModal({ onConfirm: () => tree?.delete(page.id) });
  };

  return (
    <>
      <Menu
        shadow="xl"
        position="bottom-end"
        offset={20}
        width={200}
        withArrow
        arrowPosition="center"
      >
        <Menu.Target>
          <ActionIcon variant="default" style={{ border: "none" }}>
            <IconDots size={20} />
          </ActionIcon>
        </Menu.Target>

        <Menu.Dropdown>
          <Menu.Item
            leftSection={<IconLink size={16} />}
            onClick={handleCopyLink}
          >
            {t("Copy link")}
          </Menu.Item>
          <Menu.Divider />

          <Menu.Item leftSection={<IconArrowsHorizontal size={16} />}>
            <Group wrap="nowrap">
              <PageWidthToggle label={t("Full width")} />
            </Group>
          </Menu.Item>

          <Menu.Item leftSection={<IconAlignRight2 size={16} />}>
            <Group wrap="nowrap">
              <ViewHeadingsToggle label={t("View headings")} />
            </Group>
          </Menu.Item>

          <Menu.Item
            leftSection={<IconHistory size={16} />}
            onClick={openHistoryModal}
          >
            {t("Page history")}
          </Menu.Item>

          <Menu.Divider />

          <Menu.Item
            leftSection={<IconFileExport size={16} />}
            onClick={openExportModal}
          >
            {t("Export")}
          </Menu.Item>

          <Menu.Item
            leftSection={<IconPrinter size={16} />}
            onClick={handlePrint}
          >
            {t("Print PDF")}
          </Menu.Item>

          {!readOnly && (
            <>
              <Menu.Divider />
              <Menu.Item
                color={"red"}
                leftSection={<IconTrash size={16} />}
                onClick={handleDeletePage}
              >
                {t("Delete")}
              </Menu.Item>
            </>
          )}
        </Menu.Dropdown>
      </Menu>

      <ExportModal
        type="page"
        id={page.id}
        open={exportOpened}
        onClose={closeExportModal}
      />
    </>
  );
}
