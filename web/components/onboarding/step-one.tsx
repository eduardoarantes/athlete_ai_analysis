'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { profileStepOneSchema, type ProfileStepOneData } from '@/lib/validations/profile'
import { Form, FormControl, FormField, FormItem, FormLabel } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface StepOneProps {
  initialData?: ProfileStepOneData | null
  onSubmit: (data: ProfileStepOneData) => void
}

export function StepOne({ initialData, onSubmit }: StepOneProps) {
  const t = useTranslations('onboarding.step1')

  const form = useForm<ProfileStepOneData>({
    resolver: zodResolver(profileStepOneSchema),
    mode: 'all', // Validate on blur, change, and submit
    defaultValues: initialData || {
      firstName: '',
      lastName: '',
      age: undefined as any, // No default - user must enter age
      gender: '' as any, // No default - user must select gender
    },
  })

  const handleFormSubmit = (data: ProfileStepOneData) => {
    onSubmit(data)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit)} id="step-one-form" className="space-y-6">
        {/* First Name */}
        <FormField
          control={form.control}
          name="firstName"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>{t('firstName')}</FormLabel>
              <FormControl>
                <Input placeholder={t('firstNamePlaceholder')} {...field} />
              </FormControl>
              {fieldState.error?.message && (
                <p className="text-sm font-medium text-destructive mt-2">
                  {fieldState.error.message}
                </p>
              )}
            </FormItem>
          )}
        />

        {/* Last Name */}
        <FormField
          control={form.control}
          name="lastName"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>{t('lastName')}</FormLabel>
              <FormControl>
                <Input placeholder={t('lastNamePlaceholder')} {...field} />
              </FormControl>
              {fieldState.error?.message && (
                <p className="text-sm font-medium text-destructive mt-2">
                  {fieldState.error.message}
                </p>
              )}
            </FormItem>
          )}
        />

        {/* Age and Gender on the same line */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Age */}
          <FormField
            control={form.control}
            name="age"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>{t('age')}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder={t('agePlaceholder')}
                    className="max-w-[150px]"
                    {...field}
                    value={field.value ?? ''}
                    onChange={(e) => {
                      const value = e.target.value
                      field.onChange(value === '' ? undefined : parseInt(value, 10))
                    }}
                  />
                </FormControl>
                {fieldState.error?.message && (
                  <p className="text-sm font-medium text-destructive mt-2">
                    {fieldState.error.message}
                  </p>
                )}
              </FormItem>
            )}
          />

          {/* Gender */}
          <FormField
            control={form.control}
            name="gender"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>{t('gender')}</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="max-w-[250px]">
                      <SelectValue placeholder={t('genderPlaceholder')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="male">{t('male')}</SelectItem>
                    <SelectItem value="female">{t('female')}</SelectItem>
                    <SelectItem value="other">{t('other')}</SelectItem>
                    <SelectItem value="prefer_not_to_say">{t('preferNotToSay')}</SelectItem>
                  </SelectContent>
                </Select>
                {fieldState.error?.message && (
                  <p className="text-sm font-medium text-destructive mt-2">
                    {fieldState.error.message}
                  </p>
                )}
              </FormItem>
            )}
          />
        </div>
      </form>
    </Form>
  )
}
