export interface User {
  id: string;
  name: string;
  familyName: string;
  displayName: string;
  email: string;
  city: string | null;
  country: string | null;
  longitude: string | null;
  latitude: string | null;
  yearOfBirth: number | null;
  sex: string | null;
  role: 'user' | 'moderator' | 'admin';
  createdAt: string;
  updatedAt: string;
}

export interface NewUser {
  id?: string;
  name: string;
  familyName: string;
  displayName?: string;
  email: string;
  city?: string | null;
  country?: string | null;
  longitude?: string | null;
  latitude?: string | null;
  yearOfBirth?: number | null;
  sex?: string | null;
  role?: 'user' | 'moderator' | 'admin';
  createdAt?: string;
  updatedAt?: string;
}

export interface Post {
  id: string;
  title: string;
  body: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface NewPost {
  id?: string;
  title: string;
  body: string;
  userId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Event {
  id: string;
  title: string;
  body: string;
  startDate: string;
  endDate: string;
  locationType: string;
  address: string | null;
  city: string | null;
  country: string | null;
  longitude: string | null;
  latitude: string | null;
  onlineUrl: string | null;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface NewEvent {
  id?: string;
  title: string;
  body: string;
  startDate: Date | string;
  endDate: Date | string;
  locationType: string;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  longitude?: string | null;
  latitude?: string | null;
  onlineUrl?: string | null;
  userId: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface BlockData {
  id: string;
  componentType: string;
  order: number;
  data: Record<string, any>;
}

export interface Page {
  id: string;
  title: string;
  slug: string;
  parentId: string | null;
  content: BlockData[];
  status: 'draft' | 'published';
  createdAt: string;
  updatedAt: string;
}

export interface NewPage {
  id?: string;
  title: string;
  slug: string;
  parentId?: string | null;
  content?: BlockData[];
  status?: 'draft' | 'published';
  createdAt?: string;
  updatedAt?: string;
}

export interface MenuItem {
  id: string;
  menuName: string;
  label: string;
  url: string;
  parentId: string | null;
  position: number;
  icon: string | null;
  target: '_self' | '_blank' | '_parent' | '_top';
  createdAt: string;
  updatedAt: string;
}

export interface NewMenuItem {
  id?: string;
  menuName: string;
  label: string;
  url: string;
  parentId?: string | null;
  position?: number;
  icon?: string | null;
  target?: '_self' | '_blank' | '_parent' | '_top';
  createdAt?: string;
  updatedAt?: string;
}

export interface MenuItemTree extends MenuItem {
  children?: MenuItemTree[];
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
