'use client';

import React from 'react';
import { IconType } from 'react-icons';
import { FaCode, FaCheck, FaTrophy, FaStar, FaUser } from 'react-icons/fa';
import styles from './ActivityLog.module.css';

interface Activity {
  id: number;
  activity_type: string;
  activity_date: string;
  details: string;
}

interface ActivityLogProps {
  activities: Activity[];
}

const activityIcons: Record<string, IconType> = {
  question_solved: FaCheck,
  achievement_earned: FaTrophy,
  profile_updated: FaUser,
  milestone_reached: FaStar,
  default: FaCode,
};

export default function ActivityLog({ activities }: ActivityLogProps) {
  if (!activities.length) {
    return (
      <div className={styles.emptyState}>
        <p>No recent activity to display.</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {activities.map((activity, index) => {
        const Icon = activityIcons[activity.activity_type] || activityIcons.default;
        const date = new Date(activity.activity_date);
        const formattedDate = date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        return (
          <div key={activity.id} className={styles.activityItem}>
            <div className={styles.timeline}>
              <div className={styles.iconWrapper}>
                <Icon className={styles.icon} />
              </div>
              {index !== activities.length - 1 && <div className={styles.line} />}
            </div>
            <div className={styles.content}>
              <div className={styles.header}>
                <span className={styles.type}>
                  {activity.activity_type.replace(/_/g, ' ').toUpperCase()}
                </span>
                <span className={styles.date}>{formattedDate}</span>
              </div>
              <p className={styles.details}>{activity.details}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
} 