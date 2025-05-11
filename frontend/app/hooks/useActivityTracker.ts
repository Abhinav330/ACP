'use client';

import { useEffect, useRef, useState } from 'react';
import { signOut } from 'next-auth/react';

const WARNING_TIME = 2 * 60 * 1000; // 2 minutes before expiry
const SESSION_TIMEOUT = 20 * 60 * 1000; // 20 minutes

export function useActivityTracker() {
  const [warningShown, setWarningShown] = useState(false);
  const lastActivityRef = useRef(Date.now());

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const updateActivity = () => {
      lastActivityRef.current = Date.now();
      setWarningShown(false);
    };

    const handleActivity = () => {
      updateActivity();
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(updateActivity, 1000);
    };

    const events = ['mousedown', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, handleActivity));

    const checkInterval = setInterval(() => {
      const now = Date.now();
      const inactiveTime = now - lastActivityRef.current;
      const timeUntilExpiry = SESSION_TIMEOUT - inactiveTime;
      if (timeUntilExpiry <= 0) {
        signOut({ callbackUrl: '/login' });
      } else if (timeUntilExpiry <= WARNING_TIME && !warningShown) {
        setWarningShown(true);
        const warning = window.confirm(
          'Your session will expire in 2 minutes due to inactivity. Would you like to stay logged in?'
        );
        if (warning) {
          updateActivity();
        } else {
          signOut({ callbackUrl: '/login' });
        }
      }
    }, 60 * 1000);

    updateActivity();

    return () => {
      events.forEach(event => window.removeEventListener(event, handleActivity));
      clearInterval(checkInterval);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [warningShown]);
} 