'use client';

import React, { useEffect, useState } from 'react';
import { apiRequest } from '@/utils/api';
import styles from './Leaderboard.module.css';

interface LeaderboardEntry {
  user_id: string;
  user_name: string;
  total_score: number;
  questions_count: number;
}

const Leaderboard: React.FC = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        setIsLoading(true);
        setError('');
        const data = await apiRequest('/api/leaderboard');
        setLeaderboard(data);
      } catch (error) {
        console.error('Error fetching leaderboard:', error);
        setError('Failed to load leaderboard');
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  if (isLoading) {
    return <div className={styles.loading}>Loading leaderboard...</div>;
  }

  if (error) {
    return <div className={styles.error}>{error}</div>;
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Top Performers</h2>
      <div className={styles.leaderboard}>
        {leaderboard.map((entry, index) => (
          <div key={entry.user_id} className={styles.entry}>
            <div className={styles.rank}>
              {index + 1}
              {index === 0 && <span className={styles.crown}>👑</span>}
            </div>
            <div className={styles.userInfo}>
              <span className={styles.userName}>{entry.user_name}</span>
              <div className={styles.stats}>
                <span className={styles.score}>
                  {entry.total_score} points
                </span>
                <span className={styles.solved}>
                  {entry.questions_count} solved
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Leaderboard; 