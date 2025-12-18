export interface BlockData {
  id: string;
  componentType: string;
  order: number;
  data: Record<string, any>;
}

export interface FieldDefinition {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'boolean' | 'select' | 'color' | 'url';
  defaultValue?: any;
  options?: { label: string; value: string }[];
  placeholder?: string;
  required?: boolean;
}

export interface BlockDefinition {
  name: string;
  componentType: string;
  category: 'content' | 'dynamic';
  icon: string;
  configSchema: FieldDefinition[];
  defaultData: Record<string, any>;
}
