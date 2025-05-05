import {
	Group,
	Table,
	Text,
	Badge,
	Button,
	Popover,
	Box,
	Flex,
	Tooltip,
} from "@mantine/core";
import {
	useChangeMemberRoleMutation,
	useDeactivateUserMutation,
	useWorkspaceMembersQuery,
} from "@/features/workspace/queries/workspace-query.ts";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import React, { useCallback, useRef, useState, FC } from "react";
import RoleSelectMenu from "@/components/ui/role-select-menu.tsx";
import {
  getUserRoleLabel,
  userRoleData,
} from "@/features/workspace/types/user-role-data.ts";
import useUserRole from "@/hooks/use-user-role.tsx";
import { IRoleData, UserRole } from "@/lib/types.ts";
import { useTranslation } from "react-i18next";
import Paginate from "@/components/common/paginate.tsx";
import { SearchInput } from "@/components/common/search-input.tsx";
import NoTableResults from "@/components/common/no-table-results.tsx";
import { usePaginateAndSearch } from "@/hooks/use-paginate-and-search.tsx";
import MemberActionMenu from "@/features/workspace/components/members/components/members-action-menu.tsx";
import { IconLock } from "@tabler/icons-react";
import { ICurrentUser, IUser } from "../../../../user/types/user.types";
import { useDisclosure } from "@mantine/hooks";
import { useAtom } from "jotai";
import { currentUserAtom } from "../../../../user/atoms/current-user-atom";

interface WorkspaceMembersTableRowProps {
	user: IUser;
	assignableUserRoles: IRoleData[];
	handleRoleChange: (
		userId: string,
		currentRole: string,
		newRole: string
	) => Promise<void>;
	isAdmin: boolean;
	isOwner: boolean;
	currentUser: ICurrentUser;
}

const WorkspaceMembersTableRow: FC<WorkspaceMembersTableRowProps> = ({
	user,
	assignableUserRoles,
	handleRoleChange,
	isAdmin,
	isOwner,
	currentUser,
}) => {
	const { t } = useTranslation();
	const [opened, { open, close }] = useDisclosure(false);
	const deactivateUserMutation = useDeactivateUserMutation();

	const handleDelete = async (userId: string) => {
		if (userId && currentUser?.workspace?.id)
			await deactivateUserMutation.mutateAsync({
				userId,
				workspaceId: currentUser?.workspace?.id,
			});
	};

	return (
		<Table.Tr>
			<Table.Td>
				<Group gap="sm">
					<CustomAvatar avatarUrl={user.avatarUrl} name={user.name} />
					<div>
						<Text fz="sm" fw={500}>
							{user.name}
						</Text>
						<Text fz="xs" c="dimmed">
							{user.email}
						</Text>
					</div>
				</Group>
			</Table.Td>

			<Table.Td>
				<Badge variant="light">Active</Badge>
			</Table.Td>

			<Table.Td>
				<RoleSelectMenu
					roles={assignableUserRoles}
					roleName={getUserRoleLabel(user.role)}
					onChange={newRole => handleRoleChange(user.id, user.role, newRole)}
					disabled={!isAdmin}
				/>
			</Table.Td>
			{(isOwner || isAdmin) && (
				<Table.Td>
					<Popover
						position="bottom"
						withArrow
						shadow="md"
						opened={opened}
						onClose={close}
					>
						<Popover.Target>
							<Button
								variant="subtle"
								color="red"
								onClick={open}
								disabled={
									currentUser.user.role === UserRole.ADMIN && user.role === UserRole.OWNER
								}
							>
								<Tooltip label={t("Deactivate member")}>
									<IconLock size={20} />
								</Tooltip>
							</Button>
						</Popover.Target>
						<Popover.Dropdown>
							<Text>{t("Do you want to deactivate this member?")}</Text>
							<Flex justify={"space-evenly"} align={"center"} mt={8}>
								<Button variant="outline" onClick={close}>
									{t("Cancel")}
								</Button>
								<Button color="red" onClick={() => handleDelete(user?.id)}>
									{t("Confirm")}
								</Button>
							</Flex>
						</Popover.Dropdown>
					</Popover>
				</Table.Td>
			)}
		</Table.Tr>
	);
};

export default function WorkspaceMembersTable() {
  const { t } = useTranslation();
  const { search, page, setPage, handleSearch } = usePaginateAndSearch();
  const { data, isLoading } = useWorkspaceMembersQuery({
    page,
    limit: 100,
    query: search,
  });
  const changeMemberRoleMutation = useChangeMemberRoleMutation();
  const { isAdmin, isOwner } = useUserRole();
  const [currentUser] = useAtom(currentUserAtom);

  const assignableUserRoles = isOwner
    ? userRoleData
    : userRoleData.filter((role) => role.value !== UserRole.OWNER);

  const handleRoleChange = async (
    userId: string,
    currentRole: string,
    newRole: string,
  ) => {
    if (newRole === currentRole) {
      return;
    }

    const memberRoleUpdate = {
      userId: userId,
      role: newRole,
    };

    await changeMemberRoleMutation.mutateAsync(memberRoleUpdate);
  };

  return (
    <>
      <SearchInput onSearch={handleSearch} />
      <Table.ScrollContainer minWidth={500}>
        <Table highlightOnHover verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t("User")}</Table.Th>
              <Table.Th>{t("Status")}</Table.Th>
              <Table.Th>{t("Role")}</Table.Th>
              {(isOwner || isAdmin) && <Table.Th>{t("Action")}</Table.Th>}
            </Table.Tr>
          </Table.Thead>

          <Table.Tbody>
            {data?.items.length > 0 ? (
              data?.items.map((user, index) => (
				<WorkspaceMembersTableRow
				key={index}
				user={user}
				assignableUserRoles={assignableUserRoles}
				isAdmin={isAdmin}
				isOwner={isOwner}
				handleRoleChange={handleRoleChange}
				currentUser={currentUser}
			/>
              ))
            ) : (
              <NoTableResults colSpan={3} />
            )}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      {data?.items.length > 0 && (
        <Paginate
          currentPage={page}
          hasPrevPage={data?.meta.hasPrevPage}
          hasNextPage={data?.meta.hasNextPage}
          onPageChange={setPage}
        />
      )}
    </>
  );
}
