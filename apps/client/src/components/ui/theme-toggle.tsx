import {
  ActionIcon,
  Tooltip,
  useComputedColorScheme,
  useMantineColorScheme,
} from "@mantine/core";
import { IconMoon, IconSun } from "@tabler/icons-react";
import classes from "./theme-toggle.module.css";
import { useTranslation } from "react-i18next";

export function ThemeToggle() {
  const { t } = useTranslation();
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme();

  return (
    <Tooltip label={t("Toggle Color Scheme")}>
      <ActionIcon
        variant="subtle"
        color="dark"
        size="sm"
        onClick={() => {
          setColorScheme(computedColorScheme === "light" ? "dark" : "light");
        }}
        aria-label={t("Toggle Color Scheme")}
      >
        <IconSun className={classes.light} size={20} />
        <IconMoon className={classes.dark} size={20} />
      </ActionIcon>
    </Tooltip>
  );
}
