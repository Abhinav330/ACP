'use client';

import dynamic from 'next/dynamic';

const Header = dynamic(() => import('./Header'), {
  ssr: false,
  loading: () => <div style={{ height: '90px' }} />,
});

const Footer = dynamic(() => import('./Footer'), {
  ssr: false,
});

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer />
    </>
  );
} 