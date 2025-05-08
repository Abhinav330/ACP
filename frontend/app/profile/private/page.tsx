'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import { 
  FaUserCircle, 
  FaLinkedin, 
  FaGlobe, 
  FaTrophy, 
  FaMedal,
  FaLock,
  FaEdit,
  FaKey
} from 'react-icons/fa';
import styles from './private.module.css';

interface PrivateProfile {
  user_name: string;
  email: string;
  profile_picture?: string;
  bio: string;
  total_questions_solved: number;
  total_score: number;
  top_percentage: number;
  linkedin_url?: string;
  website_url?: string;
  achievements: {
    title: string;
    description: string;
    icon_type: 'trophy' | 'medal';
    date_earned: string;
  }[];
  activity_logs: {
    activity_type: string;
    activity_date: string;
    details: string;
  }[];
}

export default function PrivateProfile() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [profile, setProfile] = useState<PrivateProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }

    const fetchProfile = async () => {
      try {
        if (!session?.user?.token) return;

        const response = await fetch('http://localhost:8000/api/private-profile', {
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

    if (status === 'authenticated') {
      fetchProfile();
    }
  }, [router, session, status]);

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !session?.user?.token) return;

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

      if (!response.ok) throw new Error('Failed to update profile');
      setIsEditing(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update profile');
    }
  };

  const handleProfilePictureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !session?.user?.token) return;

    const formData = new FormData();
    formData.append('profile_picture', e.target.files[0]);

    try {
      const response = await fetch('http://localhost:8000/api/upload-profile-picture', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.user.token}`,
          'X-User-Email': session.user.email || ''
        },
        body: formData
      });

      if (!response.ok) throw new Error('Failed to upload profile picture');
      const data = await response.json();
      setProfile(prev => prev ? { ...prev, profile_picture: data.profile_picture_url } : null);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to upload profile picture');
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
        <button className={styles.backButton} onClick={() => router.push('/')}>
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.profileCard}>
        <div className={styles.profileHeader}>
          <div className={styles.profilePictureSection}>
            <div className={styles.profilePictureContainer}>
              {profile.profile_picture ? (
                <Image
                  src={profile.profile_picture}
                  alt={profile.user_name}
                  width={150}
                  height={150}
                  className={styles.profilePicture}
                />
              ) : (
                <FaUserCircle className={styles.profilePicturePlaceholder} />
              )}
            </div>
            <label className={styles.uploadButton}>
              <input
                type="file"
                accept="image/*"
                onChange={handleProfilePictureChange}
                style={{ display: 'none' }}
              />
              Change Photo
            </label>
          </div>

          <div className={styles.profileInfo}>
            <div className={styles.nameSection}>
              <h1 className={styles.userName}>{profile.user_name}</h1>
              <span className={styles.email}>{profile.email}</span>
            </div>

            <div className={styles.statsGrid}>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{profile.total_questions_solved}</div>
                <div className={styles.statLabel}>Problems Solved</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statValue}>{profile.total_score}</div>
                <div className={styles.statLabel}>Total Score</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statValue}>Top {profile.top_percentage}%</div>
                <div className={styles.statLabel}>Ranking</div>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.profileContent}>
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2>Bio</h2>
              <button
                className={styles.editButton}
                onClick={() => setIsEditing(!isEditing)}
              >
                <FaEdit />
              </button>
            </div>
            {isEditing ? (
              <textarea
                className={styles.bioInput}
                value={profile.bio}
                onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                rows={4}
              />
            ) : (
              <p className={styles.bioText}>{profile.bio}</p>
            )}
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2>Social Links</h2>
              {isEditing && (
                <button
                  className={styles.editButton}
                  onClick={() => setIsEditing(!isEditing)}
                >
                  <FaEdit />
                </button>
              )}
            </div>
            <div className={styles.socialLinks}>
              <div className={styles.socialLink}>
                <FaLinkedin className={styles.socialIcon} />
                {isEditing ? (
                  <input
                    type="url"
                    value={profile.linkedin_url || ''}
                    onChange={(e) => setProfile({ ...profile, linkedin_url: e.target.value })}
                    placeholder="LinkedIn URL"
                    className={styles.socialInput}
                  />
                ) : (
                  <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer">
                    {profile.linkedin_url || 'Add LinkedIn URL'}
                  </a>
                )}
              </div>
              <div className={styles.socialLink}>
                <FaGlobe className={styles.socialIcon} />
                {isEditing ? (
                  <input
                    type="url"
                    value={profile.website_url || ''}
                    onChange={(e) => setProfile({ ...profile, website_url: e.target.value })}
                    placeholder="Website URL"
                    className={styles.socialInput}
                  />
                ) : (
                  <a href={profile.website_url} target="_blank" rel="noopener noreferrer">
                    {profile.website_url || 'Add Website URL'}
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2>Achievements</h2>
            </div>
            <div className={styles.achievementsGrid}>
              {profile.achievements.map((achievement, index) => (
                <div key={index} className={styles.achievementCard}>
                  <div className={styles.achievementIcon}>
                    {achievement.icon_type === 'trophy' ? (
                      <FaTrophy className={styles.trophyIcon} />
                    ) : (
                      <FaMedal className={styles.medalIcon} />
                    )}
                  </div>
                  <div className={styles.achievementInfo}>
                    <h3 className={styles.achievementTitle}>{achievement.title}</h3>
                    <p className={styles.achievementDescription}>{achievement.description}</p>
                    <span className={styles.achievementDate}>
                      {new Date(achievement.date_earned).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2>Recent Activity</h2>
            </div>
            <div className={styles.activityList}>
              {profile.activity_logs.map((activity, index) => (
                <div key={index} className={styles.activityItem}>
                  <div className={styles.activityIcon}>
                    {activity.activity_type === 'question_solved' ? (
                      <FaTrophy className={styles.activityTrophyIcon} />
                    ) : (
                      <FaMedal className={styles.activityMedalIcon} />
                    )}
                  </div>
                  <div className={styles.activityInfo}>
                    <p className={styles.activityDetails}>{activity.details}</p>
                    <span className={styles.activityDate}>
                      {new Date(activity.activity_date).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {isEditing && (
          <div className={styles.actionButtons}>
            <button
              className={styles.cancelButton}
              onClick={() => setIsEditing(false)}
            >
              Cancel
            </button>
            <button
              className={styles.saveButton}
              onClick={handleProfileUpdate}
            >
              Save Changes
            </button>
          </div>
        )}

        <button
          className={styles.changePasswordButton}
          onClick={() => setShowPasswordModal(true)}
        >
          <FaKey className={styles.passwordIcon} />
          Change Password
        </button>
      </div>
    </div>
  );
} 