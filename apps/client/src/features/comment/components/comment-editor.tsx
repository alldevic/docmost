import { EditorContent, ReactNodeViewRenderer, useEditor } from "@tiptap/react";
import { Placeholder } from "@tiptap/extension-placeholder";
import { StarterKit } from "@tiptap/starter-kit";
import { Mention, LinkExtension } from "@docmost/editor-ext";
import classes from "./comment.module.css";
import { useFocusWithin } from "@mantine/hooks";
import clsx from "clsx";
import {
  FC,
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import EmojiCommand from "@/features/editor/extensions/emoji-command";
import mentionRenderItems from "@/features/editor/components/mention/mention-suggestion";
import MentionView from "@/features/editor/components/mention/mention-view";
import {
  IconTypography,
  IconH1,
  IconH2,
  IconH3,
  IconCheckbox,
  IconList,
  IconListNumbers,
  IconBlockquote,
  IconBold,
  IconCode,
  IconItalic,
  IconStrikethrough,
  IconUnderline,
} from "@tabler/icons-react";
import { ActionIcon, rem, Tooltip } from "@mantine/core";
import { Color } from "@tiptap/extension-color";
import { TaskList, TaskItem } from "@tiptap/extension-list";
import { Highlight } from "@tiptap/extension-highlight";
import { TextStyle } from "@tiptap/extension-text-style";
import { platformModifierKey } from "@/lib";

interface CommentEditorProps {
  defaultContent?: any;
  onUpdate?: any;
  onSave?: any;
  editable: boolean;
  placeholder?: string;
  autofocus?: boolean;
}
interface MenuItem {
  name: string;
  isActive: () => boolean;
  command: () => void;
  icon: typeof IconBold;
}

type EditorMenuProps = {
  editor: ReturnType<typeof useEditor>;
};

const MenuBar: FC<EditorMenuProps> = (props) => {
  if (!props.editor) {
    return null;
  }

  const { t } = useTranslation();

  const items: MenuItem[] = [
    {
      name: "Bold",
      isActive: () => props.editor.isActive("bold"),
      command: () => props.editor.chain().focus().toggleBold().run(),
      icon: IconBold,
    },
    {
      name: "Italic",
      isActive: () => props.editor.isActive("italic"),
      command: () => props.editor.chain().focus().toggleItalic().run(),
      icon: IconItalic,
    },
    {
      name: "Underline",
      isActive: () => props.editor.isActive("underline"),
      command: () => props.editor.chain().focus().toggleUnderline().run(),
      icon: IconUnderline,
    },
    {
      name: "Strike",
      isActive: () => props.editor.isActive("strike"),
      command: () => props.editor.chain().focus().toggleStrike().run(),
      icon: IconStrikethrough,
    },
    {
      name: "Code",
      isActive: () => props.editor.isActive("code"),
      command: () => props.editor.chain().focus().toggleCode().run(),
      icon: IconCode,
    },
    {
      name: "To-do List",
      icon: IconCheckbox,
      command: () => props.editor.chain().focus().toggleTaskList().run(),
      isActive: () => props.editor.isActive("taskItem"),
    },
    {
      name: "Bullet List",
      icon: IconList,
      command: () => props.editor.chain().focus().toggleBulletList().run(),
      isActive: () => props.editor.isActive("bulletList"),
    },
    {
      name: "Numbered List",
      icon: IconListNumbers,
      command: () => props.editor.chain().focus().toggleOrderedList().run(),
      isActive: () => props.editor.isActive("orderedList"),
    },
    {
      name: "Blockquote",
      icon: IconBlockquote,
      command: () =>
        props.editor
          .chain()
          .focus()
          .toggleNode("paragraph", "paragraph")
          .toggleBlockquote()
          .run(),
      isActive: () => props.editor.isActive("blockquote"),
    },
  ];

  return (
    props.editor.isEditable &&
    props.editor.isFocused && (
      <ActionIcon.Group className={classes.bubbleMenu}>
        {items.map((item, index) => (
          <Tooltip key={index} label={t(item.name)} withArrow>
            <ActionIcon
              key={index}
              variant="default"
              size="lg"
              radius="0"
              aria-label={t(item.name)}
              className={clsx({ [classes.active]: item.isActive() })}
              style={{ border: "none" }}
              onClick={item.command}
            >
              <item.icon style={{ width: rem(16) }} stroke={2} />
            </ActionIcon>
          </Tooltip>
        ))}
      </ActionIcon.Group>
    )
  );
};

const CommentEditor = forwardRef(
  (
    {
      defaultContent,
      onUpdate,
      onSave,
      editable,
      placeholder,
      autofocus,
    }: CommentEditorProps,
    ref,
  ) => {
    const { t } = useTranslation();
    const { ref: focusRef, focused } = useFocusWithin();

    const commentEditor = useEditor({
      extensions: [
        StarterKit.configure({
          gapcursor: false,
          dropcursor: false,
          link: false,
        }),
        Placeholder.configure({
          placeholder: placeholder || t("Reply..."),
        }),
        LinkExtension,
        EmojiCommand,
        Mention.configure({
          suggestion: {
            allowSpaces: true,
            items: () => [],
            // @ts-ignore
            render: mentionRenderItems,
          },
          HTMLAttributes: {
            class: "mention",
          },
        }).extend({
          addNodeView() {
            this.editor.isInitialized = true;
            return ReactNodeViewRenderer(MentionView);
          },
        }),
        TaskList,
        TaskItem.configure({
          nested: true,
        }),
        Color,
        Highlight.configure({
          multicolor: true,
        }),
        TextStyle,
      ],
      editorProps: {
        handleDOMEvents: {
          keydown: (_view, event) => {
            if (
              [
                "ArrowUp",
                "ArrowDown",
                "ArrowLeft",
                "ArrowRight",
                "Enter",
              ].includes(event.key)
            ) {
              const emojiCommand = document.querySelector("#emoji-command");
              const mentionPopup = document.querySelector("#mention");
              if (emojiCommand || mentionPopup) {
                return true;
              }
            }

            if (platformModifierKey(event) && event.code === "Enter") {
              event.preventDefault();
              if (onSave) onSave();

              return true;
            }
          },
        },
      },
      onUpdate({ editor }) {
        if (onUpdate) onUpdate(editor.getJSON());
      },
      content: defaultContent,
      editable,
      immediatelyRender: true,
      shouldRerenderOnTransaction: false,
      autofocus: (autofocus && "end") || false,
    });

    // Sync content from props for read-only editors (e.g. when updated via
    // websocket on another browser). Skip for editable editors to avoid
    // resetting the cursor position on every keystroke.
    useEffect(() => {
      if (!editable && commentEditor && defaultContent) {
        commentEditor.commands.setContent(defaultContent);
      }
    }, [defaultContent, editable, commentEditor]);

    useEffect(() => {
      setTimeout(() => {
        if (autofocus) {
          commentEditor?.commands.focus("end");
        }
      }, 10);
    }, [commentEditor, autofocus]);

    useImperativeHandle(ref, () => ({
      clearContent: () => {
        commentEditor.commands.clearContent();
      },
    }));

    return (
      <div
        ref={focusRef}
        className={classes.commentEditor}
        data-editable={editable || undefined}
      >
        <MenuBar editor={commentEditor} />
        <EditorContent
          editor={commentEditor}
          className={clsx(classes.ProseMirror, { [classes.focused]: focused })}
        />
      </div>
    );
  },
);

export default CommentEditor;
