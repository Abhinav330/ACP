'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import styles from './profile.module.css';
import { 
  FaUserCircle, 
  FaLinkedin, 
  FaGlobe, 
  FaTrophy, 
  FaMedal,
  FaCrown,
  FaStar
} from 'react-icons/fa';

interface PublicProfile {
  user_name: string;
  profile_picture?: string;
  bio?: string;
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

export default function PublicProfile() {
  const router = useRouter();
  const params = useParams();
  const { data: session, status } = useSession();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const userId = params?.userId as string;
        if (!userId) throw new Error('User ID not found');
        const response = await fetch(`http://localhost:8000/api/profiles/${userId}`, {
          headers: {
            'Content-Type': 'application/json',
            ...(session?.user?.token && {
              'Authorization': `Bearer ${session.user.token}`,
              'X-User-Email': session.user.email || ''
            })
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
    if (params?.userId) fetchProfile();
  }, [params, session]);

  const getThemeClass = (topPercentage: number) => {
    if (topPercentage <= 1) return styles.goldTheme;
    if (topPercentage <= 5) return styles.silverTheme;
    if (topPercentage <= 10) return styles.bronzeTheme;
    return '';
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

  const themeClass = getThemeClass(profile.top_percentage);

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
              <h1 className={styles.userName}>{profile.user_name}</h1>
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