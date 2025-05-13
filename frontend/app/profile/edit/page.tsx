'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import styles from './EditProfile.module.css';

interface ProfileData {
  first_name: string;
  last_name: string;
  username: string;
  email: string;
  bio: string;
  linkedin_url?: string;
  website_url?: string;
}

export default function EditProfilePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        if (!session?.user?.token) return;

        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/private-profile`, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.user.token}`,
            'X-User-Email': session.user.email || ''
          }
        });

        if (!response.ok) throw new Error('Failed to fetch profile');
        const data = await response.json();
        setProfile(data);
      } catch (error) {
        setError(error instanceof Error ? error.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [session]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !session?.user?.token) return;

    setIsSaving(true);
    try {
      const body = {
        ...profile,
        social_links: {
          linkedin: profile.linkedin_url || "",
          portfolio: profile.website_url || "",
        }
      };
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/private-profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.user.token}`,
          'X-User-Email': session.user.email || ''
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) throw new Error('Failed to update profile');
      router.push('/profile/private');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner} />
        <div className={styles.loadingText}>Loading profile...</div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorMessage}>{error || 'Failed to load profile'}</div>
        <button className={styles.backButton} onClick={() => router.push('/profile/private')}>
          Back to Profile
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.formCard}>
        <h1 className={styles.title}>Edit Profile</h1>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="first_name" className={styles.label}>
              First Name
            </label>
            <input
              type="text"
              id="first_name"
              value={profile.first_name}
              disabled
              className={`${styles.input} ${styles.disabled}`}
            />
            <p className={styles.helpText}>
              First name cannot be changed at this time.
            </p>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="last_name" className={styles.label}>
              Last Name
            </label>
            <input
              type="text"
              id="last_name"
              value={profile.last_name}
              disabled
              className={`${styles.input} ${styles.disabled}`}
            />
            <p className={styles.helpText}>
              Last name cannot be changed at this time.
            </p>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="username" className={styles.label}>
              Username
            </label>
            <input
              type="text"
              id="username"
              value={profile.username}
              onChange={e => setProfile({ ...profile, username: e.target.value })}
              className={styles.input}
              required
            />
            <p className={styles.helpText}>
              This will be visible on your profile and the leaderboard.
            </p>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="email" className={styles.label}>
              Email
            </label>
            <input
              type="email"
              id="email"
              value={profile.email}
              disabled
              className={`${styles.input} ${styles.disabled}`}
            />
            <p className={styles.helpText}>
              Email cannot be changed. Please contact support if you need to update your email.
            </p>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="bio" className={styles.label}>
              Bio
            </label>
            <textarea
              id="bio"
              value={profile.bio}
              onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
              className={styles.textarea}
              rows={4}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="linkedin_url" className={styles.label}>
              LinkedIn URL
            </label>
            <input
              type="url"
              id="linkedin_url"
              value={profile.linkedin_url || ''}
              onChange={(e) => setProfile({ ...profile, linkedin_url: e.target.value })}
              className={styles.input}
              placeholder="https://linkedin.com/in/your-profile"
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="website_url" className={styles.label}>
              Personal Website
            </label>
            <input
              type="url"
              id="website_url"
              value={profile.website_url || ''}
              onChange={(e) => setProfile({ ...profile, website_url: e.target.value })}
              className={styles.input}
              placeholder="https://your-website.com"
            />
          </div>

          <div className={styles.buttonGroup}>
            <button
              type="button"
              onClick={() => router.push('/profile/private')}
              className={styles.cancelButton}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.saveButton}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 