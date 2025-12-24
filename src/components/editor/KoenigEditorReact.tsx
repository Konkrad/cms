/** @jsxImportSource react */
import React, {
  useCallback,
  useState,
  useMemo,
  useImperativeHandle,
  forwardRef,
  useRef,
  type ReactElement,
} from "react";
import {
  KoenigComposer,
  KoenigEditor as KoenigEditorComponent,
  type EditorAPI,
} from "@tryghost/koenig-lexical";

interface KoenigEditorProps {
  content: string;
  editorState: string | null;
  onChange: (content: string, editorState: string) => void;
  uploadUrl?: string;
}

export interface KoenigEditorRef {
  getEditorState: () => string;
}

function createFileUploadHook(uploadUrl: string) {
  return function useFileUpload() {
    const [progress, setProgress] = useState(100);
    const [isLoading, setIsLoading] = useState(false);
    const [errors, setErrors] = useState<
      Array<{ fileName: string; message: string }>
    >([]);
    const [filesNumber, setFilesNumber] = useState(0);

    const upload = useCallback(async (files: File[]) => {
      setFilesNumber(files.length);
      setIsLoading(true);
      setProgress(30);
      setErrors([]);

      const results = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        if (i === 0) {
          setProgress(60);
        } else if (i === Math.floor(files.length / 2)) {
          setProgress(80);
        }

        try {
          const response = await fetch(`${uploadUrl}?pipeline=original`, {
            method: "POST",
            body: file,
            headers: {
              "Content-Type": file.type,
            },
          });

          if (!response.ok) {
            throw new Error(`Upload failed: ${response.statusText}`);
          }

          const result = await response.json();

          if (result.success) {
            results.push({
              url: result.data.url,
              src: result.data.url,
              fileName: file.name,
            });
          } else {
            throw new Error(result.error || "Upload failed");
          }
        } catch (error) {
          setErrors((prev) => [
            ...prev,
            { fileName: file.name, message: String(error) },
          ]);
        }
      }

      setIsLoading(false);
      setProgress(100);
      return results;
    }, []);

    return { progress, isLoading, errors, upload, filesNumber };
  };
}

const KoenigEditorReact = (
  {
    content,
    editorState,
    onChange,
    uploadUrl = "/api/images",
  }: KoenigEditorProps,
  ref: React.ForwardedRef<KoenigEditorRef>,
): ReactElement => {
  const editorAPIRef = useRef<EditorAPI | null>(null);
  const lastStateRef = useRef<string>("");

  useImperativeHandle(ref, () => ({
    getEditorState: () => editorAPIRef.current?.serialize() ?? "",
  }));

  const fileUploader = useMemo(
    () => ({
      useFileUpload: createFileUploadHook(uploadUrl),
      fileTypes: {
        image: {
          mimeTypes: [
            "image/gif",
            "image/jpg",
            "image/jpeg",
            "image/png",
            "image/svg+xml",
            "image/webp",
          ],
          extensions: ["gif", "jpg", "jpeg", "png", "svg", "svgz", "webp"],
        },
      },
    }),
    [uploadUrl],
  );

  const handleRegisterAPI = useCallback((api: EditorAPI) => {
    editorAPIRef.current = api;
  }, []);

  const handleEditorChange = useCallback(
    (editorStateJson: any) => {
      if (!editorStateJson) return;

      const stateString = JSON.stringify(editorStateJson);

      if (stateString !== lastStateRef.current) {
        lastStateRef.current = stateString;
        onChange("", stateString);
      }
    },
    [onChange],
  );

  return (
    <div className="koenig-editor-wrapper" style={{ padding: "2rem" }}>
      <KoenigComposer
        initialHtml={editorState ? undefined : content}
        initialEditorState={editorState ?? undefined}
        fileUploader={fileUploader}
        onError={(error: Error) => console.error("Koenig error:", error)}
      >
        <KoenigEditorComponent
          onChange={handleEditorChange}
          registerAPI={handleRegisterAPI}
          className="kg-editor"
        />
      </KoenigComposer>
    </div>
  );
};

const ForwardedKoenigEditor = forwardRef(KoenigEditorReact);
ForwardedKoenigEditor.displayName = "KoenigEditorReact";

export default ForwardedKoenigEditor;
