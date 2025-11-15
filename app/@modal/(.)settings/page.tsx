import { SettingsModal } from '@/components/settings/settings-modal';
import SettingsPage from '@/app/settings/page';

export default function SettingsModalRoute() {
  return (
    <SettingsModal>
      <SettingsPage />
    </SettingsModal>
  );
}