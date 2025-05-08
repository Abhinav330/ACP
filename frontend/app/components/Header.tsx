'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import styles from './Header.module.css';
import Image from 'next/image';

const Header: React.FC = () => {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(false);
  }, [session, status]);

  const handleLogout = async () => {
    try {
      await signOut({ redirect: false });
      router.push('/login');
    } catch (error) {
      console.error('Error during logout:', error);
    }
  };

  if (isLoading || status === 'loading') {
    return <div className={styles.header} style={{ height: '90px' }} />; // Return empty header with same height
  }

  const user = session?.user;

  return (
    <header className={styles.header}>
      <div className={styles.leftSection}>
        <Link href="/" className={styles.logoLink}>
          <div className={styles.logo}>
            <span className={styles.logoText}>Algo Crafters</span>
          </div>
        </Link>
        <nav className={styles.nav}>
          <Link href="/about" className={styles.navLink}>About Us</Link>
          {user ? (
            <>
              {user.is_admin ? (
                <>
                  <Link href="/admin/admin_controls" className={`${styles.navLink} ${styles.adminLink}`}>
                    Admin Controls
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/problems" className={`${styles.navLink} ${styles.problemsLink}`}>
                    Problems
                  </Link>
                  <Link href="/leaderboard" className={`${styles.navLink} ${styles.leaderboardLink}`}>
                    Leaderboard
                  </Link>
                </>
              )}
            </>
          ) : (
            <>
              <Link href="/pricing" className={styles.navLink}>Pricing</Link>
            </>
          )}
        </nav>
      </div>
      <div className={styles.rightSection}>
        <Link href="/contact" className={styles.navLink}>Contact</Link>
        {user ? (
          <div className={styles.userSection}>
            <div className={styles.userInfo}>
              <Link href="/profile/edit" className={styles.avatarLink}>
                <Image
                  // @ts-ignore: user may have profile_picture or image from backend
                  src={(user as any)?.profile_picture || (user as any)?.image || '/default-avatar.png'}
                  alt={user.name || 'User'}
                  width={40}
                  height={40}
                  className={styles.avatar}
                  style={{ borderRadius: '50%', objectFit: 'cover', marginRight: '0.5rem', cursor: 'pointer' }}
                />
              </Link>
              <span className={styles.userName}>{user.name}</span>
              <span className={styles.userEmailText} style={{ pointerEvents: 'none', opacity: 0.7 }}>
                ({user.email})
              </span>
            </div>
            <button 
              onClick={handleLogout} 
              className={styles.logoutButton}
            >
              Sign out
            </button>
          </div>
        ) : (
          <div className={styles.authButtons}>
            <Link href="/login" className={styles.loginButton}>
              Sign in
            </Link>
            <Link href="/signup" className={styles.signupButton}>
              Sign up
            </Link>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header; 