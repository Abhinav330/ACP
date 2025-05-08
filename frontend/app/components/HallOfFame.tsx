'use client';

import React from 'react';
import { IconType } from 'react-icons';
import { FaCrown, FaMedal, FaTrophy } from 'react-icons/fa';
import styles from './HallOfFame.module.css';

interface User {
  id: number;
  user_name: string;
  profile_picture: string;
  total_score: number;
  top_percentage: number;
}

interface HallOfFameProps {
  users: User[];
}

const rankIcons: Record<number, IconType> = {
  1: FaCrown,
  2: FaMedal,
  3: FaTrophy,
};

export default function HallOfFame({ users }: HallOfFameProps) {
  const topUsers = users.slice(0, 10);

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Hall of Fame</h2>
      <div className={styles.list}>
        {topUsers.map((user, index) => {
          const rank = index + 1;
          const Icon = rankIcons[rank];
          const themeClass = rank <= 3 ? styles[`rank${rank}`] : '';

          return (
            <div key={user.id} className={`${styles.userCard} ${themeClass}`}>
              <div className={styles.rank}>
                {Icon && <Icon className={styles.rankIcon} />}
                <span className={styles.rankNumber}>{rank}</span>
              </div>
              <div className={styles.profilePicture}>
                {user.profile_picture ? (
                  <img
                    src={user.profile_picture}
                    alt={user.user_name}
                    className={styles.image}
                  />
                ) : (
                  <div className={styles.placeholder}>
                    {user.user_name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className={styles.userInfo}>
                <h3 className={styles.userName}>{user.user_name}</h3>
                <div className={styles.stats}>
                  <span className={styles.score}>
                    Score: {user.total_score}
                  </span>
                  <span className={styles.percentage}>
                    Top {user.top_percentage}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
} 