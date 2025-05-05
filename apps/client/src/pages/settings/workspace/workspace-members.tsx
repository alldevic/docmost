import WorkspaceInviteModal from "@/features/workspace/components/members/components/workspace-invite-modal";
import { Group, SegmentedControl, Space, Text } from "@mantine/core";
import WorkspaceMembersTable from "@/features/workspace/components/members/components/workspace-members-table";
import WorkspaceDeactivatedMembersTable from "@/features/workspace/components/members/components/workspace-deactivated-members-table";
import SettingsTitle from "@/components/settings/settings-title.tsx";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import WorkspaceInvitesTable from "@/features/workspace/components/members/components/workspace-invites-table.tsx";
import useUserRole from "@/hooks/use-user-role.tsx";
import { getAppName } from "@/lib/config.ts";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { useAtom } from "jotai";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";

export default function WorkspaceMembers() {
    const { t } = useTranslation();
    const [segmentValue, setSegmentValue] = useState<
        "members" | "invites" | "deactivated"
    >("members");
    const [searchParams] = useSearchParams();
    const { isAdmin } = useUserRole();
    const navigate = useNavigate();

    useEffect(() => {
        const currentTab = searchParams.get("tab");
        if (currentTab === "invites" || currentTab === "deactivated") {
            setSegmentValue(currentTab);
        }
    }, [searchParams.get("tab")]);

    const handleSegmentChange = (
        value: "members" | "invites" | "deactivated"
    ) => {
        setSegmentValue(value);
        if (value === "invites" || value === "deactivated") {
            navigate(`?tab=${value}`);
        } else {
            navigate("");
        }
    };

  return (
    <>
      <Helmet>
        <title>
          {t("Members")} - {getAppName()}
        </title>
      </Helmet>
      <SettingsTitle title={t("Members")} />

      {/* <WorkspaceInviteSection /> */}
      {/* <Divider my="lg" /> */}

            <Group justify="space-between">
                <SegmentedControl
                    value={segmentValue}
                    onChange={handleSegmentChange}
                    data={[
                        { label: t("Members"), value: "members" },
                        { label: t("Pending"), value: "invites" },
                        { label: t("Deactivated"), value: "deactivated" },
                    ]}
                    withItemsBorders={false}
                />

        {isAdmin && <WorkspaceInviteModal />}
      </Group>

      <Space h="lg" />

			{segmentValue === "members" && <WorkspaceMembersTable />}
			{segmentValue === "invites" && <WorkspaceInvitesTable />}
			{segmentValue === "deactivated" && <WorkspaceDeactivatedMembersTable />}
		</>
	);
}
