'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import { 
  FaUserCircle, 
  FaLinkedin, 
  FaGlobe, 
  FaTrophy, 
  FaMedal,
  FaCrown,
  FaStar,
  FaEdit,
  FaKey
} from 'react-icons/fa';
import styles from './Profile.module.css';
// @ts-ignore
import drawContributionGraph from 'github-contribution-graph';
import '@/app/styles/contribution-graph.css';

interface ProfileProps {
  userId?: string;
  isPrivate?: boolean;
  onEdit?: () => void;
  onChangePassword?: () => void;
}

interface ProfileData {
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
  first_name?: string;
  last_name?: string;
  username?: string;
  contribution_data?: { date: string; count: number }[];
}

export default function Profile({ userId, isPrivate = false, onEdit, onChangePassword }: ProfileProps) {
  const { data: session } = useSession();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        if (!session?.user?.token) return;

        const endpoint = userId 
          ? `${process.env.NEXT_PUBLIC_API_URL}/api/profiles/${userId}`
          : `${process.env.NEXT_PUBLIC_API_URL}/api/private-profile`;

        const response = await fetch(endpoint, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.user.token}`,
            'X-User-Email': session.user.email || ''
          }
        });

        if (!response.ok) throw new Error('Failed to fetch profile');
        const data = await response.json();
        setProfile({
          ...data,
          achievements: Array.isArray(data.achievements) ? data.achievements : [],
          activity_logs: Array.isArray(data.activity_logs) ? data.activity_logs : [],
        });
      } catch (error) {
        setError(error instanceof Error ? error.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [session, userId]);

  const handleProfilePictureChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !session?.user?.token) return;

    const formData = new FormData();
    formData.append('profile_picture', e.target.files[0]);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/upload-profile-picture`, {
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
      </div>
    );
  }

  const themeClass = profile.top_percentage <= 10 ? styles.topRank : '';

  return (
    <div className={`${styles.container} ${themeClass}`}>
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
            {isPrivate && (
              <label className={styles.uploadButton}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleProfilePictureChange}
                  style={{ display: 'none' }}
                />
                Change Photo
              </label>
            )}
            {profile.top_percentage <= 10 && (
              <div className={styles.rankBadge}>
                {profile.top_percentage <= 1 ? (
                  <FaCrown className={styles.crownIcon} />
                ) : (
                  <FaStar className={styles.starIcon} />
                )}
                <span>Top {profile.top_percentage}%</span>
              </div>
            )}
          </div>

          <div className={styles.profileInfo}>
            <div className={styles.nameSection}>
              <h1 className={styles.userName}>{profile.first_name || ''} {profile.last_name || ''}</h1>
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

            {isPrivate && (
              <div className={styles.actionButtons}>
                <button className={styles.editButton} onClick={onEdit}>
                  <FaEdit className={styles.buttonIcon} />
                  Edit Profile
                </button>
                <button className={styles.passwordButton} onClick={onChangePassword}>
                  <FaKey className={styles.buttonIcon} />
                  Change Password
                </button>
              </div>
            )}
          </div>
        </div>

        <div className={styles.profileContent}>
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2>Username</h2>
            </div>
            <p className={styles.usernameText}>@{profile.username}</p>
          </div>
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2>Bio</h2>
            </div>
            <p className={styles.bioText}>{profile.bio}</p>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h2>Social Links</h2>
            </div>
            <div className={styles.socialLinks}>
              {profile.linkedin_url && (
                <a
                  href={profile.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.socialLink}
                >
                  <FaLinkedin className={styles.socialIcon} />
                  LinkedIn Profile
                </a>
              )}
              {profile.website_url && (
                <a
                  href={profile.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.socialLink}
                >
                  <FaGlobe className={styles.socialIcon} />
                  Personal Website
                </a>
              )}
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
            {/* Contribution Graph */}
            {profile.contribution_data && profile.contribution_data.length > 0 ? (
              <ContributionGraph data={formatContributionData(profile.contribution_data)} />
            ) : (
              <div className={styles.noActivity}>No recent activity</div>
            )}
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
      </div>
    </div>
  );
}

// ContributionGraph component
interface ContributionGraphProps {
  data: Record<string, { done: number; not_done: number; date: string }[]>;
}
function ContributionGraph({ data }: ContributionGraphProps) {
  useEffect(() => {
    drawContributionGraph({
      data,
      ssr: false,
      config: {
        graphMountElement: '#contribution-graph',
        graphWidth: 723,
        graphHeight: 113,
        graphTheme: 'standard',
      },
    });
  }, [data]);
  return <div id="contribution-graph" />;
}

// Helper to format contribution_data for the graph
function formatContributionData(
  contributionData: { date: string; count: number }[]
): Record<string, { done: number; not_done: number; date: string }[]> {
  const result: Record<string, { done: number; not_done: number; date: string }[]> = {};
  contributionData.forEach((item) => {
    const year = item.date.slice(0, 4);
    if (!result[year]) result[year] = [];
    result[year].push({
      done: item.count,
      not_done: 0,
      date: item.date,
    });
  });
  return result;
} 