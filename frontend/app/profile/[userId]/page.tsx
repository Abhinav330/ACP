'use client';

import { useParams } from 'next/navigation';
import Profile from '@/app/components/Profile';

export default function PublicProfilePage() {
  const params = useParams();
  const userId = params.userId as string;

  return <Profile userId={userId} />;
} 