export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  role: 'admin' | 'supervisor' | 'user';
  department: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrudModule {
  id: string;
  name: string;
  description: string | null;
  slug: string;
  icon: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrudField {
  id: string;
  crud_module_id: string;
  name: string;
  label: string;
  field_type: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'email' | 'phone' | 'cpf' | 'cnpj' | 'currency';
  is_required: boolean;
  options: { value: string; label: string }[] | null;
  order_index: number;
  created_at: string;
}

export interface CrudRecord {
  id: string;
  crud_module_id: string;
  data: Record<string, any>;
  status: 'pending' | 'approved' | 'rejected';
  created_by: string | null;
  approved_by: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export type RecordStatus = 'pending' | 'approved' | 'rejected';
