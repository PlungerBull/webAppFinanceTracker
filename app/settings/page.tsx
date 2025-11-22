'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import {
  updateProfileSchema,
  type UpdateProfileFormData,
} from '@/features/auth/schemas/profile.schema';
import { authApi } from '@/features/auth/api/auth';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, User, Database, Trash2, Upload, Download, AlertTriangle } from 'lucide-react';
import { ChangePasswordModal } from '@/components/settings/change-password-modal';
import { ChangeEmailModal } from '@/components/settings/change-email-modal';
import { getInitials, cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { SETTINGS_TABS, IMPORT_EXPORT, SETTINGS, QUERY_KEYS } from '@/lib/constants';

type SettingsTab = 'account' | 'data';

export default function SettingsPage() {
  const { user, initialize } = useAuthStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>('account');
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-[280px] flex-shrink-0 bg-zinc-50 dark:bg-zinc-900/50 border-r border-zinc-200 dark:border-zinc-800 flex flex-col">
        <div className="p-4 pb-2">
          <h2 className="text-xl font-semibold mb-4 px-2">Settings</h2>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start px-3 py-2 h-auto font-normal",
              activeTab === 'account' ? "bg-zinc-200/60 dark:bg-zinc-800 font-medium" : "hover:bg-zinc-200/40 dark:hover:bg-zinc-800/50"
            )}
            onClick={() => setActiveTab('account')}
          >
            <User className="mr-3 h-4 w-4 text-muted-foreground" />
            {SETTINGS_TABS.ACCOUNT}
          </Button>
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start px-3 py-2 h-auto font-normal",
              activeTab === 'data' ? "bg-zinc-200/60 dark:bg-zinc-800 font-medium" : "hover:bg-zinc-200/40 dark:hover:bg-zinc-800/50"
            )}
            onClick={() => setActiveTab('data')}
          >
            <Database className="mr-3 h-4 w-4 text-muted-foreground" />
            {SETTINGS_TABS.DATA}
          </Button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-zinc-950">
        <div className="max-w-2xl mx-auto py-8 px-8">
          {activeTab === 'account' ? (
            <AccountSettings
              user={user}
              initialize={initialize}
              openPasswordModal={() => setIsPasswordModalOpen(true)}
              openEmailModal={() => setIsEmailModalOpen(true)}
            />
          ) : (
            <DataSettings />
          )}
        </div>
      </div>

      {/* Modals */}
      <ChangePasswordModal
        open={isPasswordModalOpen}
        onOpenChange={setIsPasswordModalOpen}
      />
      <ChangeEmailModal
        open={isEmailModalOpen}
        onOpenChange={setIsEmailModalOpen}
      />
    </div>
  );
}

interface AccountSettingsProps {
  user: any; // Supabase User type
  initialize: () => void;
  openPasswordModal: () => void;
  openEmailModal: () => void;
}

