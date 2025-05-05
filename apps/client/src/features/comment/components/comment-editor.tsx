import { EditorContent, useEditor } from "@tiptap/react";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Underline } from "@tiptap/extension-underline";
import { Link } from "@tiptap/extension-link";
import { StarterKit } from "@tiptap/starter-kit";
import classes from "./comment.module.css";
import { useFocusWithin } from "@mantine/hooks";
import clsx from "clsx";
import { FC, forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { useTranslation } from "react-i18next";
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
import { ColorSelector } from "@/features/editor/components/bubble-menu/color-selector";
import { LinkSelector } from "@/features/editor/components/bubble-menu/link-selector.tsx";
import { Color } from "@tiptap/extension-color";
import { TaskList } from "@tiptap/extension-task-list";
import { TaskItem } from "@tiptap/extension-task-item";
import { Highlight } from "@tiptap/extension-highlight";
import { TextStyle } from "@tiptap/extension-text-style";
import EmojiCommand from "@/features/editor/extensions/emoji-command";

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
    return null
  }

  const { t } = useTranslation();

  const items: MenuItem[] = [
    {
      name: "Text",
      icon: IconTypography,
      command: () =>
        props.editor.chain().focus().toggleNode("paragraph", "paragraph").run(),
      isActive: () =>
        props.editor.isActive("paragraph") &&
        !props.editor.isActive("bulletList") &&
        !props.editor.isActive("orderedList"),
    },
    {
      name: "Heading 2",
      icon: IconH2,
      command: () => props.editor.chain().focus().toggleHeading({ level: 2 }).run(),
      isActive: () => props.editor.isActive("heading", { level: 2 }),
    },
    {
      name: "Heading 3",
      icon: IconH3,
      command: () => props.editor.chain().focus().toggleHeading({ level: 3 }).run(),
      isActive: () => props.editor.isActive("heading", { level: 3 }),
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
  ];

  const [isLinkSelectorOpen, setIsLinkSelectorOpen] = useState(false);
  const [isColorSelectorOpen, setIsColorSelectorOpen] = useState(false);

  return (
    props.editor.isEditable && props.editor.isActive &&
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
      <LinkSelector
        editor={props.editor}
        isOpen={isLinkSelectorOpen}
        setIsOpen={() => {
          setIsLinkSelectorOpen(!isLinkSelectorOpen);
          setIsColorSelectorOpen(false);
        }}
      />
      <ColorSelector
        editor={props.editor}
        isOpen={isColorSelectorOpen}
        setIsOpen={() => {
          setIsLinkSelectorOpen(false);
          setIsColorSelectorOpen(!isColorSelectorOpen);
        }}
      />
    </ActionIcon.Group>
  )
}

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
        }),
        Placeholder.configure({
          placeholder: placeholder || t("Reply..."),
        }),
        Underline,
        Link,
        TaskList,
        TaskItem.configure({
          nested: true,
        }),
        Color,
        Highlight.configure({
          multicolor: true,
        }),
        TextStyle,
        EmojiCommand,
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
              if (emojiCommand) {
                return true;
              }
            }

            if (event.ctrlKey && event.key === 'Enter') {
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
      <>
        <div ref={focusRef} className={classes.commentEditor}>
          <MenuBar editor={commentEditor} />
          <EditorContent
            editor={commentEditor}
            className={clsx(classes.ProseMirror, { [classes.focused]: focused })}
          />
        </div>
      </>
    );
  },
);

export default CommentEditor;
