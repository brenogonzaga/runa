import { Extension } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import { ReactRenderer } from "@tiptap/react";
import Suggestion from "@tiptap/suggestion";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import type { Editor as TiptapEditor } from "@tiptap/core";
import type { ReactNode } from "react";
import {
  PilcrowIcon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  Heading4Icon,
  ListIcon,
  ListOrderedIcon,
  CheckSquareIcon,
  QuoteIcon,
  CodeIcon,
  SeparatorIcon,
  ImageIcon,
  TableIcon,
  BracketsIcon,
} from "../icons";
import { SlashCommandList, type SlashCommandListRef } from "./SlashCommandList";

export interface SlashCommandItem {
  titleKey: string;
  descriptionKey: string;
  icon: ReactNode;
  aliases: string[];
  command: (editor: TiptapEditor) => void;
}

const SLASH_COMMANDS: SlashCommandItem[] = [
  {
    titleKey: "slashCommands.text",
    descriptionKey: "slashCommands.textDesc",
    icon: <PilcrowIcon />,
    aliases: ["paragraph", "body", "plain", "normal", "text"],
    command: (editor) => {
      editor.chain().focus().setParagraph().run();
    },
  },
  {
    titleKey: "slashCommands.heading1",
    descriptionKey: "slashCommands.heading1Desc",
    icon: <Heading1Icon />,
    aliases: ["h1", "heading", "title", "heading 1"],
    command: (editor) => {
      editor.chain().focus().toggleHeading({ level: 1 }).run();
    },
  },
  {
    titleKey: "slashCommands.heading2",
    descriptionKey: "slashCommands.heading2Desc",
    icon: <Heading2Icon />,
    aliases: ["h2", "heading", "subtitle", "heading 2"],
    command: (editor) => {
      editor.chain().focus().toggleHeading({ level: 2 }).run();
    },
  },
  {
    titleKey: "slashCommands.heading3",
    descriptionKey: "slashCommands.heading3Desc",
    icon: <Heading3Icon />,
    aliases: ["h3", "heading", "heading 3"],
    command: (editor) => {
      editor.chain().focus().toggleHeading({ level: 3 }).run();
    },
  },
  {
    titleKey: "slashCommands.heading4",
    descriptionKey: "slashCommands.heading4Desc",
    icon: <Heading4Icon />,
    aliases: ["h4", "heading", "heading 4"],
    command: (editor) => {
      editor.chain().focus().toggleHeading({ level: 4 }).run();
    },
  },
  {
    titleKey: "slashCommands.bulletList",
    descriptionKey: "slashCommands.bulletListDesc",
    icon: <ListIcon />,
    aliases: ["ul", "unordered", "list", "bullet list"],
    command: (editor) => {
      editor.chain().focus().toggleBulletList().run();
    },
  },
  {
    titleKey: "slashCommands.numberedList",
    descriptionKey: "slashCommands.numberedListDesc",
    icon: <ListOrderedIcon />,
    aliases: ["ol", "ordered", "list", "numbered", "numbered list"],
    command: (editor) => {
      editor.chain().focus().toggleOrderedList().run();
    },
  },
  {
    titleKey: "slashCommands.taskList",
    descriptionKey: "slashCommands.taskListDesc",
    icon: <CheckSquareIcon />,
    aliases: ["todo", "checklist", "checkbox", "task list"],
    command: (editor) => {
      editor.chain().focus().toggleTaskList().run();
    },
  },
  {
    titleKey: "slashCommands.blockquote",
    descriptionKey: "slashCommands.blockquoteDesc",
    icon: <QuoteIcon />,
    aliases: ["quote", "blockquote"],
    command: (editor) => {
      editor.chain().focus().toggleBlockquote().run();
    },
  },
  {
    titleKey: "slashCommands.codeBlock",
    descriptionKey: "slashCommands.codeBlockDesc",
    icon: <CodeIcon />,
    aliases: ["code", "fenced", "pre", "code block"],
    command: (editor) => {
      editor.chain().focus().toggleCodeBlock().run();
    },
  },
  {
    titleKey: "slashCommands.horizontalRule",
    descriptionKey: "slashCommands.horizontalRuleDesc",
    icon: <SeparatorIcon />,
    aliases: ["divider", "separator", "hr", "line", "horizontal rule"],
    command: (editor) => {
      editor.chain().focus().setHorizontalRule().run();
    },
  },
  {
    titleKey: "slashCommands.image",
    descriptionKey: "slashCommands.imageDesc",
    icon: <ImageIcon />,
    aliases: ["picture", "photo", "img", "image"],
    command: (editor) => {
      editor.chain().focus().run();
      window.dispatchEvent(new CustomEvent("slash-command-image"));
    },
  },
  {
    titleKey: "slashCommands.table",
    descriptionKey: "slashCommands.tableDesc",
    icon: <TableIcon />,
    aliases: ["grid", "table"],
    command: (editor) => {
      editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    },
  },
  {
    titleKey: "slashCommands.wikilink",
    descriptionKey: "slashCommands.wikilinkDesc",
    icon: <BracketsIcon />,
    aliases: ["link", "note", "wikilink", "[["],
    command: (editor) => {
      editor.chain().focus().insertContent("[[").run();
    },
  },
];

const slashCommandPluginKey = new PluginKey("slashCommand");

export const SlashCommand = Extension.create({
  name: "slashCommand",

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashCommandItem>({
        editor: this.editor,
        char: "/",
        pluginKey: slashCommandPluginKey,
        allowSpaces: false,
        startOfLine: true,

        allow: ({ editor }) => {
          return !editor.isActive("codeBlock") && !editor.isActive("frontmatter");
        },

        items: ({ query }) => {
          const q = query.toLowerCase();
          return SLASH_COMMANDS.filter((item) =>
            item.aliases.some((alias) => alias.includes(q)),
          );
        },

        command: ({ editor, range, props: item }) => {
          editor.chain().focus().deleteRange(range).run();
          item.command(editor);
        },

        render: () => {
          let component: ReactRenderer<SlashCommandListRef> | null = null;
          let popup: TippyInstance | null = null;

          return {
            onStart: (props) => {
              component = new ReactRenderer(SlashCommandList, {
                props: {
                  items: props.items,
                  command: props.command,
                },
                editor: props.editor,
              });

              popup = tippy(document.body, {
                getReferenceClientRect: () => props.clientRect?.() ?? new DOMRect(),
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: "manual",
                placement: "bottom-start",
                offset: [0, 4],
                popperOptions: {
                  modifiers: [
                    {
                      name: "flip",
                      options: { fallbackPlacements: ["top-start"] },
                    },
                  ],
                },
              });
            },

            onUpdate: (props) => {
              component?.updateProps({
                items: props.items,
                command: props.command,
              });

              popup?.setProps({
                getReferenceClientRect: () => props.clientRect?.() ?? new DOMRect(),
              });
            },

            onKeyDown: (props) => {
              if (props.event.key === "Escape") {
                popup?.hide();
                return true;
              }
              return component?.ref?.onKeyDown(props) ?? false;
            },

            onExit: () => {
              popup?.destroy();
              component?.destroy();
              popup = null;
              component = null;
            },
          };
        },
      }),
    ];
  },
});
