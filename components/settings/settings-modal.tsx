'use client';

import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';

export function SettingsModal({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      router.back();
    }
  };

  return (
    <Dialog open={true} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-5xl p-0 overflow-hidden h-[80vh]">
        <div className="sr-only">
          <DialogTitle>Settings</DialogTitle>
        </div>
        {children}
      </DialogContent>
    </Dialog>
  );
}