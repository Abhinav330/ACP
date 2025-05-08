'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import styles from '../[userId]/profile.module.css';
import { FaUserCircle as UserIcon, FaMapMarkerAlt as MapIcon } from 'react-icons/fa';
import ActivityCalendar from 'react-activity-calendar';

interface PrivateProfile {
  user_name: string;
  profile_picture: string;
  bio: string;
  social_links: {
    github?: string;
    linkedin?: string;
    portfolio?: string;
    company?: string;
  };
  visibility: {
    github: boolean;
    linkedin: boolean;
    portfolio: boolean;
    company: boolean;
  };
  total_questions_solved: number;
  total_score: number;
  contribution_data: { date: string; count: number }[];
}

export default function EditProfile() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [profile, setProfile] = useState<PrivateProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }

    const fetchProfile = async () => {
      try {
        if (!session?.user?.token) {
          return;
        }

        const response = await fetch('http://localhost:8000/api/private-profile', {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.user.token}`,
            'X-User-Email': session.user.email || ''
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch profile');
        }

        const data = await response.json();
        setProfile(data);
      } catch (error) {
        setError(error instanceof Error ? error.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    if (status === 'authenticated') {
      fetchProfile();
    }
  }, [router, session, status]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !session?.user?.token) return;

    setIsSaving(true);
    try {
      const response = await fetch('http://localhost:8000/api/private-profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.user.token}`,
          'X-User-Email': session.user.email || ''
        },
        body: JSON.stringify(profile)
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      // Show success message or redirect
      router.push(`/profile/${session.user.id}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!profile) return;

    const { name, value } = e.target;
    if (name.startsWith('social_')) {
      const socialKey = name.replace('social_', '') as keyof PrivateProfile['social_links'];
      setProfile({
        ...profile,
        social_links: {
          ...profile.social_links,
          [socialKey]: value
        }
      });
    } else if (name.startsWith('visibility_')) {
      const visibilityKey = name.replace('visibility_', '') as keyof PrivateProfile['visibility'];
      setProfile({
        ...profile,
        visibility: {
          ...profile.visibility,
          [visibilityKey]: !profile.visibility[visibilityKey]
        }
      });
    } else {
      setProfile({
        ...profile,
        [name]: value
      });
    }
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading profile...</div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>{error || 'Failed to load profile'}</div>
      </div>
    );
  }

  // Ensure social_links and visibility are always defined
  const safeProfile = {
    ...profile,
    social_links: profile.social_links || { github: '', linkedin: '', portfolio: '', company: '' },
    visibility: profile.visibility || { github: true, linkedin: true, portfolio: true, company: true },
  };

  return (
    <div className={styles.outerBox}>
      <div className={styles.profileBox}>
        <form onSubmit={handleSubmit}>
          <div className={styles.topRow}>
            <div className={styles.profilePicBox}>
              {profile.profile_picture ? (
                <Image
                  src={profile.profile_picture}
                  alt={profile.user_name}
                  width={120}
                  height={120}
                  className={styles.profilePic}
                />
              ) : (
                <span><UserIcon className={styles.profilePicPlaceholder} size={120} /></span>
              )}
              <button type="button" className={styles.changePhotoButton} style={{marginTop: '1rem'}}>Change Photo</button>
            </div>
            <div className={styles.bioBox}>
              <div className={styles.userName}>
                <input
                  type="text"
                  id="user_name"
                  name="user_name"
                  value={profile.user_name}
                  onChange={handleChange}
                  className={styles.userName}
                  style={{width: '100%', fontSize: '2rem', fontWeight: 700, border: 'none', background: 'transparent'}}
                  required
                />
              </div>
              <div className={styles.bioText}>
                <textarea
                  id="bio"
                  name="bio"
                  value={profile.bio}
                  onChange={handleChange}
                  rows={3}
                  className={styles.bioText}
                  style={{width: '100%', border: 'none', background: 'transparent', resize: 'vertical'}}
                />
              </div>
              <div className={styles.locationRow}>
                <span><MapIcon size={18} style={{ marginRight: 4 }} /></span> Location not set
              </div>
              <div style={{marginTop: '1rem'}}>
                <label htmlFor="email" style={{fontWeight: 500}}>Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={session?.user?.email || ''}
                  disabled
                  style={{width: '100%', background: '#f4f4f4', color: '#888', border: '1px solid #ddd', marginTop: '0.25rem'}}
                />
              </div>
              <button type="button" style={{marginTop: '1rem', background: '#2b6cb0', color: 'white', border: 'none', borderRadius: 6, padding: '0.5rem 1.5rem', cursor: 'pointer'}} onClick={() => router.push('/profile/change-password')}>Change Password</button>
            </div>
          </div>
          <div className={styles.middleRow}>
            <div className={styles.statsBox}>
              <div className={styles.statItem}>
                <div className={styles.statValue}>{profile.total_questions_solved}</div>
                <div className={styles.statLabel}>Problems Solved</div>
              </div>
              <div className={styles.statItem}>
                <div className={styles.statValue}>{profile.total_score}</div>
                <div className={styles.statLabel}>Total Score</div>
              </div>
            </div>
          </div>
          <div className={styles.bottomRow}>
            <div className={styles.contributionOuterBox} style={{ overflowX: 'auto' }}>
              <ActivityCalendar
                data={profile.contribution_data || []}
                blockSize={14}
                blockMargin={3}
                fontSize={14}
              />
            </div>
          </div>
          {/* Social Links Section */}
          <div className={styles.socialSection}>
            <h2 className={styles.sectionTitle}>Social Links</h2>
            <div className={styles.socialLinks}>
              {Object.entries(safeProfile.social_links).map(([key, value]) => (
                <div key={key} className={styles.socialLinkGroup}>
                  <div className={styles.socialLinkHeader}>
                    <label htmlFor={`social_${key}`}>{key.charAt(0).toUpperCase() + key.slice(1)}</label>
                    <label className={styles.visibilityToggle}>
                      <input
                        type="checkbox"
                        name={`visibility_${key}`}
                        checked={safeProfile.visibility[key as keyof PrivateProfile['visibility']]}
                        onChange={handleChange}
                      />
                      <span className={styles.toggleLabel}>Public</span>
                    </label>
                  </div>
                  <input
                    type="url"
                    id={`social_${key}`}
                    name={`social_${key}`}
                    value={value || ''}
                    onChange={handleChange}
                    placeholder={`Enter your ${key} URL`}
                  />
                </div>
              ))}
            </div>
            <div className={styles.formActions}>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={() => router.back()}
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
          </div>
        </form>
      </div>
    </div>
  );
} 