'use client';

import React, { useEffect, useState } from 'react';
import { apiRequest } from '@/utils/api';
import styles from './UserProgress.module.css';

interface ModuleProgress {
  score: number;
  completed: number;
  total: number;
  percentage: number;
}

interface Submission {
  status: string;
  score: number;
  submitted_at: string;
  test_cases_passed: number;
  total_test_cases: number;
  execution_time: number;
  memory_used: number;
  code: string;
}

interface UserProgressProps {
  userId: string;
  moduleId?: string;
  questionId?: string;
}

const UserProgress: React.FC<UserProgressProps> = ({ userId, moduleId, questionId }) => {
  const [moduleProgress, setModuleProgress] = useState<ModuleProgress | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError('');

        // Fetch module progress if moduleId is provided
        if (moduleId) {
          const progressData = await apiRequest(`/api/user/module-progress/${userId}/${moduleId}`);
          setModuleProgress(progressData);
        }

        // Fetch submissions if questionId is provided
        if (questionId) {
          const submissionsData = await apiRequest(`/api/submissions/${userId}/${questionId}`);
          setSubmissions(submissionsData);
        }
      } catch (error) {
        console.error('Error fetching progress data:', error);
        setError('Failed to load progress data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [userId, moduleId, questionId]);

  if (isLoading) {
    return <div className={styles.loading}>Loading progress...</div>;
  }

  if (error) {
    return <div className={styles.error}>{error}</div>;
  }

  return (
    <div className={styles.container}>
      {moduleProgress && (
        <div className={styles.progressSection}>
          <h3 className={styles.sectionTitle}>Module Progress</h3>
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill} 
              style={{ width: `${moduleProgress.percentage}%` }}
            >
              <span className={styles.progressText}>
                {Math.round(moduleProgress.percentage)}%
              </span>
            </div>
          </div>
          <div className={styles.stats}>
            <div className={styles.stat}>
              <span className={styles.label}>Score:</span>
              <span className={styles.value}>{moduleProgress.score}</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.label}>Completed:</span>
              <span className={styles.value}>{moduleProgress.completed} / {moduleProgress.total}</span>
            </div>
          </div>
        </div>
      )}

      {questionId && submissions.length > 0 && (
        <div className={styles.submissionsSection}>
          <h3 className={styles.sectionTitle}>Your Submissions</h3>
          <div className={styles.submissionsList}>
            {submissions.map((submission, index) => (
              <div 
                key={index} 
                className={`${styles.submissionCard} ${styles[submission.status.toLowerCase()]}`}
              >
                <div className={styles.submissionHeader}>
                  <span className={styles.status}>{submission.status}</span>
                  <span className={styles.date}>
                    {new Date(submission.submitted_at).toLocaleString()}
                  </span>
                </div>
                <div className={styles.submissionDetails}>
                  <div className={styles.detail}>
                    <span className={styles.label}>Score:</span>
                    <span className={styles.value}>{submission.score}</span>
                  </div>
                  <div className={styles.detail}>
                    <span className={styles.label}>Test Cases:</span>
                    <span className={styles.value}>
                      {submission.test_cases_passed} / {submission.total_test_cases}
                    </span>
                  </div>
                  <div className={styles.detail}>
                    <span className={styles.label}>Time:</span>
                    <span className={styles.value}>{submission.execution_time.toFixed(2)}ms</span>
                  </div>
                  <div className={styles.detail}>
                    <span className={styles.label}>Memory:</span>
                    <span className={styles.value}>{submission.memory_used.toFixed(2)}MB</span>
                  </div>
                </div>
                <details className={styles.codeDetails}>
                  <summary>View Code</summary>
                  <pre className={styles.code}>
                    <code>{submission.code}</code>
                  </pre>
                </details>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserProgress; 