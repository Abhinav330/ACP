'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import styles from './Header.module.css';
import Image from 'next/image';

interface User {
  id?: string;
  email?: string;
  name?: string;
  token?: string;
  isLoggedIn?: boolean;
  is_admin?: boolean;
  is_restricted?: boolean;
  profile_picture?: string;
}

const Header: React.FC = () => {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.log('Session Status:', status);
    console.log('Session Data:', session);
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

  const user = session?.user as User | undefined;

  return (
    <header className={styles.header}>
      <div className={styles.leftSection}>
        <Link href="/" className={styles.logoLink}>
          <div className={styles.logo}>
            <span className={styles.logoText}>Algo Crafters</span>
          </div>
        </Link>
        <nav className={styles.nav}>
          
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
                  <Link href="/learning-hub" className={`${styles.navLink} ${styles.problemsLink}`}>Learning Hub</Link>
                  <Link href="/problems" className={`${styles.navLink} ${styles.problemsLink}`}>
                    Problems
                  </Link>
                  <Link href="/leaderboard" className={`${styles.navLink} ${styles.leaderboardLink}`}>
                    Leaderboard
                  </Link>
                  <Link href="/about" className={`${styles.navLink} ${styles.leaderboardLink}`}>About Us</Link>
                </>
              )}
            </>
            
          ) : (
            <>
              <Link href="/pricing" className={styles.navLink}>Pricing</Link>
              <Link href="/about" className={`${styles.navLink} ${styles.leaderboardLink}`}>About Us</Link>
            </>
          )}
        </nav>
      </div>
      <div className={styles.rightSection}>
        <Link href="/contact" className={styles.navLink}>Contact</Link>
        {user ? (
          <div className={styles.userSection}>
            <div className={styles.userInfo}>
              <Link href="/profile/private" className={styles.avatarLink}>
                <Image
                  src={user?.profile_picture ? `${process.env.NEXT_PUBLIC_API_URL}${user.profile_picture}` : '/default-avatar.png'}
                  alt={user?.name && user.name.trim() !== '' ? user.name : 'User profile picture'}
                  width={40}
                  height={40}
                  className={styles.avatar}
                  style={{ borderRadius: '50%', objectFit: 'cover', marginRight: '0.5rem', cursor: 'pointer' }}
                />
              </Link>
              <span className={styles.userName}>
                {user.name}
                {user.is_admin && (
                  <span className={styles.adminBadge}>Admin</span>
                )}
              </span>
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