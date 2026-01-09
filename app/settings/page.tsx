'use client';

import { useState } from 'react';
import { useAuthStore } from '@/stores/auth-store';
import { Button } from '@/components/ui/button';
import { User, Database, Palette } from 'lucide-react';
import { ChangePasswordModal } from '@/components/settings/change-password-modal';
import { ChangeEmailModal } from '@/components/settings/change-email-modal';
import { cn } from '@/lib/utils';
import { SETTINGS_TABS } from '@/lib/constants';
import { ProfileSettings } from '@/features/settings/components/profile-settings';
import { DataManagement } from '@/features/settings/components/data-management';
import { AppearanceSettings } from '@/features/settings/components/appearance-settings';

type SettingsTab = 'account' | 'data' | 'appearance';

export default function SettingsPage() {
  const { user, initialize } = useAuthStore();
  const [activeTab, setActiveTab] = useState<SettingsTab>('account');
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-[280px] flex-shrink-0 bg-white dark:bg-zinc-900/50 border-r border-zinc-200 dark:border-zinc-800 flex flex-col">
        <div className="p-4 pb-2">
          <h2 className="text-xl font-semibold mb-4 px-2">Settings</h2>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start px-3 py-2 h-auto font-normal",
              activeTab === 'account' ? "bg-white border border-zinc-300 dark:bg-zinc-800 font-medium" : "hover:bg-white hover:border hover:border-zinc-200 dark:hover:bg-zinc-800/50"
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
              activeTab === 'data' ? "bg-white border border-zinc-300 dark:bg-zinc-800 font-medium" : "hover:bg-white hover:border hover:border-zinc-200 dark:hover:bg-zinc-800/50"
            )}
            onClick={() => setActiveTab('data')}
          >
            <Database className="mr-3 h-4 w-4 text-muted-foreground" />
            {SETTINGS_TABS.DATA}
          </Button>
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start px-3 py-2 h-auto font-normal",
              activeTab === 'appearance' ? "bg-white border border-zinc-300 dark:bg-zinc-800 font-medium" : "hover:bg-white hover:border hover:border-zinc-200 dark:hover:bg-zinc-800/50"
            )}
            onClick={() => setActiveTab('appearance')}
          >
            <Palette className="mr-3 h-4 w-4 text-muted-foreground" />
            Appearance
          </Button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-zinc-950">
        <div className="max-w-2xl mx-auto py-8 px-8">
          {activeTab === 'account' ? (
            <ProfileSettings
              user={user}
              initialize={initialize}
              openPasswordModal={() => setIsPasswordModalOpen(true)}
              openEmailModal={() => setIsEmailModalOpen(true)}
            />
          ) : activeTab === 'data' ? (
            <DataManagement />
          ) : activeTab === 'appearance' ? (
            <AppearanceSettings />
          ) : null}
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