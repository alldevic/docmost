import { Loader, Modal, Center } from "@mantine/core";
import { accessAtoms } from "@/ee/page-permission/atoms/access-atoms";
import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { extractPageSlugId } from "@/lib";
import { usePageQuery } from "@/features/page/queries/page-query";
import { usePageRestrictionInfoQuery } from "@/ee/page-permission/queries/page-permission-query";
import { PagePermissionTab } from "@/ee/page-permission";
import { useAtom } from "jotai";

export function PageAccessModal() {
  const { t } = useTranslation();
  const { pageSlug, spaceSlug } = useParams();
  const pageSlugId = extractPageSlugId(pageSlug);
  const [isModalOpen, setModalOpen] = useAtom(accessAtoms);
  const { data: page } = usePageQuery({ pageId: pageSlugId });
  const pageId = page?.id;

  const { data: restrictionInfo, isLoading: restrictionLoading } =
    usePageRestrictionInfoQuery(isModalOpen ? pageId : undefined);

  return (
    <Modal opened={isModalOpen} onClose={() => setModalOpen(false)} title={t("Page access")} size={600}>
      {restrictionLoading || !pageId || !restrictionInfo ? (
        <Center py="xl">
          <Loader size="sm" />
        </Center>
      ) : (
        <PagePermissionTab pageId={pageId} restrictionInfo={restrictionInfo} />
      )}
    </Modal>
  );
}
