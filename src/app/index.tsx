import { Redirect } from 'expo-router';

import { useAuth } from '@/auth';

export default function IndexScreen() {
  const { session } = useAuth();

  return <Redirect href={session ? '/home' : '/login'} />;
}
