'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Editor from '@monaco-editor/react';
import styles from './problem.module.css';
import dynamic from 'next/dynamic';
import '@uiw/react-markdown-preview/markdown.css';
import { apiRequest } from '@/app/utils/api';

interface Example {
  input: string;
  output: string;
  inputLanguage?: string;
  outputLanguage?: string;
  inputImage?: { url: string; caption: string; } | null;
  outputImage?: { url: string; caption: string; } | null;
}

interface StarterCode {
  language: string;
  code: string;
}

interface Question {
  id: string;
  title: string;
  description: string;
  summary: string;
  category: string[];
  difficulty: string;
  points: number;
  examples: Example[];
  starterCodes: StarterCode[];
  allowedLanguages: string[];
  docker_runner: string;
  images: Array<{ url: string; caption: string; }>;
}

interface TestResult {
  passed: boolean;
  error: string | null;
  output: string | null;
  expected: string;
}

interface Submission {
  _id: string;
  candidate_id: string;
  question_id: string;
  code_solve: string;
  score: number;
  status: string;
  submitted_at: string;
}

interface ExecutionResponse {
  status: string;
  results: TestResult[];
  score?: number;
  test_cases_passed?: number;
  total_test_cases?: number;
}

interface ProblemClientProps {
  id: string;
}

const ExpandIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
  </svg>
);

const CompressIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4h16v16H4z" />
  </svg>
);

// Add CheckIcon component
const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.285 2l-11.285 11.567-5.286-5.011-3.714 3.716 9 8.728 15-15.285z"/>
  </svg>
);

// Add CrossIcon component
const CrossIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
  </svg>
);

