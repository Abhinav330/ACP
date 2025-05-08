'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import styles from './problems.module.css';
import { apiRequest } from '@/app/utils/api';

interface Section {
  id: string;
  title: string;
  description: string;
  inDevelopment?: boolean;
}

interface ModuleProgress {
  score: number;
  completed: number;
  total: number;
  percentage: number;
}

const Problems = () => {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [progress, setProgress] = useState<Record<string, ModuleProgress>>({});
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchModuleProgress = async () => {
      try {
        // Check NextAuth session
        if (status === 'unauthenticated') {
          router.push('/login');
          return;
        }

        if (!session?.user?.id) {
          console.warn('Required user data is not available in session');
          return;
        }

        const userId = session.user.id;

        // Fetch progress for each module
        const moduleIds = ['pandas', 'sklearn', 'ai'];
        const progressData: Record<string, ModuleProgress> = {};

        // Create an array of promises but handle each request individually
        const progressPromises = moduleIds.map(async (moduleId) => {
          try {
            const data = await apiRequest(`/api/user/module-progress/${userId}/${moduleId}`);
            return {
              moduleId,
              data: {
                score: data.score,
                completed: data.completed,
                total: data.total,
                percentage: data.percentage
              }
              };
          } catch (error) {
            console.error(`Error fetching progress for ${moduleId}:`, error);
            return {
              moduleId,
              data: {
                score: 0,
                completed: 0,
                total: 0,
                percentage: 0
              }
            };
          }
        });

        // Wait for all requests to complete and process results
        const results = await Promise.all(progressPromises);
        
        // Update progress data from results
        results.forEach(({ moduleId, data }) => {
          progressData[moduleId] = data;
        });

        setProgress(progressData);
        setError(null);
      } catch (error) {
        console.error('Error fetching module progress:', error);
        setError('Failed to load progress data. Please try again later.');
        // Set default progress values on error
        setProgress({
          pandas: { score: 0, completed: 0, total: 0, percentage: 0 },
          sklearn: { score: 0, completed: 0, total: 0, percentage: 0 },
          ai: { score: 0, completed: 0, total: 0, percentage: 0 }
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (status === 'authenticated') {
      fetchModuleProgress();
    }
  }, [router, session, status]);

  // Show loading state while checking authentication
  if (status === 'loading' || isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  const sections: Section[] = [
    {
      id: 'pandas',
      title: 'Pandas',
      description: 'Become expert in using pandas by practicing questions from basic to advanced.'
    },
    {
      id: 'sklearn',
      title: 'Sklearn',
      description: 'Become expert in using Scikit learn by practicing questions from preprocessing data to model evaluation.'
    },
    {
      id: 'ai',
      title: 'AI',
      description: 'This module is under development. Master artificial intelligence concepts through hands-on practice with real-world problems.',
      inDevelopment: false
    }
  ];

  return (
    <div className={styles.container} suppressHydrationWarning>
      <h1 className={styles.title}>AI Coding Challenges</h1>
      <p className={styles.subtitle}>
        Master Data Science and AI through hands-on practice
      </p>
      
      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}
      
      <div className={styles.modulesGrid}>
        {sections.map((section) => {
          const moduleProgress = progress[section.id] || {
            score: 0,
            completed: 0,
            total: 0,
            percentage: 0
          };
          
          return (
            <div key={section.id} className={styles.moduleCard}>
              <div className={styles.moduleContent}>
                {/* Progress Bar */}
                {!section.inDevelopment && (
                  <div className={styles.progressContainer}>
                    <div className={styles.progressBarWrapper}>
                      <div className={styles.progressBar}>
                        <div 
                          className={styles.progressFill} 
                          style={{ width: `${moduleProgress.percentage}%` }}
                        />
                      </div>
                      <span className={styles.progressCount}>
                        {moduleProgress.completed}/{moduleProgress.total}
                      </span>
                    </div>
                  </div>
                )}
                
                <h2 className={styles.moduleTitle}>
                  {section.title}
                  {section.inDevelopment && (
                    <span className={styles.developmentBadge}>(In Development)</span>
                  )}
                </h2>
                <p className={styles.moduleDescription}>{section.description}</p>
              </div>
              
              <div className={styles.moduleAction}>
                {section.inDevelopment ? (
                  <button className={`${styles.exploreButton} ${styles.disabled}`} disabled>
                    Coming Soon
                  </button>
                ) : (
                  <Link href={`/problems/${section.id}`} className={styles.exploreButton}>
                    Explore {section.title}
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Problems; 