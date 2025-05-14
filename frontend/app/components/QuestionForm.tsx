'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useSession } from 'next-auth/react';
import styles from '../admin/questions/questions.module.css';
import { apiRequest } from '@/app/utils/api';
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";

// Interfaces
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

interface Question {
  id: string;
  title: string;
  summary: string;
  description: string;
  category: string[];
  difficulty: string;
  points: number;
  examples: Example[];
  starterCodes: StarterCode[];
  allowedLanguages: string[];
  testCases: TestCase[];
  docker_runner: string;
  working_driver: string;
  Q_type: string;
}

interface QuestionFormProps {
  isEditing?: boolean;
  question?: Question;
  onCancel?: () => void;
}

const initialFormState: Omit<Question, 'id'> = {
  title: '',
  summary: '',
  description: '',
  category: [],
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
  Q_type: 'pandas'
};

// Dynamic imports
const MDEditor = dynamic(
  () => import("@uiw/react-md-editor").then((mod) => {
    const { default: MDEditor } = mod;
    return function CustomMDEditor({ value, onChange, ...props }: any) {
      return (
        <div data-color-mode="light" style={{ width: '100%' }}>
          <MDEditor
            value={value}
            onChange={onChange}
            preview="edit"
            hideToolbar={false}
            enableScroll={true}
            textareaProps={{
              placeholder: 'Enter your markdown content here...',
              style: { 
                width: '100%',
                minHeight: '200px',
                padding: '10px',
                fontSize: '14px',
                lineHeight: '1.5'
              }
            }}
            {...props}
          />
        </div>
      );
    };
  }),
  { ssr: false }
);

const MonacoEditorWrapper = dynamic(
  () => import('@monaco-editor/react').then((mod) => {
    const { default: Editor } = mod;
    return function Wrapper(props: any) {
      return <Editor {...props} />;
    };
  }),
  { ssr: false }
);

