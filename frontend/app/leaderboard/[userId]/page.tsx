'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import styles from './userDetails.module.css';

interface QuestionSolved {
  title: string;
  tags: string[];
  solved_at: string;
  points_earned: number;
  total_points: number;
}

interface UserDetails {
  user_name: string;
  total_score: number;
  questions: QuestionSolved[];
}

export default function UserDetails() {
  const router = useRouter();
  const params = useParams();
  const { data: session, status } = useSession();
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }

    const fetchUserDetails = async () => {
      try {
        if (status !== 'authenticated' || !session?.user?.token) {
          setError('Please log in to view user details');
          return;
        }

        // Get userId from params
        const userId = params?.userId as string;
        if (!userId) {
          throw new Error('User ID not found');
        }

        const response = await fetch(`http://localhost:8000/api/user-performance/${userId}`, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.user.token}`,
            'X-User-Email': session.user.email || ''
          }
        });

        if (response.status === 403) {
          throw new Error('You do not have permission to view this user\'s details');
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(errorData?.detail || 'Failed to fetch user details');
        }

        const data = await response.json();
        setUserDetails(data);
      } catch (error) {
        setError(error instanceof Error ? error.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    if (params?.userId && status === 'authenticated') {
      fetchUserDetails();
    }
  }, [params, router, session, status]);

  if (status === 'loading' || isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading user details...</div>
      </div>
    );
  }

  if (error || !userDetails) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>{error || 'Failed to load user details'}</div>
        <button 
          className={styles.backButton}
          onClick={() => router.push('/leaderboard')}
        >
          Back to Leaderboard
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button 
          className={styles.backButton}
          onClick={() => router.push('/leaderboard')}
        >
          Back to Leaderboard
        </button>
        <h1 className={styles.title}>{userDetails.user_name}'s Performance</h1>
        <div className={styles.totalScore}>
          Total Score: {userDetails.total_score}
        </div>
      </div>

      <div className={styles.questionsContainer}>
        <h2 className={styles.subtitle}>Solved Questions</h2>
        <div className={styles.questionsList}>
          {userDetails.questions.length === 0 ? (
            <div className={styles.noQuestions}>No questions solved yet.</div>
          ) : (
            userDetails.questions.map((question, index) => (
            <div key={index} className={styles.questionCard}>
              <h3 className={styles.questionTitle}>{question.title}</h3>
              <div className={styles.tags}>
                {question.tags.map((tag, tagIndex) => (
                  <span key={tagIndex} className={styles.tag}>{tag}</span>
                ))}
              </div>
              <div className={styles.details}>
                <span className={styles.date}>
                  {new Date(question.solved_at).toLocaleString()}
                </span>
                <span className={styles.points}>
                  Points: {question.points_earned}/{question.total_points}
                </span>
              </div>
            </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
} 