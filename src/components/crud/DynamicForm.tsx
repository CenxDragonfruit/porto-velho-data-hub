import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CrudField } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Save } from 'lucide-react';

interface DynamicFormProps {
  fields: CrudField[];
  initialData?: Record<string, any>;
  onSubmit: (data: Record<string, any>) => Promise<void>;
  submitLabel?: string;
  loading?: boolean;
}

export function DynamicForm({
  fields,
  initialData = {},
  onSubmit,
  submitLabel = 'Salvar',
  loading = false,
}: DynamicFormProps) {
  const [formData, setFormData] = useState<Record<string, any>>(initialData);

  useEffect(() => {
    setFormData(initialData);
  }, [initialData]);

  const handleChange = (name: string, value: any) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(formData);
  };

  const formatCurrency = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    const amount = parseInt(numbers) / 100;
    return amount.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 11);
    return numbers
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  };

  const formatCNPJ = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 14);
    return numbers
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '').slice(0, 11);
    if (numbers.length <= 10) {
      return numbers
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{4})(\d)/, '$1-$2');
    }
    return numbers
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2');
  };

  const renderField = (field: CrudField) => {
    const value = formData[field.name] || '';

    switch (field.field_type) {
      case 'textarea':
        return (
          <Textarea
            id={field.name}
            value={value}
            onChange={(e) => handleChange(field.name, e.target.value)}
            required={field.is_required}
            className="min-h-[100px]"
          />
        );

      case 'select':
        return (
          <Select
            value={value}
            onValueChange={(val) => handleChange(field.name, val)}
            required={field.is_required}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'currency':
        return (
          <Input
            id={field.name}
            type="text"
            value={value ? formatCurrency(value.toString()) : ''}
            onChange={(e) => {
              const numbers = e.target.value.replace(/\D/g, '');
              handleChange(field.name, numbers);
            }}
            required={field.is_required}
            placeholder="R$ 0,00"
          />
        );

      case 'cpf':
        return (
          <Input
            id={field.name}
            type="text"
            value={formatCPF(value)}
            onChange={(e) => handleChange(field.name, e.target.value.replace(/\D/g, ''))}
            required={field.is_required}
            placeholder="000.000.000-00"
            maxLength={14}
          />
        );

      case 'cnpj':
        return (
          <Input
            id={field.name}
            type="text"
            value={formatCNPJ(value)}
            onChange={(e) => handleChange(field.name, e.target.value.replace(/\D/g, ''))}
            required={field.is_required}
            placeholder="00.000.000/0000-00"
            maxLength={18}
          />
        );

      case 'phone':
        return (
          <Input
            id={field.name}
            type="text"
            value={formatPhone(value)}
            onChange={(e) => handleChange(field.name, e.target.value.replace(/\D/g, ''))}
            required={field.is_required}
            placeholder="(00) 00000-0000"
            maxLength={15}
          />
        );

      case 'number':
        return (
          <Input
            id={field.name}
            type="number"
            value={value}
            onChange={(e) => handleChange(field.name, e.target.value)}
            required={field.is_required}
          />
        );

      case 'date':
        return (
          <Input
            id={field.name}
            type="date"
            value={value}
            onChange={(e) => handleChange(field.name, e.target.value)}
            required={field.is_required}
          />
        );

      case 'email':
        return (
          <Input
            id={field.name}
            type="email"
            value={value}
            onChange={(e) => handleChange(field.name, e.target.value)}
            required={field.is_required}
            placeholder="email@exemplo.com"
          />
        );

      default:
        return (
          <Input
            id={field.name}
            type="text"
            value={value}
            onChange={(e) => handleChange(field.name, e.target.value)}
            required={field.is_required}
          />
        );
    }
  };

  const sortedFields = [...fields].sort((a, b) => a.order_index - b.order_index);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {sortedFields.map((field, index) => (
          <motion.div
            key={field.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={field.field_type === 'textarea' ? 'md:col-span-2' : ''}
          >
            <Label htmlFor={field.name} className="input-label">
              {field.label}
              {field.is_required && <span className="text-destructive ml-1">*</span>}
            </Label>
            {renderField(field)}
          </motion.div>
        ))}
      </div>

      <div className="flex justify-end pt-4">
        <Button type="submit" className="btn-gradient-primary" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              {submitLabel}
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
