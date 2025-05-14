'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import styles from './questions.module.css';
import dynamic from 'next/dynamic';
import { apiRequest } from '@/app/utils/api';
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";

interface Example {
  input: string;
  output: string;
  inputLanguage: string;
  outputLanguage: string;
  inputImage: { url: string; caption: string; } | null;
  outputImage: { url: string; caption: string; } | null;
}

interface StarterCode {
  language: string;
  code: string;
}

interface TestCase {
  input: string;
  expected_output: string;
  is_hidden: boolean;
  order: number;
  points: number;
}

interface Module {
  id: string;
  name: string;
  description: string;
  icon?: string;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Question {
  id: string;
  title: string;
  summary: string;
  description: string;
  moduleId: string;
  difficulty: string;
  points: number;
  examples: Example[];
  starterCodes: StarterCode[];
  allowedLanguages: string[];
  testCases: TestCase[];
  docker_runner: string;
  working_driver: string;
  createdAt: string;
  updatedAt: string;
  Q_type?: string;
}

type QuestionFormData = Omit<Question, 'id'>;

type QuestionFormDataWithoutTimestamps = Omit<QuestionFormData, 'createdAt' | 'updatedAt'>;

interface Filters {
  categories: string[];
  difficulties: string[];
}

interface ApiError {
  detail?: string;
  message?: string;
  errors?: Record<string, string[]>;
  status?: number;
}

interface FormData {
  title: string;
  summary: string;
  description: string;
  moduleId: string;  // Changed from category to moduleId
  difficulty: string;
  points: number;
  examples: Example[];
  starterCodes: StarterCode[];
  allowedLanguages: string[];
  testCases: TestCase[];
  docker_runner: string;
  working_driver: string;
}

const createInitialFormData = (): QuestionFormData => {
  const now = new Date().toISOString();
  return {
  title: '',
  summary: '',
  description: '',
    moduleId: '',
  difficulty: '',
  points: 0,
  examples: [{ 
    input: '', 
    output: '', 
    inputLanguage: 'plaintext', 
    outputLanguage: 'plaintext', 
    inputImage: null,
    outputImage: null
  }],
  starterCodes: [],
  allowedLanguages: ['python'],
  testCases: [{ input: '', expected_output: '', is_hidden: false, order: 1, points: 0 }],
  docker_runner: 'only_python',
  working_driver: '',
    createdAt: now,
    updatedAt: now
  };
};

// Update type definitions for MDEditor
interface MDEditorProps {
  value: string;
  onChange: (value?: string) => void;
  preview?: 'live' | 'edit' | 'preview';
  textareaProps?: any;
}

const MDEditor = dynamic(
  () => import("@uiw/react-md-editor").then((mod) => {
    const { default: MDEditor } = mod;
    return function CustomMDEditor({ value, onChange, textareaProps, ...props }: MDEditorProps) {
      return (
        <div data-color-mode="light" style={{ width: '100%' }}>
          <MDEditor
            value={value}
            onChange={onChange}
            preview="edit"
            hideToolbar={false}
            enableScroll={true}
            textareaProps={textareaProps}
            style={{ color: 'black', backgroundColor: 'white' }}
            {...props}
          />
        </div>
      );
    };
  }),
  { ssr: false }
);



// Dynamically import Monaco Editor with a wrapper component
const MonacoEditorWrapper = dynamic(
  () => import('@monaco-editor/react').then((mod) => {
    const { default: Editor } = mod;
    return function Wrapper(props: any) {
      return <Editor {...props} />;
    };
  }),
  { ssr: false }
);

const QuestionManagement = () => {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedModule, setSelectedModule] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Build module list from Q_type
  const allModules = Array.isArray(questions)
    ? Array.from(new Set(questions.map(q => q.Q_type).filter(Boolean)))
    : [];

  // Set default selected module
  useEffect(() => {
    if (!selectedModule && allModules.length > 0) {
      setSelectedModule(allModules[0] || '');
    }
  }, [allModules]);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session || !session.user.is_admin) {
      router.push('/login?callbackUrl=/admin/questions');
      return;
    }
    fetchQuestions();
  }, [session, status, router]);

  const fetchQuestions = async () => {
    try {
      const response = await apiRequest('/api/admin/questions', { method: 'GET' });
      setQuestions(Array.isArray(response) ? response : []);
      setIsLoading(false);
    } catch (err) {
      setError('Failed to fetch questions');
      setIsLoading(false);
    }
  };

  // Filter questions for selected module (Q_type)
  const filteredQuestions = Array.isArray(questions)
    ? questions.filter(q => (q.Q_type || '').trim().toLowerCase() === (selectedModule || '').trim().toLowerCase())
    : [];

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;
    
    try {
      await apiRequest(`/api/questions/${id}`, {
        method: 'DELETE'
      });
      fetchQuestions();
    } catch (error) {
      console.error('Error deleting question:', error);
      if (error instanceof Error) {
        alert(error.message);
      }
    }
  };

  const handleAddQuestion = () => {
    router.push('/admin/questions/new');
  };

  const handleEditQuestion = (id: string) => {
    router.push(`/admin/questions/${id}/edit`);
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!session || !session.user.is_admin) {
    return null;
  }

  return (
    <div className={styles.container}>
      {error && (
        <div className={styles.error}>
          {error}
        </div>
      )}
      
      <div className={styles.moduleLayout}>
        {/* Sidebar for modules (Q_type) */}
        <div className={styles.moduleSidebar}>
          <h3>Modules</h3>
          <ul className={styles.moduleList}>
            {allModules.map(module => (
              <li
                key={module}
                className={selectedModule === module ? styles.selectedModule : ''}
                onClick={() => setSelectedModule(module || '')}
              >
                {module}
              </li>
            ))}
          </ul>
        </div>
        <div className={styles.moduleMain}>
          <div className={styles.header}>
            <h1>Questions in "{selectedModule || 'Module'}"</h1>
                <button 
              className={styles.addButton} 
              onClick={handleAddQuestion}
            >
              Add New Question
                </button>
          </div>
      <div className={styles.questionsList}>
        <div className={styles.questionsHeader}>
              <div>Title</div>
              <div>Difficulty</div>
              <div>Points</div>
              <div>Description</div>
              <div>Actions</div>
        </div>
            {filteredQuestions.map(question => (
            <div key={question.id} className={styles.questionRow}>
              <div className={styles.questionTitle}>{question.title}</div>
              <div className={styles.questionDifficulty}>
                <span className={`${styles.difficultyBadge} ${styles[question.difficulty.toLowerCase()]}`}>
                  {question.difficulty}
                </span>
              </div>
              <div className={styles.questionPoints}>
                  <span className={styles.pointsBadge}>{question.points}</span>
              </div>
                <div className={styles.questionDescription}>{question.summary}</div>
              <div className={styles.questionActions}>
                <button
                    onClick={() => handleEditQuestion(question.id)}
                  className={styles.editButton}
                >
                    Edit
                </button>
                <button
                  onClick={() => handleDelete(question.id)}
                  className={styles.deleteButton}
                >
                  Delete
                </button>
              </div>
            </div>
            ))}
            {filteredQuestions.length === 0 && (
              <div className={styles.noQuestions}>No questions in this module.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuestionManagement; 