// Move TestResults to a separate component
const TestResults = ({ results, isSubmission, score, totalPoints }: { 
  results: TestResult[], 
  isSubmission: boolean,
  score?: number,
  totalPoints?: number 
}) => {
  if (!results || results.length === 0) {
    return <div className={styles.initialState}>Run your code to see test results</div>;
  }

  return (
    <div className={styles.testResults}>
      <div className={styles.testResultsHeader}>
        <h3>Test Results</h3>
        {isSubmission && score !== undefined && totalPoints !== undefined && (
          <div className={styles.totalScore}>
            Total Score: {score}/{totalPoints}
          </div>
        )}
      </div>
      <div className={styles.testCasesGrid}>
        {results.map((result, index) => {
          const status = result.error ? 'error' : result.passed ? 'passed' : 'failed';
          
          return (
            <div 
              key={index} 
              className={`${styles.testCaseBox} ${styles[status]}`}
            >
              <div className={styles.testCaseHeader}>
                <span>Test case: {index + 1}</span>
                {result.passed ? (
                  <span className={styles.checkmark}>
                    <CheckIcon />
                  </span>
                ) : (
                  <span className={styles.crossmark}>
                    <CrossIcon />
                  </span>
                )}
              </div>
              
              {/* Show details only for non-submissions and when test case fails */}
              {!isSubmission && !result.passed && (
                <div className={styles.testCaseDetails}>
                  {result.error ? (
                    <div className={styles.errorMessage}>{result.error}</div>
                  ) : (
                    <>
                      <div className={styles.testDetail}>
                        <strong>Input:</strong> {result.output}
                      </div>
                      <div className={styles.testDetail}>
                        <strong>Expected:</strong> {result.expected}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const MDPreview = dynamic(
  () => import('@uiw/react-markdown-preview').then((mod) => mod.default),
  { ssr: false }
);

const ProblemClient = ({ id }: ProblemClientProps) => {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [question, setQuestion] = useState<Question | null>(null);
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState<string>('python');
  const [theme, setTheme] = useState('vs-dark');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isSubmission, setIsSubmission] = useState(false);
  const [executionResults, setExecutionResults] = useState<TestResult[] | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [questionPanelWidth, setQuestionPanelWidth] = useState(50);
  const splitLayoutRef = useRef<HTMLDivElement>(null);

  // Available themes in Monaco Editor
  const themes = [
    { value: 'vs-dark', label: 'Dark' },
    { value: 'vs-light', label: 'Light' },
    { value: 'hc-black', label: 'High Contrast Dark' },
    { value: 'hc-light', label: 'High Contrast Light' }
  ];

  // Add a mapping for language display names
  const languageDisplayNames: { [key: string]: string } = {
    python: 'Python',
    javascript: 'JavaScript',
    java: 'Java',
    cpp: 'C++',
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !splitLayoutRef.current) return;

    const container = splitLayoutRef.current;
    const containerRect = container.getBoundingClientRect();
    const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
    
    // Limit the width between 30% and 70% for better editor space
    const clampedWidth = Math.min(Math.max(newWidth, 30), 70);
    setQuestionPanelWidth(clampedWidth);
  }, [isResizing]);

  // Force editor layout update after resize
  useEffect(() => {
    if (!isResizing) {
      window.dispatchEvent(new Event('resize'));
    }
  }, [isResizing]);

  useEffect(() => {
    const checkAuthAndFetchData = async () => {
      try {
        if (status === 'unauthenticated') {
          router.push('/login');
          return;
        }

        if (!session?.user?.id) {
          console.warn('Required user data is not available in session');
          return;
        }

        // Fetch question data using apiRequest
        const data = await apiRequest(`/api/questions/${id}`, { method: 'GET' });
        setQuestion(data);
        
        // Set initial code based on language
        if (data.starterCodes && data.starterCodes.length > 0) {
          const defaultCode = data.starterCodes.find((sc: StarterCode) => sc.language === language)?.code || '';
          setCode(defaultCode);
        }
      } catch (error) {
        console.error('Error fetching question:', error);
        setError('Failed to load question. Please try again later.');
      }
    };

    if (status === 'authenticated') {
      checkAuthAndFetchData();
    }
  }, [id, language, router, session, status]);

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLanguage = e.target.value;
    setLanguage(newLanguage);
    
    // Find and set the starter code for the selected language
    if (question) {
      const starterCode = question.starterCodes.find(sc => sc.language === newLanguage);
      if (starterCode) {
        setCode(starterCode.code);
      }
    }
  };

  const handleThemeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTheme(e.target.value);
  };

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setCode(value);
    }
  };

  const handleRunCode = async () => {
    if (!question || !session?.user?.id) return;

    setIsExecuting(true);
    setIsSubmission(false);
    setExecutionError(null);

    try {
      const response = await apiRequest('/api/execute-code', {
        method: 'POST',
        body: JSON.stringify({
          code,
          language,
          question_id: id,
          is_submission: false,
          docker_runner: question.docker_runner
        })
      });

      setExecutionResults(response.results);
    } catch (error) {
      console.error('Error executing code:', error);
      setExecutionError('Failed to execute code. Please try again.');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleSubmit = async () => {
    if (!question || !session?.user?.id) return;

    setIsExecuting(true);
    setIsSubmission(true);
    setExecutionError(null);

    try {
      const response = await apiRequest('/api/execute-code', {
        method: 'POST',
        body: JSON.stringify({
          code,
          language,
          question_id: id,
          is_submission: true,
          docker_runner: question.docker_runner
        })
      });

      setExecutionResults(response.results);
      
      if (response.status === 'success') {
        // Show success message or update progress
        console.log('Submission successful:', response);
      }
    } catch (error) {
      console.error('Error submitting code:', error);
      setExecutionError('Failed to submit code. Please try again.');
    } finally {
      setIsExecuting(false);
    }
  };

  const toggleFullScreen = useCallback(() => {
    setIsFullScreen(prev => !prev);
    // Trigger Monaco Editor layout update
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 100);
  }, []);

  // Handle ESC key to exit full-screen
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isFullScreen) {
        setIsFullScreen(false);
        setTimeout(() => {
          window.dispatchEvent(new Event('resize'));
        }, 100);
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isFullScreen]);

  // Helper function to ensure image URLs are properly prefixed
  const getImageUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http') || url.startsWith('data:')) return url;
    
    // Use environment variable for backend URL
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
    const apiPath = '/api/v1'; // Add your API path prefix if needed
    
    // Clean and construct the image URL
    const cleanUrl = url.startsWith('/') ? url : `/${url}`;
    return `${backendUrl}${apiPath}/images${cleanUrl}`;
  };

  // Show loading state while checking authentication
  if (status === 'loading') {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  if (!session || !question) {
    return null;
  }

  return (
    <div className={styles.container} ref={splitLayoutRef}>
      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}
      
      <div className={styles.splitLayout}>
        <div 
          className={styles.questionPanel} 
          style={{ width: `${questionPanelWidth}%` }}
        >
          <div className={styles.questionContent}>
            <h1 className={styles.title}>{question.title}</h1>
            
            <div className={styles.metadata}>
              <span className={`${styles.tag} ${styles[question.difficulty.toLowerCase()]}`}>
                {question.difficulty}
              </span>
              {question.category.map((cat, index) => (
                <span key={index} className={`${styles.tag} ${styles.category}`}>
                  {cat}
                </span>
              ))}
              <span className={styles.points}>{question.points} points</span>
            </div>

            <div className={styles.description}>
              <h2>Problem Description</h2>
              <div data-color-mode="light">
                <MDPreview source={question.description} />
              </div>
              
              {question.images && question.images.length > 0 && (
                <div className={styles.imagesSection}>
                  {question.images.map((image, index) => (
                    <figure key={index} className={styles.imageContainer}>
                      <img 
                        src={getImageUrl(image.url)} 
                        alt={image.caption || `Image ${index + 1}`}
                        className={styles.questionImage}
                      />
                      {image.caption && (
                        <figcaption className={styles.imageCaption}>
                          {image.caption}
                        </figcaption>
                      )}
                    </figure>
                  ))}
                </div>
              )}
            </div>

            <div className={styles.examples}>
              <h2>Examples</h2>
              {question.examples.map((example, index) => (
                <div key={index} className={styles.example}>
                  <h3>Example {index + 1}</h3>
                  <div className={styles.exampleContent}>
                    <div className={styles.exampleBox}>
                      <strong>Input:</strong>
                      {example.input.trim() && (
                        <pre>{example.input}</pre>
                      )}
                      {example.inputImage && (
                        <div className={styles.exampleImageBox}>
                          <img 
                            src={getImageUrl(example.inputImage.url)} 
                            alt={example.inputImage.caption || `Example ${index + 1} input illustration`}
                            className={styles.exampleImage}
                          />
                          {example.inputImage.caption && (
                            <figcaption className={styles.exampleImageCaption}>
                              {example.inputImage.caption}
                            </figcaption>
                          )}
                        </div>
                      )}
                    </div>
                    <div className={styles.exampleBox}>
                      <strong>Output:</strong>
                      {example.output.trim() && (
                        <pre>{example.output}</pre>
                      )}
                      {example.outputImage && (
                        <div className={styles.exampleImageBox}>
                          <img 
                            src={getImageUrl(example.outputImage.url)} 
                            alt={example.outputImage.caption || `Example ${index + 1} output illustration`}
                            className={styles.exampleImage}
                          />
                          {example.outputImage.caption && (
                            <figcaption className={styles.exampleImageCaption}>
                              {example.outputImage.caption}
                            </figcaption>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            </div>
          </div>
          <div 
            className={`${styles.splitHandle} ${isResizing ? styles.dragging : ''}`}
            onMouseDown={handleMouseDown}
          />
        <div className={`${styles.editorPanel} ${isFullScreen ? styles.fullScreen : ''}`}>
          <div className={styles.editorControls}>
            <div className={styles.controlsLeft}>
              <div className={styles.controlGroup}>
                <label htmlFor="language">Language:</label>
                <select 
                  id="language"
                  value={language}
                  onChange={handleLanguageChange}
                  className={styles.select}
                >
                  {question?.allowedLanguages?.map(lang => (
                    <option key={lang} value={lang}>
                      {languageDisplayNames[lang] || lang.charAt(0).toUpperCase() + lang.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className={styles.controlGroup}>
                <label htmlFor="theme">Theme:</label>
                <select 
                  id="theme"
                  value={theme}
                  onChange={handleThemeChange}
                  className={styles.select}
                >
                  {themes.map(themeOption => (
                    <option key={themeOption.value} value={themeOption.value}>
                      {themeOption.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.controlsRight}>
              <button
                className={styles.fullScreenButton}
                onClick={toggleFullScreen}
                title={isFullScreen ? "Exit Full Screen" : "Full Screen"}
              >
                {isFullScreen ? <CompressIcon /> : <ExpandIcon />}
                {isFullScreen ? "Exit Full Screen" : "Full Screen"}
              </button>
            </div>
          </div>

          <div className={styles.editorContainer}>
            <Editor
              height="100%"
              defaultLanguage={language}
              language={language}
              value={code}
              onChange={handleEditorChange}
              theme={theme}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                lineNumbers: 'on',
                automaticLayout: true,
                scrollBeyondLastLine: false,
                tabSize: 4,
                wordWrap: 'on'
              }}
            />
          </div>

          <div className={styles.editorActions}>
            <button 
              className={`${styles.button} ${styles.runButton}`}
              onClick={handleRunCode}
              disabled={isExecuting}
            >
              {isExecuting ? 'Running...' : 'Run Code'}
            </button>
            <button 
              className={`${styles.button} ${styles.submitButton}`}
              onClick={handleSubmit}
              disabled={isExecuting}
            >
              Submit Solution
            </button>
          </div>

          <div className={styles.testResultsSection}>
            {isExecuting ? (
              <div className={styles.executing}>Running your code...</div>
            ) : executionError ? (
              <div className={styles.error}>{executionError}</div>
            ) : (
              <TestResults 
                results={executionResults || []} 
                isSubmission={isSubmission}
                score={executionResults ? Math.round(executionResults.filter(r => r.passed).length * (question?.points || 0) / executionResults.length) : 0}
                totalPoints={question?.points}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProblemClient; 