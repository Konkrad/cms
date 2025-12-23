import { component$, type QRL } from "@builder.io/qwik";
import { qwikify$ } from "@builder.io/qwik-react";
import React, { Suspense } from "react";

// Lazy load the React component to avoid SSR import issues with document access
const LazyKoenigEditorReact = React.lazy(() => import("./KoenigEditorReact"));

const ReactLoader = (props: any) => {
  return React.createElement(
    Suspense,
    {
      fallback: React.createElement(
        "div",
        {
          className:
            "flex items-center justify-center p-8 bg-gray-50 rounded-lg border border-gray-200",
        },
        React.createElement(
          "div",
          { className: "text-gray-500" },
          "Loading editor...",
        ),
      ),
    },
    React.createElement(LazyKoenigEditorReact, props),
  );
};

const QwikKoenigEditor = qwikify$(ReactLoader, {
  eagerness: "visible",
  clientOnly: true,
});

interface KoenigEditorProps {
  content: string;
  editorState?: string | null;
  onChange$: QRL<(content: string, editorState: string) => void>;
  uploadUrl?: string;
}

export const KoenigEditor = component$<KoenigEditorProps>(
  ({ content, editorState, onChange$, uploadUrl }) => {
    return (
      <div class="koenig-editor-container">
        <QwikKoenigEditor
          content={content}
          editorState={editorState}
          onChange$={onChange$}
          uploadUrl={uploadUrl}
        />
      </div>
    );
  },
);

export default KoenigEditor;
