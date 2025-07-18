import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { useMemo } from "react";
import clsx from "clsx";
import {
  ActionIcon,
  AspectRatio,
  Button,
  Card,
  FocusTrap,
  Group,
  NumberInput,
  Popover,
  Text,
  TextInput,
} from "@mantine/core";
import { IconEdit } from "@tabler/icons-react";
import { z } from "zod";
import { useForm, zodResolver } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import i18n from "i18next";
import {
  getEmbedProviderById,
  getEmbedUrlAndProvider,
} from "@docmost/editor-ext";
import { NodeHeightResize } from '@/features/editor/components/common/node-height-resize';

const schema = z.object({
  url: z
    .string()
    .trim()
    .url({ message: i18n.t("Please enter a valid url") }),
});

export default function EmbedView(props: NodeViewProps) {
  const { t } = useTranslation();
  const { node, selected, updateAttributes, editor } = props;
  const { src, provider, height } = node.attrs;

  const embedUrl = useMemo(() => {
    if (src) {
      return getEmbedUrlAndProvider(src).embedUrl;
    }
    return null;
  }, [src]);

  const embedForm = useForm<{ url: string }>({
    initialValues: {
      url: "",
    },
    validate: zodResolver(schema),
  });

  async function onSubmit(data: { url: string }) {
    if (!editor.isEditable) {
      return;
    }

    if (provider) {
      const embedProvider = getEmbedProviderById(provider);
      if (embedProvider.id === "iframe") {
        updateAttributes({ src: data.url });
        return;
      }
      if (embedProvider.regex.test(data.url)) {
        updateAttributes({ src: data.url });
      } else {
        notifications.show({
          message: t("Invalid {{provider}} embed link", {
            provider: embedProvider.name,
          }),
          position: "top-right",
          color: "red",
        });
      }
    }
  }

  return (
    <NodeViewWrapper>
      {embedUrl ? (
        <>
          {selected && (
            <Group gap="xs" mt={4} style={{ alignItems: 'center', justifyContent: 'left'}}>
              <NumberInput
                value={height}
                onChange={(value) => {
                  const heightValue = typeof value === 'string' ? parseInt(value) : value;
                  updateAttributes({ height: heightValue || null });
                }}
                min={100}
                size="xs"
                style={{ width: 60,}}
                placeholder="Height"
              />
              <NodeHeightResize
                onChange={(value) => updateAttributes({ height: value })}
                value={height}
              />
            </Group>
          )}
          <AspectRatio 
            ratio={height ? undefined : 16 / 9} 
            style={{ 
              height: height ? height : undefined,
              transition: 'height 0.2s ease-out',
            }}
          >
            <iframe
              src={embedUrl}
              allow="encrypted-media"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              allowFullScreen
              frameBorder="0"
              style={{ 
                height: '100%',
                width: '100%',
                borderRadius: '8px',
                overflow: 'hidden'
              }}
            ></iframe>
          </AspectRatio>
        </>
      ) : (
        <Popover
          width={300}
          position="bottom"
          withArrow
          shadow="md"
          disabled={!editor.isEditable}
        >
          <Popover.Target>
            <Card
              radius="md"
              p="xs"
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
              withBorder
              className={clsx(selected ? "ProseMirror-selectednode" : "")}
            >
              <div style={{ display: "flex", alignItems: "center" }}>
                <ActionIcon variant="transparent" color="gray">
                  <IconEdit size={18} />
                </ActionIcon>

                <Text component="span" size="lg" c="dimmed">
                  {t("Embed {{provider}}", {
                    provider: getEmbedProviderById(provider)?.name,
                  })}
                </Text>
              </div>
            </Card>
          </Popover.Target>
          <Popover.Dropdown bg="var(--mantine-color-body)">
            <form onSubmit={embedForm.onSubmit(onSubmit)}>
              <FocusTrap active={true}>
                <TextInput
                  placeholder={t("Enter {{provider}} link to embed", {
                    provider: getEmbedProviderById(provider).name,
                  })}
                  key={embedForm.key("url")}
                  {...embedForm.getInputProps("url")}
                  data-autofocus
                />
              </FocusTrap>

              <Group justify="center" mt="xs">
                <Button type="submit">{t("Embed link")}</Button>
              </Group>
            </form>
          </Popover.Dropdown>
        </Popover>
      )}
    </NodeViewWrapper>
  );
}
