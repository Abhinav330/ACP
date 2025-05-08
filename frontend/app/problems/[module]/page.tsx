'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import styles from '../problems.module.css';
import { apiRequest } from '@/utils/api';

interface Question {
  id: string;
  title: string;
  description: string;
  category: string[];
  difficulty: 'Easy' | 'Medium' | 'Hard';
  points: number;
  summary: string;
  Q_type: 'pandas' | 'sklearn' | 'ai';
}

interface QuestionScore {
  score: number;
  total: number;
}

interface ModuleProgress {
  score: number;
  completed: number;
  total: number;
  percentage: number;
  solved_questions: { [key: string]: boolean };
  question_scores: { [key: string]: QuestionScore };
}

interface ModuleInfo {
  [key: string]: {
    title: string;
    description: string;
  };
}

interface PageParams {
  module: string;
}

// Custom error types
class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

class DataFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DataFetchError';
  }
}

class FilterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FilterError';
  }
}

const ModuleQuestions = ({ params }: { params: Promise<PageParams> }) => {
  const moduleParam = React.use(params).module;
  const router = useRouter();
  const { data: session, status } = useSession();
  const [category, setCategory] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [moduleProgress, setModuleProgress] = useState<ModuleProgress | null>(null);
  const [filters, setFilters] = useState<{ categories: string[], difficulties: string[] }>({
    categories: [],
    difficulties: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const moduleInfo: ModuleInfo = {
    pandas: {
      title: 'Pandas',
      description: 'Become expert in using pandas by practicing questions from basic to advanced.'
    },
    sklearn: {
      title: 'Sklearn',
      description: 'Become expert in using Scikit learn by practicing questions from preprocessing data to model evaluation.'
    },
    ai: {
      title: 'AI',
      description: 'This module is currently in development.'
    }
  };

  const fetchData = async () => {
    if (!session?.user?.email || !session?.user?.id || !session?.user?.token) {
      console.warn('Required user data is not available in session');
      return;
    }

    const userEmail = session.user.email;
    const userId = session.user.id;
    const userToken = session.user.token;

      try {
        setError('');
      setIsLoading(true);
      
      if (!userEmail || !userToken || !userId) {
        throw new AuthenticationError('User credentials are missing');
      }

        const [questionsData, filtersData, progressData] = await Promise.all([
          fetchQuestions(userEmail, userToken),
          fetchFilters(userEmail, userToken),
          fetchModuleProgress(userId, moduleParam, userEmail, userToken)
        ]);
        
      if (!questionsData) {
        throw new DataFetchError('Failed to fetch questions');
      }

          const moduleQuestions = questionsData.filter((q: Question) => q.Q_type === moduleParam);
          setQuestions(moduleQuestions);
      
      if (!filtersData) {
        throw new DataFetchError('Failed to fetch filters');
        }
      setFilters(filtersData);
        
      if (!progressData) {
        throw new DataFetchError('Failed to fetch progress data');
      }
          setModuleProgress(progressData);
      } catch (error) {
        console.error('Error fetching data:', error);
      if (error instanceof AuthenticationError) {
        setError('Authentication failed. Please log in again.');
        router.push('/login');
      } else if (error instanceof DataFetchError) {
        setError('Failed to load data. Please try again later.');
      } else if (error instanceof Error) {
          setError(error.message);
      } else {
        setError('An unexpected error occurred');
        }
      } finally {
        setIsLoading(false);
      }
    };

  useEffect(() => {
    // Check authentication on mount
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }

    if (status === 'authenticated') {
      fetchData();
    }
  }, [moduleParam, session, status]);

  // Separate effect for category/difficulty changes
  useEffect(() => {
    if (!isLoading && questions.length > 0) {
      try {
        let filteredQuestions = [...questions];
        
        if (category) {
          filteredQuestions = filteredQuestions.filter(q => 
            q.category.includes(category)
          );
        }
        
        if (difficulty) {
          filteredQuestions = filteredQuestions.filter(q => 
            q.difficulty === difficulty
          );
        }
        
        setQuestions(filteredQuestions);
      } catch (error) {
        console.error('Error applying filters:', error);
        if (error instanceof Error) {
          setError(error.message);
        }
      }
    }
  }, [category, difficulty, isLoading]);

  const resetFilters = () => {
    setCategory('');
    setDifficulty('');
    if (session?.user?.email && session?.user?.token) {
      fetchQuestions(session.user.email, session.user.token)
        .then(data => {
        if (data) {
          const moduleQuestions = data.filter((q: Question) => q.Q_type === moduleParam);
          setQuestions(moduleQuestions);
        }
        })
        .catch(error => {
          console.error('Error resetting filters:', error);
        if (error instanceof Error) {
          setError(error.message);
        }
      });
    }
  };

  const fetchQuestions = async (userEmail: string, userToken: string) => {
    try {
      setError('');
      let url = 'http://localhost:8000/api/questions';
      if (category || difficulty) {
        const params = new URLSearchParams();
        if (category) params.append('category', category);
        if (difficulty) params.append('difficulty', difficulty);
        url += `?${params.toString()}`;
      }

      const response = await fetch(url, {
        headers: {
          'email': userEmail,
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch questions');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching questions:', error);
      if (error instanceof Error) {
        setError(error.message);
        if (error.message === 'Authentication required') {
          router.push('/login');
        }
      }
      return null;
    }
  };

  const fetchFilters = async (userEmail: string, userToken: string) => {
    try {
      setError('');
      const response = await fetch('http://localhost:8000/api/questions/filters', {
        headers: {
          'email': userEmail,
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch filters');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching filters:', error);
      if (error instanceof Error) {
        setError(error.message);
        if (error.message === 'Authentication required') {
          router.push('/login');
        }
      }
      return null;
    }
  };

  const fetchModuleProgress = async (userId: string, moduleId: string, userEmail: string, userToken: string) => {
    try {
      // Handle undefined user ID gracefully
      if (!userId || userId === "undefined") {
        console.warn('User ID is not available, using default progress values');
        return {
          score: 0,
          completed: 0,
          total: 0,
          percentage: 0,
          solved_questions: {},
          question_scores: {}
        };
      }
      
      const response = await fetch(`http://localhost:8000/api/user/module-progress/${userId}/${moduleId}`, {
        headers: {
          'email': userEmail,
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch module progress');
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching module progress:', error);
      if (error instanceof Error) {
        setError(error.message);
        if (error.message === 'Authentication required') {
          router.push('/login');
        }
      }
      return null;
    }
  };

  // Show loading state while checking authentication
  if (status === 'loading') {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  const currentModule = moduleInfo[moduleParam];
  if (!currentModule) {
    return <div className={styles.error}>Module not found</div>;
  }

  const getQuestionStatus = (questionId: string) => {
    if (!moduleProgress) return { text: 'Solve', className: '' };
    
    const isSolved = moduleProgress.solved_questions[questionId];
    const score = moduleProgress.question_scores[questionId];
    
    if (!score) return { text: 'Solve', className: '' };
    if (isSolved) return { text: 'Solved', className: styles.solved };
    return { text: 'Attempted', className: styles.attempted };
  };

  return (
    <div className={styles.container}>
      {isLoading ? (
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner}></div>
          <p>Loading questions...</p>
        </div>
      ) : error ? (
        <div className={styles.errorContainer}>
          <p className={styles.errorMessage}>{error}</p>
          <button 
            className={styles.retryButton}
            onClick={() => {
              if (session?.user?.email && session?.user?.token) {
                fetchData();
              }
            }}
          >
            Retry
          </button>
        </div>
      ) : (
        <>
      <div className={styles.moduleHeader}>
        <Link href="/problems" className={styles.backButton}>
          ← Back to Modules
        </Link>
        <h1 className={styles.title}>{currentModule.title} Questions</h1>
        <p className={styles.subtitle}>
          {currentModule.description}
        </p>
      </div>
      
      <div className={styles.filters}>
        <select 
          value={category}
          onChange={(e) => setCategory(e.target.value)}
              className={styles.filterSelect}
        >
          <option value="">All Categories</option>
              {filters.categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <select 
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
              className={styles.filterSelect}
        >
          <option value="">All Difficulties</option>
              {filters.difficulties.map(diff => (
            <option key={diff} value={diff}>{diff}</option>
          ))}
        </select>
            <button 
              onClick={resetFilters}
              className={styles.resetButton}
            >
              Reset Filters
            </button>
      </div>

      <div className={styles.problemsGrid}>
        {questions.length === 0 ? (
          <div className={styles.noQuestions}>
            No questions available for the selected filters.
          </div>
        ) : (
          questions.map((question) => {
            const status = getQuestionStatus(question.id);
            return (
              <div key={question.id} className={styles.problemCard}>
                <div className={styles.cardContent}>
                  <h3 className={styles.problemTitle}>{question.title}</h3>
                  <p className={styles.problemDescription}>{question.summary}</p>
                  
                  <div className={styles.problemMeta}>
                    {question.category.map((cat, index) => (
                      <span key={index} className={`${styles.tag} ${styles[cat.toLowerCase().replace(' ', '')]}`}>
                        {cat}
                      </span>
                    ))}
                    <span className={`${styles.tag} ${styles[question.difficulty.toLowerCase()]}`}>
                      {question.difficulty}
                    </span>
                    <span className={styles.score}>
                      {moduleProgress?.question_scores[question.id]?.score || 0}/{question.points} points
                    </span>
                  </div>
                </div>
                
                <div className={styles.cardAction}>
                  <Link 
                    href={`/problem/${question.id}`} 
                    className={`${styles.solveButton} ${status.className}`}
                  >
                    {status.text}
                  </Link>
                </div>
              </div>
            );
          })
        )}
      </div>
        </>
      )}
    </div>
  );
};

export default ModuleQuestions; 