const availableLanguages = [
  { value: 'python', label: 'Python' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' }
];

const moduleTypes = [
  { value: 'pandas', label: 'Pandas' },
  { value: 'sklearn', label: 'Scikit-learn' },
  { value: 'ai', label: 'AI/ML' }
];

const QuestionForm: React.FC<QuestionFormProps> = ({ isEditing = false, question, onCancel }) => {
  const { data: session, status } = useSession();
  const [formData, setFormData] = useState<Omit<Question, 'id'>>(initialFormState);
  const [starterCodes, setStarterCodes] = useState<StarterCode[]>([]);
  const [allowedLanguages, setAllowedLanguages] = useState<string[]>(['python']);
  const [testCases, setTestCases] = useState<TestCase[]>([{ input: '', expected_output: '', is_hidden: false, order: 1, points: 0 }]);
  const [newCategory, setNewCategory] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (question) {
      setFormData({
        title: question.title,
        summary: question.summary,
        description: question.description,
        category: question.category || [],
        difficulty: question.difficulty,
        points: question.points,
        examples: question.examples && question.examples.length > 0 ? question.examples : initialFormState.examples,
        starterCodes: question.starterCodes || [],
        allowedLanguages: question.allowedLanguages || ['python'],
        testCases: question.testCases && question.testCases.length > 0 ? question.testCases : initialFormState.testCases,
        docker_runner: question.docker_runner,
        working_driver: question.working_driver,
        Q_type: question.Q_type || 'pandas',
      });
      setStarterCodes(question.starterCodes || []);
      setAllowedLanguages(question.allowedLanguages || ['python']);
      setTestCases(question.testCases && question.testCases.length > 0 ? question.testCases : initialFormState.testCases);
    } else {
      setFormData(initialFormState);
      setStarterCodes([]);
      setAllowedLanguages(['python']);
      setTestCases([{ input: '', expected_output: '', is_hidden: false, order: 1, points: 0 }]);
    }
  }, [question]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleEditorChange = (index: number, field: 'input' | 'output', value: string | undefined) => {
    setFormData(prev => ({
      ...prev,
      examples: prev.examples.map((example, i) => 
        i === index ? { ...example, [field]: value || '' } : example
      )
    }));
  };

  const handleEditorLanguageChange = (index: number, field: 'inputLanguage' | 'outputLanguage', value: string) => {
    setFormData(prev => ({
      ...prev,
      examples: prev.examples.map((example, i) => 
        i === index ? { ...example, [field]: value } : example
      )
    }));
  };

  const addExample = () => {
    setFormData(prev => ({
      ...prev,
      examples: [...prev.examples, { 
        input: '', 
        output: '', 
        inputLanguage: 'plaintext', 
        outputLanguage: 'plaintext',
        inputImage: null,
        outputImage: null
      }]
    }));
  };

  const removeExample = (index: number) => {
    setFormData(prev => ({
      ...prev,
      examples: prev.examples.filter((_, i) => i !== index)
    }));
  };

  const handleAddCategory = () => {
    if (newCategory && !formData.category.includes(newCategory)) {
      setFormData(prev => ({
        ...prev,
        category: [...prev.category, newCategory]
      }));
      setNewCategory('');
    }
  };

  const handleRemoveCategory = (categoryToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      category: prev.category.filter(cat => cat !== categoryToRemove)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const questionData = {
        ...formData,
        examples: formData.examples.map(example => ({
          ...example,
          inputLanguage: example.inputLanguage || 'plaintext',
          outputLanguage: example.outputLanguage || 'plaintext'
        })),
        starterCodes: starterCodes,
        allowedLanguages: allowedLanguages,
        testCases: testCases.map((tc, index) => ({
          ...tc,
          order: index + 1,
          points: Number(tc.points)
        }))
      };
      let response;
      if (isEditing && question) {
        response = await apiRequest(`/api/questions/${question.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'email': JSON.parse(localStorage.getItem('user') || '{}').email
          },
          body: JSON.stringify(questionData)
        });
      } else {
        response = await apiRequest('/api/questions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'email': JSON.parse(localStorage.getItem('user') || '{}').email
          },
          body: JSON.stringify(questionData)
        });
      }
      if (response) {
        setFormData({ ...initialFormState });
        setStarterCodes([]);
        setAllowedLanguages(['python']);
        setTestCases([{ input: '', expected_output: '', is_hidden: false, order: 1, points: 0 }]);
        if (onCancel) onCancel();
      }
    } catch (error) {
      setError('An error occurred while submitting the question');
    } finally {
      setIsLoading(false);
    }
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
        <div className={styles.error}>{error}</div>
      )}
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formGroup}>
          <label htmlFor="title">Title</label>
          <input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            required
          />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="summary">Summary</label>
          <input
            type="text"
            id="summary"
            name="summary"
            value={formData.summary}
            onChange={handleInputChange}
            required
          />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="description">Description (Markdown)</label>
          <MDEditor
            value={formData.description}
            onChange={(value?: string) => {
              setFormData(prev => ({
                ...prev,
                description: value || ''
              }));
            }}
            preview="edit"
          />
        </div>
        <div className={styles.formGroup}>
          <label>Categories</label>
          <div className={styles.categoryInput}>
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Add a category"
            />
            <button type="button" onClick={handleAddCategory} className={styles.addCategoryButton}>Add</button>
          </div>
          <div className={styles.categoryTags}>
            {formData.category.map((cat, index) => (
              <span key={index} className={styles.categoryTag}>
                {cat}
                <button type="button" onClick={() => handleRemoveCategory(cat)} className={styles.removeCategoryButton}>×</button>
              </span>
            ))}
          </div>
        </div>
        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label htmlFor="difficulty">Difficulty</label>
            <select
              id="difficulty"
              name="difficulty"
              value={formData.difficulty}
              onChange={handleInputChange}
              required
            >
              <option value="">Select Difficulty</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="points">Points</label>
            <input
              type="number"
              id="points"
              name="points"
              value={formData.points}
              onChange={handleInputChange}
              required
            />
          </div>
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="docker_runner">Docker Runner</label>
          <select
            id="docker_runner"
            name="docker_runner"
            value={formData.docker_runner}
            onChange={handleInputChange}
            required
          >
            <option value="only_python">Python Only</option>
            <option value="pandas">Pandas</option>
            <option value="visualizations">Visualizations</option>
            <option value="gpu">GPU (Machine Learning)</option>
          </select>
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="Q_type">Module Type</label>
          <select
            id="Q_type"
            name="Q_type"
            value={formData.Q_type}
            onChange={handleInputChange}
            required
            className={styles.select}
          >
            {moduleTypes.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>
        {/* Examples Section, Starter Code, Working Code, Test Cases, and Actions go here (copy from your original) */}
      </form>
    </div>
  );
};

export default QuestionForm; 