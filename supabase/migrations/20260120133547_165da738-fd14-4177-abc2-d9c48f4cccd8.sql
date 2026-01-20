-- Tabela de perfis de usuários
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'supervisor', 'user')),
  department TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de definições de CRUDs modulares
CREATE TABLE public.crud_modules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT DEFAULT 'FileText',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de campos dos CRUDs
CREATE TABLE public.crud_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  crud_module_id UUID NOT NULL REFERENCES public.crud_modules(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'select', 'textarea', 'email', 'phone', 'cpf', 'cnpj', 'currency')),
  is_required BOOLEAN NOT NULL DEFAULT false,
  options JSONB, -- Para campos select
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de registros dos CRUDs (dados dinâmicos)
CREATE TABLE public.crud_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  crud_module_id UUID NOT NULL REFERENCES public.crud_modules(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_by UUID REFERENCES auth.users(id),
  approved_by UUID REFERENCES auth.users(id),
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crud_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crud_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crud_records ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- CRUD Modules policies (everyone can view, admins can manage)
CREATE POLICY "Everyone can view active modules" ON public.crud_modules FOR SELECT USING (is_active = true OR auth.uid() = created_by);
CREATE POLICY "Authenticated users can create modules" ON public.crud_modules FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Creators can update modules" ON public.crud_modules FOR UPDATE USING (auth.uid() = created_by);
CREATE POLICY "Creators can delete modules" ON public.crud_modules FOR DELETE USING (auth.uid() = created_by);

-- CRUD Fields policies
CREATE POLICY "Everyone can view fields" ON public.crud_fields FOR SELECT USING (true);
CREATE POLICY "Module creators can manage fields" ON public.crud_fields FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.crud_modules WHERE id = crud_module_id AND created_by = auth.uid())
);
CREATE POLICY "Module creators can update fields" ON public.crud_fields FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.crud_modules WHERE id = crud_module_id AND created_by = auth.uid())
);
CREATE POLICY "Module creators can delete fields" ON public.crud_fields FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.crud_modules WHERE id = crud_module_id AND created_by = auth.uid())
);

-- CRUD Records policies
CREATE POLICY "Users can view records" ON public.crud_records FOR SELECT USING (
  auth.uid() = created_by OR 
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor'))
);
CREATE POLICY "Authenticated users can create records" ON public.crud_records FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Creators can update pending records" ON public.crud_records FOR UPDATE USING (
  (auth.uid() = created_by AND status = 'pending') OR
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor'))
);
CREATE POLICY "Admins can delete records" ON public.crud_records FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_crud_modules_updated_at BEFORE UPDATE ON public.crud_modules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_crud_records_updated_at BEFORE UPDATE ON public.crud_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 'user');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();