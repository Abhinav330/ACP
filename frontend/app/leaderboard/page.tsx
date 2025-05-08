'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import styles from './leaderboard.module.css';

interface LeaderboardEntry {
  user_id: string;
  user_name: string;
  total_score: number;
  questions_solved: number;
}

interface LeaderboardResponse {
  rankings: LeaderboardEntry[];
  total_users: number;
  page: number;
  total_pages: number;
}

const Leaderboard = () => {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardResponse>({
    rankings: [],
    total_users: 0,
    page: 1,
    total_pages: 1
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (status === 'unauthenticated') {
          router.push('/login');
          return;
        }

    if (status === 'authenticated' && session?.user?.token) {
      const fetchLeaderboard = async () => {
        try {
          setIsLoading(true);
          setError(null);

          const response = await fetch(`http://localhost:8000/api/leaderboard?page=${currentPage}`, {
          headers: {
            'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.user.token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch leaderboard data');
        }

        const data = await response.json();
        setLeaderboardData(data);
      } catch (error) {
        setError(error instanceof Error ? error.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeaderboard();
    }
  }, [router, currentPage, session, status]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading leaderboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>{error}</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Leaderboard</h1>
      <div className={styles.leaderboardWrapper}>
        <div className={styles.leaderboardHeader}>
          <div className={styles.rank}>Rank</div>
          <div className={styles.name}>Name</div>
          <div className={styles.score}>Score</div>
          <div className={styles.solved}>Problems Solved</div>
        </div>
        
        <div className={styles.leaderboardBody}>
          {leaderboardData.rankings.map((entry, index) => (
            <div key={entry.user_id} className={styles.leaderboardRow}>
              <div className={styles.rank}>
                {(currentPage - 1) * 10 + index + 1}
                {index < 3 && (
                  <span className={`${styles.medal} ${styles[`medal${index + 1}`]}`}>
                    🏆
                  </span>
                )}
              </div>
              <div className={styles.name}>
              <Link 
                  href={`/profile/${entry.user_id}`}
                  className={styles.nameLink}
              >
                  {entry.user_name}
                </Link>
              </div>
                <div className={styles.score}>{entry.total_score}</div>
              <div className={styles.solved}>{entry.questions_solved}</div>
            </div>
          ))}
          
          {leaderboardData.rankings.length === 0 && (
            <div className={styles.noData}>
              No entries yet. Start solving problems to appear on the leaderboard!
            </div>
          )}
        </div>

        {leaderboardData.total_pages > 1 && (
          <div className={styles.pagination}>
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className={styles.pageButton}
            >
              Previous
            </button>
            <span className={styles.pageInfo}>
              Page {currentPage} of {leaderboardData.total_pages}
            </span>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === leaderboardData.total_pages}
              className={styles.pageButton}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Leaderboard; 