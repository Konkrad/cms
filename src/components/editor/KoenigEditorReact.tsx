/** @jsxImportSource react */
import React, {
  useCallback,
  useState,
  useMemo,
  useImperativeHandle,
  forwardRef,
  useRef,
  useEffect,
  type ReactElement,
} from "react";
import {
  KoenigComposer,
  KoenigEditor as KoenigEditorComponent,
} from "@tryghost/koenig-lexical";

interface KoenigEditorProps {
  content: string;
  editorState?: string | null;
  onChange: (content: string, editorState: string) => void;
  uploadUrl?: string;
}

export interface KoenigEditorRef {
  getEditorState: () => string;
  getHtmlContent: () => string;
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
      console.log("Upload function called with", files.length, "files");
      setFilesNumber(files.length);
      setIsLoading(true);
      setProgress(30);
      setErrors([]);

      const results = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log("Processing file:", file.name);

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
            console.log("Upload successful:", result.data.url);
            results.push({
              url: result.data.url,
              src: result.data.url,
              fileName: file.name,
            });
          } else {
            throw new Error(result.error || "Upload failed");
          }
        } catch (error) {
          console.error("Upload exception:", error);
          setErrors((prev) => [
            ...prev,
            { fileName: file.name, message: String(error) },
          ]);
        }
      }

      setIsLoading(false);
      setProgress(100);
      console.log("All uploads complete:", results);
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
  const editorStateRef = useRef<string>("");
  const lastHtmlRef = useRef<string>("");
  const isInitializedRef = useRef(false);

  useImperativeHandle(ref, () => ({
    getEditorState: () => editorStateRef.current,
    getHtmlContent: () => lastHtmlRef.current,
  }));

  const fileUploader = useMemo(() => {
    return {
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
    };
  }, [uploadUrl]);

  const handleEditorChange = useCallback((editorState: any) => {
    if (!editorState) {
      return;
    }

    if (editorState && typeof editorState === "object") {
      editorStateRef.current = JSON.stringify(editorState);
    }
  }, []);

  useEffect(() => {
    const captureState = () => {
      const composerElement = document.querySelector(".koenig-editor-wrapper");
      if (composerElement && isInitializedRef.current) {
        try {
          const editorElement = composerElement.querySelector(
            '[contenteditable="true"]',
          );
          if (editorElement && (editorElement as any).__lexicalEditor) {
            const editor = (editorElement as any).__lexicalEditor;
            const state = editor.getEditorState();
            const stateJson = JSON.stringify(state.toJSON());
            editorStateRef.current = stateJson;

            const htmlContent = editorElement.innerHTML || "";
            if (htmlContent !== lastHtmlRef.current) {
              lastHtmlRef.current = htmlContent;
              onChange(htmlContent, stateJson);
            }
          }
        } catch (error) {
          console.error("Error capturing editor state:", error);
        }
      } else if (composerElement) {
        isInitializedRef.current = true;
      }
    };

    const interval = setInterval(captureState, 500);
    return () => clearInterval(interval);
  }, [onChange]);

  const initialEditorState = editorState ? editorState : undefined;

  return (
    <div className="koenig-editor-wrapper" style={{ padding: "2rem" }}>
      <KoenigComposer
        initialHtml={!initialEditorState ? content : undefined}
        initialEditorState={initialEditorState}
        fileUploader={fileUploader}
        onError={(error: Error) => console.error("Koenig error:", error)}
      >
        <KoenigEditorComponent
          onChange={handleEditorChange}
          className="kg-editor"
        />
      </KoenigComposer>
    </div>
  );
};

const ForwardedKoenigEditor = forwardRef(KoenigEditorReact);
ForwardedKoenigEditor.displayName = "KoenigEditorReact";

export default ForwardedKoenigEditor;
