'use client';

import { useActivityTracker } from '../hooks/useActivityTracker';

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useActivityTracker();
  return children;
} 