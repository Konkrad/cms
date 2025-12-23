declare module '@tryghost/koenig-lexical' {
  import type { ReactNode } from 'react';

  export interface KoenigComposerProps {
    initialHtml?: string;
    initialEditorState?: string;
    fileUploader?: {
      useFileUpload: () => {
        progress: number;
        isLoading: boolean;
        errors: Array<{ fileName: string; message: string }>;
        upload: (files: File[]) => Promise<Array<{ url: string; fileName: string }>>;
        filesNumber: number;
      };
      fileTypes?: {
        image?: {
          mimeTypes: string[];
          extensions: string[];
        };
      };
    };
    onError?: (error: Error) => void;
    children?: ReactNode;
  }

  export interface KoenigEditorProps {
    onChange?: (editorState: any) => void;
    className?: string;
  }

  export const KoenigComposer: React.FC<KoenigComposerProps>;
  export const KoenigEditor: React.FC<KoenigEditorProps>;
}
