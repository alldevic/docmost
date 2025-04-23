import { ActionIcon, Tooltip, Group, Text, MantineSize, SegmentedControl } from "@mantine/core";
import { useAtom } from "jotai";
import { userAtom } from "@/features/user/atoms/current-user-atom.ts";
import { updateUser } from "@/features/user/services/user-service.ts";
import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { PageEditMode } from "@/features/user/types/user.types.ts";
import { IconPencilOff, IconPencil } from "@tabler/icons-react";

export default function PageStatePref() {
  const { t } = useTranslation();

  return (
    <Group justify="space-between" wrap="nowrap" gap="xl">
      <div>
        <Text size="md">{t("Default page edit mode")}</Text>
        <Text size="sm" c="dimmed">
          {t("Choose your preferred page edit mode. Avoid accidental edits.")}
        </Text>
      </div>

      <PageStateSegmentedControl />
    </Group>
  );
}

interface PageStateSegmentedControlProps {
  size?: MantineSize;
}

export function PageStateSegmentedControl({
  size,
}: PageStateSegmentedControlProps) {
  const { t } = useTranslation();
  const [user, setUser] = useAtom(userAtom);
  const pageEditMode =
    user?.settings?.preferences?.pageEditMode ?? PageEditMode.Edit;
  const [value, setValue] = useState(pageEditMode);

  const handleChange = useCallback(
    async (value: string) => {
      const updatedUser = await updateUser({ pageEditMode: value });
      setValue(value);
      setUser(updatedUser);
    },
    [user, setUser],
  );

  useEffect(() => {
    if (pageEditMode !== value) {
      setValue(pageEditMode);
    }
  }, [pageEditMode, value]);

  return (
    <Tooltip label={pageEditMode === PageEditMode.Edit ? t("Editing") : t("Reading")} openDelay={250} withArrow>
      <ActionIcon
        variant="default"
        style={{ border: "none" }}
        onClick={() => {
          handleChange(pageEditMode === PageEditMode.Edit ? PageEditMode.Read : PageEditMode.Edit);
        }}
        aria-label={pageEditMode === PageEditMode.Edit ? t("Editing") : t("Reading")}
      >
        {pageEditMode === PageEditMode.Edit ? <IconPencil size={20} stroke={2} /> : <IconPencilOff size={20} stroke={2} />}
      </ActionIcon>
    </Tooltip>
  );
}
