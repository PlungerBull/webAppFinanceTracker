'use client';

import { useState } from 'react';
import { Sidebar } from './sidebar';
import { AddTransactionModal } from '@/features/transactions/components/add-transaction-modal';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [isAddTransactionModalOpen, setIsAddTransactionModalOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-900">
      <Sidebar />
      <main className="flex-1 overflow-y-auto relative">
        {children}

        {/* Floating Action Button */}
        <Button
          onClick={() => setIsAddTransactionModalOpen(true)}
          size="lg"
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow z-50"
        >
          <Plus className="h-6 w-6" />
        </Button>

        {/* Add Transaction Modal */}
        <AddTransactionModal
          open={isAddTransactionModalOpen}
          onOpenChange={setIsAddTransactionModalOpen}
        />
      </main>
    </div>
  );
}
