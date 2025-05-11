'use client';

import { useRouter } from 'next/navigation';
import Profile from '@/app/components/Profile';

export default function PrivateProfilePage() {
  const router = useRouter();

  const handleEdit = () => {
    router.push('/profile/edit');
  };

  const handleChangePassword = () => {
    router.push('/profile/change-password');
  };

  return (
    <Profile
      isPrivate={true}
      onEdit={handleEdit}
      onChangePassword={handleChangePassword}
    />
  );
} 