function AccountSettings({ user, initialize, openPasswordModal, openEmailModal }: AccountSettingsProps) {
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<UpdateProfileFormData>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      firstName: user?.user_metadata?.firstName || '',
      lastName: user?.user_metadata?.lastName || '',
    },
  });

  useEffect(() => {
    if (user) {
      reset({
        firstName: user.user_metadata?.firstName || '',
        lastName: user.user_metadata?.lastName || '',
      });
    }
  }, [user, reset]);

  const onSubmit = async (data: UpdateProfileFormData) => {
    try {
      setError(null);
      setSuccess(false);
      await authApi.updateUserMetadata(data);
      setSuccess(true);
      initialize();
      reset(data);
      setTimeout(() => setSuccess(false), SETTINGS.TIMEOUTS.SUCCESS_MESSAGE);
    } catch (err) {
      setError(err instanceof Error ? err.message : SETTINGS.MESSAGES.ERROR.UPDATE_FAILED);
    }
  };

  const initials = getInitials(
    user?.user_metadata?.firstName,
    user?.user_metadata?.lastName
  );

  return (
    <div className="space-y-8">
      <div className="border-b border-zinc-100 dark:border-zinc-800 pb-6">
        <h3 className="text-xl font-semibold mb-1">{SETTINGS.HEADERS.ACCOUNT}</h3>
        <p className="text-sm text-muted-foreground">
          {SETTINGS.DESCRIPTIONS.ACCOUNT}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-md">
            {error}
          </div>
        )}
        {success && (
          <div className="p-3 text-sm text-green-700 bg-green-50 dark:bg-green-900/20 rounded-md">
            {SETTINGS.MESSAGES.SUCCESS.PROFILE_UPDATED}
          </div>
        )}

        {/* Photo Section */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{SETTINGS.HEADERS.PHOTO}</h4>
          <div className="flex items-center gap-6">
            <div className="flex-shrink-0 h-20 w-20 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-3xl font-medium ring-4 ring-zinc-50 dark:ring-zinc-900">
              {initials || '?'}
            </div>
            <Button type="button" variant="outline" size="sm" disabled>
              {SETTINGS.BUTTONS.UPLOAD_PHOTO}
            </Button>
          </div>
        </div>

        {/* Name Section */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">{SETTINGS.LABELS.FIRST_NAME}</Label>
              <Input id="firstName" {...register('firstName')} />
              {errors.firstName && (
                <p className="text-sm text-red-600">{errors.firstName.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">{SETTINGS.LABELS.LAST_NAME}</Label>
              <Input id="lastName" {...register('lastName')} />
              {errors.lastName && (
                <p className="text-sm text-red-600">{errors.lastName.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Security Section */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
              <div className="space-y-0.5 overflow-hidden">
                <Label className="text-base">{SETTINGS.LABELS.EMAIL}</Label>
                <p className="text-sm text-muted-foreground truncate" title={user?.email}>{user?.email}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={openEmailModal}
                className="flex-shrink-0 ml-2"
              >
                {SETTINGS.BUTTONS.CHANGE}
              </Button>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
              <div className="space-y-0.5">
                <Label className="text-base">{SETTINGS.LABELS.PASSWORD}</Label>
                <p className="text-sm text-muted-foreground">{SETTINGS.LABELS.PASSWORD_PLACEHOLDER}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={openPasswordModal}
              >
                {SETTINGS.BUTTONS.CHANGE}
              </Button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 flex justify-end">
          <Button type="submit" disabled={isSubmitting || !isDirty}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {SETTINGS.BUTTONS.UPDATE_PROFILE}
          </Button>
        </div>
      </form>
    </div>
  );
}

function DataSettings() {
  const router = useRouter();
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const supabase = createClient();
  const queryClient = useQueryClient();

  const handleClearData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.rpc('clear_user_data', { p_user_id: user.id });
      if (error) throw error;

      alert(SETTINGS.MESSAGES.SUCCESS.DATA_CLEARED);

      // Invalidate all data queries
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TRANSACTIONS.ALL }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNTS }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CATEGORIES }),
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CURRENCIES }),
      ]);

      router.refresh();
    } catch (error) {
      console.error('Failed to clear data:', error);
      alert(SETTINGS.MESSAGES.ERROR.CLEAR_FAILED);
    }
  };

  return (
    <div className="space-y-8">
      <div className="border-b border-zinc-100 dark:border-zinc-800 pb-6">
        <h3 className="text-xl font-semibold mb-1">{SETTINGS.HEADERS.DATA}</h3>
        <p className="text-sm text-muted-foreground">
          {SETTINGS.DESCRIPTIONS.DATA}
        </p>
      </div>

      {/* Import Section */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{SETTINGS.HEADERS.IMPORT_EXPORT}</h4>

        <div className="grid gap-4">
          <div className="flex items-start justify-between p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
            <div className="space-y-1">
              <div className="font-medium flex items-center gap-2">
                <Upload className="h-4 w-4" />
                {SETTINGS.LABELS.IMPORT_DATA}
              </div>
              <p className="text-sm text-muted-foreground">
                {SETTINGS.DESCRIPTIONS.IMPORT}
              </p>
            </div>
            <div className="relative">
              <input
                type="file"
                accept=".xlsx, .xls"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  try {
                    setImportSuccess(null);
                    setImportError(null);
                    const { DataImportService } = await import('@/features/import-export/services/data-import-service');
                    const service = new DataImportService();
                    const result = await service.importFromExcel(file);

                    if (result.failed > 0) {
                      setImportError(SETTINGS.MESSAGES.ERROR.IMPORT_ERRORS(result.success, result.failed, result.errors));
                    } else {
                      setImportSuccess(SETTINGS.MESSAGES.SUCCESS.IMPORT_SUCCESS(result.success));
                      // Invalidate all data queries to reflect imported data
                      await Promise.all([
                        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TRANSACTIONS.ALL }),
                        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNTS }),
                        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CATEGORIES }),
                        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CURRENCIES }),
                      ]);
                    }
                    e.target.value = '';
                  } catch (err) {
                    setImportError(err instanceof Error ? err.message : SETTINGS.MESSAGES.ERROR.IMPORT_FAILED);
                    e.target.value = '';
                  }
                }}
              />
              <Button variant="secondary" size="sm">
                {SETTINGS.BUTTONS.SELECT_FILE}
              </Button>
            </div>
          </div>
          {importError && (
            <div className="text-sm text-red-600 bg-red-50 p-2 rounded">{importError}</div>
          )}
          {importSuccess && (
            <div className="text-sm text-green-600 bg-green-50 p-2 rounded">{importSuccess}</div>
          )}

          {/* Import Instructions Warning */}
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/30 dark:bg-amber-900/10 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="space-y-3 text-sm">
                <div>
                  <h5 className="font-medium text-amber-800 dark:text-amber-400 mb-1">{SETTINGS.LABELS.FILE_STRUCTURE_REQ}</h5>
                  <p className="text-amber-700 dark:text-amber-500/90">
                    {SETTINGS.MESSAGES.FILE_STRUCTURE_INTRO(IMPORT_EXPORT.FILE_TYPES.join(', '))}
                  </p>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <span className="font-semibold text-amber-800 dark:text-amber-400 block mb-1">{SETTINGS.LABELS.REQUIRED_COLUMNS}</span>
                    <ul className="list-disc pl-4 space-y-0.5 text-amber-700 dark:text-amber-500/90">
                      {IMPORT_EXPORT.REQUIRED_COLUMNS.map(col => (
                        <li key={col}>{col}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className="font-semibold text-amber-800 dark:text-amber-400 block mb-1">{SETTINGS.LABELS.OPTIONAL_COLUMNS}</span>
                    <ul className="list-disc pl-4 space-y-0.5 text-amber-700 dark:text-amber-500/90">
                      {IMPORT_EXPORT.OPTIONAL_COLUMNS.map(col => (
                        <li key={col}>{col}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-start justify-between p-4 rounded-lg border border-zinc-200 dark:border-zinc-800">
            <div className="space-y-1">
              <div className="font-medium flex items-center gap-2">
                <Download className="h-4 w-4" />
                {SETTINGS.LABELS.EXPORT_DATA}
              </div>
              <p className="text-sm text-muted-foreground">
                {SETTINGS.DESCRIPTIONS.EXPORT}
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                try {
                  const { DataExportService } = await import('@/features/import-export/services/data-export-service');
                  const service = new DataExportService();
                  await service.exportToExcel();
                } catch (err) {
                  alert(SETTINGS.MESSAGES.ERROR.EXPORT_FAILED);
                }
              }}
            >
              {SETTINGS.BUTTONS.DOWNLOAD}
            </Button>
          </div>
        </div>
      </div>

      <div className="h-px bg-zinc-100 dark:bg-zinc-800" />

      {/* Clear Data Section */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-red-600 uppercase tracking-wider">{SETTINGS.HEADERS.DANGER_ZONE}</h4>

        <div className="flex items-start justify-between p-4 rounded-lg border border-red-100 dark:border-red-900/20 bg-red-50/50 dark:bg-red-900/10">
          <div className="space-y-1">
            <div className="font-medium text-red-700 dark:text-red-400 flex items-center gap-2">
              <Trash2 className="h-4 w-4" />
              {SETTINGS.LABELS.CLEAR_ALL_DATA}
            </div>
            <p className="text-sm text-red-600/80 dark:text-red-400/80">
              {SETTINGS.DESCRIPTIONS.CLEAR_DATA}
            </p>
          </div>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                {SETTINGS.BUTTONS.CLEAR_DATA}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                  {SETTINGS.LABELS.CLEAR_ALL_DATA_QUESTION}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {SETTINGS.DESCRIPTIONS.CLEAR_DATA_CONFIRM}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{SETTINGS.BUTTONS.CANCEL}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleClearData}
                  className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                >
                  {SETTINGS.BUTTONS.CONFIRM_DELETE}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}