export interface BlockData {
  id: string;
  componentType: string;
  order: number;
  data: Record<string, any>;
}

export interface FieldDefinition {
  name: string;
  label: string;
  type:
    | "text"
    | "textarea"
    | "number"
    | "boolean"
    | "select"
    | "color"
    | "url"
    | "image-upload"
    | "tiles"
    | "grid-layout";
  defaultValue?: any;
  options?: { label: string; value: string }[];
  placeholder?: string;
  required?: boolean;
  uploadPath?: string;
  pipeline?: "standard" | "gallery" | "thumbnail" | "profile-picture" | "svg";
  aspectRatio?: string;
  crop?: boolean;
  cropAspectRatio?: string;
}

export interface BlockDefinition {
  name: string;
  componentType: string;
  category: "content" | "dynamic";
  icon: string;
  configSchema: FieldDefinition[];
  defaultData: Record<string, any>;
}
