export interface Leader {
  id: string;
  name: string;
  phone: string;
  email: string;
  curso: string;
  active?: boolean;
}

export interface FormErrors {
  name?: string;
  phone?: string;
  email?: string;
  curso?: string;
} 