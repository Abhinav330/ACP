import { Suspense } from 'react';
import ProblemClient from './ProblemClient';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function Page({ params }: PageProps) {
  // In Next.js App Router, we need to await the params object itself
  const resolvedParams = await params;
  const id = resolvedParams.id;
  
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ProblemClient id={id} />
    </Suspense>
  );
} 