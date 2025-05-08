'use client';

import React from 'react';
import { IconType } from 'react-icons';
import { FaTrophy, FaMedal, FaStar, FaAward, FaCrown } from 'react-icons/fa';
import styles from './AchievementsList.module.css';

interface Achievement {
  id: number;
  title: string;
  description: string;
  icon_type: string;
  date_earned: string;
}

interface AchievementsListProps {
  achievements: Achievement[];
}

const iconMap: Record<string, IconType> = {
  trophy: FaTrophy,
  medal: FaMedal,
  star: FaStar,
  award: FaAward,
  crown: FaCrown,
};

export default function AchievementsList({ achievements }: AchievementsListProps) {
  if (!achievements.length) {
    return (
      <div className={styles.emptyState}>
        <p>No achievements earned yet. Keep practicing to earn badges!</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {achievements.map((achievement) => {
        const Icon = iconMap[achievement.icon_type] || FaAward;
        const date = new Date(achievement.date_earned);
        const formattedDate = date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });

        return (
          <div key={achievement.id} className={styles.achievement}>
            <div className={styles.iconContainer}>
              <Icon className={styles.icon} />
            </div>
            <div className={styles.content}>
              <h3 className={styles.title}>{achievement.title}</h3>
              <p className={styles.description}>{achievement.description}</p>
              <span className={styles.date}>Earned on {formattedDate}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
} 