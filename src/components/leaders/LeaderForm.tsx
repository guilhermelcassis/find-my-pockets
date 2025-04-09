import { useState, useEffect } from 'react';
import { Leader } from '@/types/Leader';
import { User, AlertCircle } from 'lucide-react';
import { 
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

interface LeaderFormProps {
  initialData?: Leader;
  onSubmit: (data: Omit<Leader, 'id' | 'active'>) => void;
  onCancel: () => void;
  errors: Record<string, string>;
}

// Helper function to capitalize each word in a string
const capitalizeWords = (str: string): string => {
  return str
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const formSchema = z.object({
  name: z.string()
    .min(1, { message: "Nome é obrigatório" })
    .transform(val => capitalizeWords(val)),
  phone: z.string()
    .min(1, { message: "Telefone é obrigatório" })
    .regex(/^(\+\d{1,3})?\s?\(?\d{2}\)?\s?\d{4,5}-?\d{4}$/, { 
      message: "Formato inválido. Use +XX (XX) XXXXX-XXXX para números internacionais ou (XX) XXXXX-XXXX para brasileiros" 
    }),
  email: z.string()
    .min(1, { message: "Email é obrigatório" })
    .email({ message: "Email inválido" }),
  curso: z.string()
    .min(1, { message: "Curso é obrigatório" })
    .transform(val => capitalizeWords(val)),
});

type FormValues = z.infer<typeof formSchema>;

export default function LeaderForm({ initialData, onSubmit, onCancel, errors: serverErrors }: LeaderFormProps) {
  const [submitting, setSubmitting] = useState(false);
  
  // Initialize form with react-hook-form
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: initialData?.name || '',
      phone: initialData?.phone || '',
      email: initialData?.email || '',
      curso: initialData?.curso || ''
    }
  });

  // Reset form values when initialData changes
  useEffect(() => {
    if (initialData) {
      form.reset({
        name: initialData.name,
        phone: initialData.phone,
        email: initialData.email,
        curso: initialData.curso
      });
    } else {
      form.reset({
        name: '',
        phone: '',
        email: '',
        curso: ''
      });
    }
  }, [initialData, form]);

  // Handle form submission
  const handleFormSubmit = (data: FormValues) => {
    setSubmitting(true);
    
    // Ensure name and curso are properly capitalized
    const formattedData = {
      ...data,
      name: capitalizeWords(data.name),
      curso: capitalizeWords(data.curso)
    };
    
    onSubmit(formattedData);
    setSubmitting(false);
  };

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-500">
        {initialData 
          ? "Atualize as informações do líder" 
          : "Preencha os detalhes para adicionar um novo líder"}
      </p>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-medium text-gray-600 flex items-center">
                  Nome
                  <span className="text-red-500 ml-1">*</span>
                </FormLabel>
                <FormControl>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Nome do líder"
                      className={`text-sm pl-9 h-10 ${serverErrors.name || form.formState.errors.name ? 'border-red-300 focus:ring-red-300' : 'focus:border-primary'}`}
                      {...field}
                      // Transform input to capitalized on blur for visual feedback
                      onBlur={(e) => {
                        e.target.value = capitalizeWords(e.target.value);
                        field.onBlur();
                      }}
                    />
                  </div>
                </FormControl>
                {(serverErrors.name || form.formState.errors.name) && (
                  <FormMessage className="truncate">
                    {serverErrors.name || form.formState.errors.name?.message}
                  </FormMessage>
                )}
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-medium text-gray-600 flex items-center">
                  Telefone
                  <span className="text-red-500 ml-1">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="+XX (XX) XXXXX-XXXX"
                    className={`text-sm h-10 ${serverErrors.phone || form.formState.errors.phone ? 'border-red-300 focus:ring-red-300' : 'focus:border-primary'}`}
                    {...field}
                  />
                </FormControl>
                {(serverErrors.phone || form.formState.errors.phone) && (
                  <FormMessage>
                    {serverErrors.phone || form.formState.errors.phone?.message}
                  </FormMessage>
                )}
                <p className="text-gray-500 text-xs">Formato: +XX (XX) XXXXX-XXXX para números internacionais ou (XX) XXXXX-XXXX para brasileiros</p>
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-medium text-gray-600 flex items-center">
                  Email
                  <span className="text-red-500 ml-1">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="email@exemplo.com"
                    className={`text-sm h-10 ${serverErrors.email || form.formState.errors.email ? 'border-red-300 focus:ring-red-300' : 'focus:border-primary'}`}
                    {...field}
                  />
                </FormControl>
                {(serverErrors.email || form.formState.errors.email) && (
                  <FormMessage className="truncate">
                    {serverErrors.email || form.formState.errors.email?.message}
                  </FormMessage>
                )}
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="curso"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs font-medium text-gray-600 flex items-center">
                  Curso
                  <span className="text-red-500 ml-1">*</span>
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="Curso do líder"
                    className={`text-sm h-10 ${serverErrors.curso || form.formState.errors.curso ? 'border-red-300 focus:ring-red-300' : 'focus:border-primary'}`}
                    {...field}
                    // Transform input to capitalized on blur for visual feedback
                    onBlur={(e) => {
                      e.target.value = capitalizeWords(e.target.value);
                      field.onBlur();
                    }}
                  />
                </FormControl>
                {(serverErrors.curso || form.formState.errors.curso) && (
                  <FormMessage className="truncate">
                    {serverErrors.curso || form.formState.errors.curso?.message}
                  </FormMessage>
                )}
              </FormItem>
            )}
          />
          
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 mt-6">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancel}
              className="text-sm font-normal"
            >
              Cancelar
            </Button>
            <Button 
              type="submit"
              size="sm"
              disabled={submitting}
              className="bg-primary hover:bg-primary/90 text-white text-sm font-normal"
            >
              {initialData ? 'Salvar Alterações' : 'Adicionar Líder'}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
} 