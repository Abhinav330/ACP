'use client';

import React, { useRef, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const Header = dynamic(() => import('./Header'), {
  ssr: false,
  loading: () => <div style={{ height: '90px' }} />,
});

const Footer = dynamic(() => import('./Footer'), {
  ssr: false,
});

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const mainRef = useRef<HTMLDivElement>(null);
  const [stickyFooter, setStickyFooter] = useState(false);

  useEffect(() => {
    function checkSticky() {
      const headerHeight = 90;
      const footerHeight = 200; // estimate
      const mainHeight = mainRef.current?.offsetHeight || 0;
      if (headerHeight + footerHeight + mainHeight < window.innerHeight) {
        setStickyFooter(true);
      } else {
        setStickyFooter(false);
      }
    }
    checkSticky();
    window.addEventListener('resize', checkSticky);
    return () => window.removeEventListener('resize', checkSticky);
  }, []);

  return (
    <>
      <Header />
      <main ref={mainRef}>{children}</main>
      <Footer sticky={stickyFooter} />
    </>
  );
} 