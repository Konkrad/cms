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
  longitude?: string | null;
  latitude?: string | null;
  onlineUrl?: string | null;
  userId: string;
  createdAt?: string;
  updatedAt?: string;
}
