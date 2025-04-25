import {
    ActionIcon,
    Anchor,
    Button,
    Group,
    Modal,
    Switch,
    Text,
    TextInput,
    PasswordInput,
    Divider,
} from "@mantine/core";
import { IconExternalLink, IconWorld, IconLock, IconLockOpen } from "@tabler/icons-react";
import { useAtom } from "jotai";
import React, { useEffect, useMemo, useState } from "react";
import { shareAtoms } from "@/features/share/atoms/share-atoms";
import CopyTextButton from "@/components/common/copy.tsx";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { extractPageSlugId, getPageIcon } from "@/lib";
import {
  useCreateShareMutation,
  useDeleteShareMutation,
  useShareForPageQuery,
  useUpdateShareMutation,
  useSetSharePasswordMutation,
  useRemoveSharePasswordMutation,
} from "@/features/share/queries/share-query.ts";
import { getAppUrl } from "@/lib/config.ts";
import { buildPageUrl } from "@/features/page/page.utils.ts";
import classes from "@/features/share/components/share.module.css";

interface Props {
    readOnly: boolean;
}
export default function ShareModal({ readOnly }: Props) {
    const { t } = useTranslation();
    const { pageSlug } = useParams();
    const pageId = extractPageSlugId(pageSlug);
    const { data: share } = useShareForPageQuery(pageId);
    const { spaceSlug } = useParams();
    const createShareMutation = useCreateShareMutation();
    const updateShareMutation = useUpdateShareMutation();
    const deleteShareMutation = useDeleteShareMutation();
    const [isModalOpen, setModalOpen] = useAtom(shareAtoms);
    const setPasswordMutation = useSetSharePasswordMutation();
    const removePasswordMutation = useRemoveSharePasswordMutation();
    const isDescendantShared = share && share.level > 0;
    const publicLink = `${getAppUrl()}/share/${share?.key}/p/${pageSlug}`;
    const pageIsShared = share && share.level === 0;

    const [isPagePublic, setIsPagePublic] = useState<boolean>(false);
    const [password, setPassword] = useState<string>("");
    const [isPasswordProtected, setIsPasswordProtected] = useState<boolean>(false);
    useEffect(() => {
        if (share) {
            setIsPagePublic(true);
            // Check if share has password protection based on the presence of passwordHash
            setIsPasswordProtected(!!share.passwordHash);
        } else {
            setIsPagePublic(false);
            setIsPasswordProtected(false);
        }
    }, [share, pageId]);

    const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.currentTarget.checked;

        if (value) {
            createShareMutation.mutateAsync({
                pageId: pageId,
                includeSubPages: true,
                searchIndexing: false,
            });
            setIsPagePublic(value);
        } else {
            if (share && share.id) {
                deleteShareMutation.mutateAsync(share.id);
                setIsPagePublic(value);
            }
        }
    };

    const handleSubPagesChange = async (
        event: React.ChangeEvent<HTMLInputElement>,
    ) => {
        const value = event.currentTarget.checked;
        updateShareMutation.mutateAsync({
            shareId: share.id,
            includeSubPages: value,
        });
    };

    const handleIndexSearchChange = async (
        event: React.ChangeEvent<HTMLInputElement>,
    ) => {
        const value = event.currentTarget.checked;
        updateShareMutation.mutateAsync({
            shareId: share.id,
            searchIndexing: value,
        });
    };

  const handleSetPassword = async () => {
    if (password.trim()) {
      await setPasswordMutation.mutateAsync({
        shareId: share.id,
        password: password.trim(),
      });
      setIsPasswordProtected(true);
      setPassword("");
    }
    };

    const shareLink = useMemo(() => (
        <Group my="sm" gap={4} wrap="nowrap">
            <TextInput
                variant="filled"
                value={publicLink}
                readOnly
                rightSection={<CopyTextButton text={publicLink} />}
                style={{ width: "100%" }}
            />
            <ActionIcon
                component="a"
                variant="default"
                target="_blank"
                href={publicLink}
                size="sm"
            >
                <IconExternalLink size={16} />
            </ActionIcon>
        </Group>
    ), [publicLink]);
    return (
        <>
            <Modal.Root size={400} opened={isModalOpen} onClose={() => setModalOpen(false)}>
                <Modal.Overlay />
                <Modal.Content style={{ overflow: "hidden" }}>
                    <Modal.Header>
                        <Modal.Title>
                            <Text size="md" fw={500} >
                                {t("Share")}
                            </Text>
                        </Modal.Title>
                        <Modal.CloseButton />
                    </Modal.Header>
                    <Modal.Body>
                        {isDescendantShared ? (
                            <>
                                <Text size="sm">{t("Inherits public sharing from")}</Text>
                                <Anchor
                                    size="sm"
                                    underline="never"
                                    style={{
                                        cursor: "pointer",
                                        color: "var(--mantine-color-text)",
                                    }}
                                    component={Link}
                                    to={buildPageUrl(
                                        spaceSlug,
                                        share.sharedPage.slugId,
                                        share.sharedPage.title,
                                    )}
                                >
                                    <Group gap="4" wrap="nowrap" my="sm">
                                        {getPageIcon(share.sharedPage.icon)}
                                        <div className={classes.shareLinkText}>
                                            <Text fz="sm" fw={500} lineClamp={1}>
                                                {share.sharedPage.title || t("untitled")}
                                            </Text>
                                        </div>
                                    </Group>
                                </Anchor>

                                {shareLink}
                            </>
                        ) : (
                            <>
                                <Group justify="space-between" wrap="nowrap" gap="xl">
                                    <div>
                                        <Text size="sm">
                                            {isPagePublic ? t("Shared to web") : t("Share to web")}
                                        </Text>
                                        <Text size="xs" c="dimmed">
                                            {isPagePublic
                                                ? t("Anyone with the link can view this page")
                                                : t("Make this page publicly accessible")}
                                        </Text>
                                    </div>
                                    <Switch
                                        onChange={handleChange}
                                        defaultChecked={isPagePublic}
                                        disabled={readOnly}
                                        size="xs"
                                    />
                                </Group>

                                {pageIsShared && (
                                    <>
                                        {shareLink}
                                        <Group justify="space-between" wrap="nowrap" gap="xl">
                                            <div>
                                                <Text size="sm">{t("Include sub-pages")}</Text>
                                                <Text size="xs" c="dimmed">
                                                    {t("Make sub-pages public too")}
                                                </Text>
                                            </div>

                                            <Switch
                                                onChange={handleSubPagesChange}
                                                checked={share.includeSubPages}
                                                size="xs"
                                                disabled={readOnly}
                                            />
                                        </Group>
                                        <Group justify="space-between" wrap="nowrap" gap="xl" mt="sm">
                                            <div>
                                                <Text size="sm">{t("Search engine indexing")}</Text>
                                                <Text size="xs" c="dimmed">
                                                    {t("Allow search engines to index page")}
                                                </Text>
                                            </div>
                                            <Switch
                                                onChange={handleIndexSearchChange}
                                                checked={share.searchIndexing}
                                                size="xs"
                                                disabled={readOnly}
                                            />
                                        </Group>

                                        <Divider my="sm" />
                        
                                        <Group justify="space-between" wrap="nowrap" gap="xl">
                                            <div>
                                            <Text size="sm">{t("Password protection")}</Text>
                                            <Text size="xs" c="dimmed">
                                                {t("Require password to access this page")}
                                            </Text>
                                            </div>
                                        </Group>
                        
                                        {isPasswordProtected ? (
                                            <Group justify="space-between" align="center" mt="xs">
                                            <Text size="xs" c="dimmed" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                                <IconLock size={12} />
                                                {t("Password protected")}
                                            </Text>
                                            <Button
                                                size="xs"
                                                variant="subtle"
                                                color="red"
                                                onClick={() => removePasswordMutation.mutateAsync(share.id)}
                                                disabled={readOnly}
                                            > {/* TODO: canManage */}
                                                {t("Remove password")}
                                            </Button>
                                            </Group>
                                        ) : (
                                            <Group mt="xs" gap="xs">
                                            <PasswordInput
                                                placeholder={t("Enter password")}
                                                value={password}
                                                onChange={(event) => setPassword(event.currentTarget.value)}
                                                size="xs"
                                                style={{ flex: 1 }}
                                                disabled={readOnly}
                                            />
                                            <Button
                                                size="xs"
                                                onClick={handleSetPassword}
                                                disabled={!password.trim() || readOnly}
                                            >
                                                {t("Set password")}
                                            </Button>
                                            </Group>
                                        )}
                                    </>
                                )}
                            </>
                        )}
                    </Modal.Body>
                </Modal.Content>
            </Modal.Root>
        </>
    );
}
