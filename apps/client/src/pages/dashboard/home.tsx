import { Container, Space } from "@mantine/core";
import HomeTabs from "@/features/home/components/home-tabs";
// import HomeAiPrompt from "@/features/home/components/home-ai-prompt";
// import SpaceCarousel from "@/features/space/components/space-carousel.tsx";
import SpaceGrid from "@/features/space/components/space-grid.tsx";
import { getAppName } from "@/lib/config.ts";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";

export default function Home() {
  const { t } = useTranslation();

  return (
    <>
      <Helmet>
        <title>
          {t("Home")} - {getAppName()}
        </title>
      </Helmet>
      <Container size={"900"} pt="xl">
        {/* <HomeAiPrompt />

        <Space h="xl" /> */}

        <SpaceGrid />

        <Space h="xl" />

        <HomeTabs />
      </Container>
    </>
  );
}
