import {
  useDeletedPagesQuery,
  useRestorePageMutation,
  useDeletePageMutation,
} from "@/features/page/queries/page-query.ts";
import { modals } from "@mantine/modals";
import { ActionIcon, Menu, Table, Text } from "@mantine/core";
import { IconDots } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { IconTrash, IconArrowBackUp } from '@tabler/icons-react';
interface RecycledPagesProps {
  spaceId: string;
  readOnly?: boolean;
}

export default function RecycledPagesList({
  spaceId,
  readOnly,
}: RecycledPagesProps) {
  const { t } = useTranslation();
  const { data, isLoading } = useDeletedPagesQuery(spaceId);
  const restorePageMutation = useRestorePageMutation();
  const removePageMutation = useDeletePageMutation();

  const handleRestorePage = async (pageId: string) => {
    await restorePageMutation.mutateAsync(pageId);
    window.location.reload();
  };

  const handleRemovePage = async (pageId: string) => {
    await removePageMutation.mutateAsync(pageId);
    window.location.reload();
  };

  const openRemovePageModal = (pageId: string) =>
    modals.openConfirmModal({
      title: t("Delete page permanently"),
      children: (
        <Text size="sm">
          {t("Are you sure you want to permanently delete this page?")}
        </Text>
      ),
      centered: true,
      labels: { confirm: t("Delete"), cancel: t("Cancel") },
      confirmProps: { color: "red" },
      onConfirm: () => handleRemovePage(pageId),
    });

  const openRestorePageModal = (pageId: string) =>
    modals.openConfirmModal({
      title: t("Restore page"),
      children: <Text size="sm">{t("Restore this page?")}</Text>,
      centered: true,
      labels: { confirm: t("Restore"), cancel: t("Cancel") },
      confirmProps: { color: "blue" },
      onConfirm: () => handleRestorePage(pageId),
    });

  return (
    <>
      {data && data.items.length > 0 ? (
        <Table highlightOnHover verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
            <Table.Th>{t("Deleted Pages")}</Table.Th>
            </Table.Tr>
          </Table.Thead>

          <Table.Tbody>
            {data?.items.map((page) => (
              <Table.Tr key={page.id}>
                <Table.Td>
                  <Text component="div" fz="sm" fw={500}>
                    {page?.title || t("Untitled")}
                  </Text>
                </Table.Td>

                <Table.Td>
                  {!readOnly && (
                    <Menu>
                      <Menu.Target>
                        <ActionIcon variant="subtle" c="gray">
                          <IconDots size={20} stroke={2} />
                        </ActionIcon>
                      </Menu.Target>

                      <Menu.Dropdown>
                        <Menu.Item
                          onClick={() => openRestorePageModal(page.id)}
                          leftSection={<IconArrowBackUp size={16} />}
                        >
                          {t("Restore Page")}
                        </Menu.Item>
                        <Menu.Divider />
                        <Menu.Item
                          c="red"
                          leftSection={<IconTrash size={16} />}
                          onClick={() => openRemovePageModal(page.id)}
                        >
                          {t("Delete Page permanently")}
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      ) : (
        <Text size="sm" c="dimmed">
          {t("No deleted pages")}
        </Text>
      )}
    </>
  );
}
