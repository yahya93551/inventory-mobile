import { Redirect } from 'expo-router';

import { useAuth } from '@/auth';
import AppTabs from '@/components/app-tabs';
import { LoadingState, ScreenContainer } from '@/components/ui';

export default function ProtectedLayout() {
  const { loading, session } = useAuth();

  if (loading) {
    return (
      <ScreenContainer scroll={false}>
        <LoadingState label="Restoring your session..." />
      </ScreenContainer>
    );
  }

  if (!session) return <Redirect href="/login" />;

  return <AppTabs />;
}