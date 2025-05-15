'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import QuestionForm from '@/app/components/QuestionForm';
 
export default function NewQuestion() {
  const router = useRouter();
  return <QuestionForm onCancel={() => router.push('/admin/questions')} />;
} 