'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import styles from './questions.module.css';
import dynamic from 'next/dynamic';
import { apiRequest } from '@/app/utils/api';

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

const initialFormState = {
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
  Q_type: 'pandas'  // Default to pandas module
};

// Update type definitions for MDEditor
interface MDEditorProps {
  value: string;
  onChange: (value?: string) => void;
  preview?: 'live' | 'edit' | 'preview';
}

const MDEditor = dynamic(
  () => import("@uiw/react-md-editor").then((mod) => {
    const { default: MDEditor } = mod;
    return function CustomMDEditor({ value, onChange, ...props }: MDEditorProps) {
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
  const [showForm, setShowForm] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [filters, setFilters] = useState<Filters>({
    categories: [],
    difficulties: []
  });
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('');
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [formData, setFormData] = useState<Omit<Question, 'id'>>(initialFormState);
  const [newCategory, setNewCategory] = useState('');
  const [isMaximized, setIsMaximized] = useState(false);
  const [starterCodes, setStarterCodes] = useState<StarterCode[]>([]);
  const [allowedLanguages, setAllowedLanguages] = useState<string[]>(['python']);
  const [testCases, setTestCases] = useState<TestCase[]>([
    { input: '', expected_output: '', is_hidden: false, order: 1, points: 0 }
  ]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

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

  useEffect(() => {
    if (status === 'loading') return;

    if (!session || !session.user.is_admin) {
      router.push('/login?callbackUrl=/admin/questions');
      return;
    }
  }, [session, status, router]);

  useEffect(() => {
    const init = async () => {
      if (!session?.user.is_admin) return;

      try {
        setError('');
        setIsLoading(true);
        await Promise.all([
          fetchQuestions(),
          fetchFilters()
        ]);
      } catch (err) {
        console.error('Initialization error:', err);
        setError('Failed to load questions. Please try again.');
        if (err instanceof Error && err.message.includes('401')) {
          router.push('/login?callbackUrl=/admin/questions');
        }
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, [session]);

  const fetchQuestions = async () => {
    try {
      setIsLoading(true);
      setError('');
      
      const data = await apiRequest('/api/questions', { 
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!data || !Array.isArray(data)) {
        console.error('Invalid response format:', data);
        setError('Invalid response format from server');
        setQuestions([]);
        return;
      }
      
      console.log('Fetched questions:', data);
      setQuestions(data);
      
    } catch (err) {
      console.error('Error fetching questions:', err);
      if (err instanceof Error) {
        if (err.message.includes('401')) {
          setError('Authentication failed. Please log in again.');
          router.push('/login?callbackUrl=/admin/questions');
        } else if (err.message.includes('403')) {
          setError('Access denied. You do not have admin privileges.');
          router.push('/');
        } else {
          setError(`Failed to fetch questions: ${err.message}`);
        }
      } else {
        setError('An unexpected error occurred while fetching questions');
      }
      setQuestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFilters = async () => {
    try {
      const data = await apiRequest('/api/questions/filters', { 
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!data || !data.categories || !data.difficulties) {
        console.error('Invalid filters data:', data);
        setError('Invalid filters format from server');
        setFilters({ categories: [], difficulties: [] });
        return;
      }
      
      console.log('Fetched filters:', data);
      setFilters(data);
      
    } catch (error) {
      console.error('Error fetching filters:', error);
      if (error instanceof Error) {
        setError(`Failed to fetch filters: ${error.message}`);
      } else {
        setError('An unexpected error occurred while fetching filters');
      }
      setFilters({ categories: [], difficulties: [] });
    }
  };

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

  const addStarterCodeSection = () => (
    <div className={styles.formSection}>
      <h3>Starter Code</h3>
      <div className={styles.languageSelection}>
        <label>Allowed Languages:</label>
        <div className={styles.checkboxGroup}>
          {availableLanguages.map(lang => (
            <label key={lang.value} className={styles.checkbox}>
              <input
                type="checkbox"
                checked={allowedLanguages.includes(lang.value)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setAllowedLanguages([...allowedLanguages, lang.value]);
                    if (!starterCodes.find(sc => sc.language === lang.value)) {
                      setStarterCodes([...starterCodes, { language: lang.value, code: '' }]);
                    }
                  } else {
                    setAllowedLanguages(allowedLanguages.filter(l => l !== lang.value));
                    setStarterCodes(starterCodes.filter(sc => sc.language !== lang.value));
                  }
                }}
              />
              {lang.label}
            </label>
          ))}
        </div>
      </div>
      
      {allowedLanguages.map(lang => (
        <div key={lang} className={styles.starterCodeEditor}>
          <h4>{availableLanguages.find(l => l.value === lang)?.label} Starter Code:</h4>
          <MonacoEditorWrapper
            height="200px"
            language={lang}
            value={starterCodes.find(sc => sc.language === lang)?.code || ''}
            onChange={(value: string | undefined) => {
              const newStarterCodes = [...starterCodes];
              const index = newStarterCodes.findIndex(sc => sc.language === lang);
              if (index >= 0) {
                newStarterCodes[index].code = value || '';
              } else {
                newStarterCodes.push({ language: lang, code: value || '' });
              }
              setStarterCodes(newStarterCodes);
            }}
            options={{
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              fontSize: 14,
              lineNumbers: 'on',
              roundedSelection: false,
              scrollbar: {
                vertical: 'visible',
                horizontal: 'visible',
              },
            }}
          />
        </div>
      ))}
    </div>
  );

  const addTestCaseSection = () => {
    const totalPoints = formData.points;
    const currentTotalTestPoints = testCases.reduce((sum, tc) => sum + tc.points, 0);

    return (
    <div className={styles.formSection}>
      <h3>Test Cases</h3>
      <div className={styles.testCasesHeader}>
        <span>Total Points: {totalPoints}</span>
        <span>Assigned Points: {currentTotalTestPoints}</span>
        <span className={currentTotalTestPoints !== totalPoints ? styles.pointsMismatch : styles.pointsMatch}>
          {currentTotalTestPoints === totalPoints 
            ? "✓ Points properly distributed" 
            : `⚠️ Points mismatch: ${currentTotalTestPoints > totalPoints ? "Over-allocated" : "Under-allocated"}`}
        </span>
      </div>
      {testCases.map((testCase, index) => (
        <div key={index} className={styles.testCase}>
          <div className={styles.testCaseHeader}>
            <h4>Test Case {index + 1}</h4>
            <div className={styles.testCaseControls}>
              <div className={styles.pointsInput}>
                <label>Points:</label>
                <input
                  type="number"
                  min="0"
                  max={totalPoints}
                  value={testCase.points}
                  onChange={(e) => {
                    const newPoints = Math.max(0, parseInt(e.target.value) || 0);
                    const newTestCases = [...testCases];
                    newTestCases[index].points = newPoints;
                    setTestCases(newTestCases);
                  }}
                  className={styles.pointsField}
                />
              </div>
              <label className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={testCase.is_hidden}
                  onChange={(e) => {
                    const newTestCases = [...testCases];
                    newTestCases[index].is_hidden = e.target.checked;
                    setTestCases(newTestCases);
                  }}
                />
                Hidden Test Case
              </label>
              {testCases.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const newTestCases = testCases.filter((_, i) => i !== index);
                    setTestCases(newTestCases);
                  }}
                  className={styles.removeButton}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
          
          <div className={styles.testCaseContent}>
            <div className={styles.formGroup}>
              <label>Input</label>
              <MonacoEditorWrapper
                height="150px"
                language="plaintext"
                value={testCase.input}
                onChange={(value: string | undefined) => {
                  const newTestCases = [...testCases];
                  newTestCases[index].input = value || '';
                  setTestCases(newTestCases);
                }}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: 'on',
                  wordWrap: 'on'
                }}
              />
            </div>
            
            <div className={styles.formGroup}>
              <label>Expected Output</label>
              <MonacoEditorWrapper
                height="150px"
                language="plaintext"
                value={testCase.expected_output}
                onChange={(value: string | undefined) => {
                  const newTestCases = [...testCases];
                  newTestCases[index].expected_output = value || '';
                  setTestCases(newTestCases);
                }}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: 'on',
                  wordWrap: 'on'
                }}
              />
            </div>
          </div>
        </div>
      ))}
      
      <button
        type="button"
        onClick={() => {
          setTestCases([
            ...testCases,
            {
              input: '',
              expected_output: '',
              is_hidden: false,
              order: testCases.length + 1,
              points: 0
            }
          ]);
        }}
        className={styles.addTestCaseButton}
      >
        Add Test Case
      </button>
    </div>
  );
  };

  const handleEditQuestion = (question: Question) => {
    setEditingQuestion(question);
    setFormData({
      title: question.title,
      summary: question.summary,
      description: question.description,
      category: question.category,
      difficulty: question.difficulty,
      points: question.points,
      examples: question.examples.map(example => ({
        ...example,
        inputLanguage: example.inputLanguage || 'plaintext',
        outputLanguage: example.outputLanguage || 'plaintext',
        inputImage: example.inputImage || null,
        outputImage: example.outputImage || null
      })),
      starterCodes: question.starterCodes,
      allowedLanguages: question.allowedLanguages,
      testCases: question.testCases,
      docker_runner: question.docker_runner,
      working_driver: question.working_driver,
      Q_type: question.Q_type
    });
    setStarterCodes(question.starterCodes);
    setAllowedLanguages(question.allowedLanguages);
    setTestCases(question.testCases);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
      setError('');
    
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
      if (editingQuestion) {
        // Update existing question
        response = await apiRequest(`/api/questions/${editingQuestion.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'email': JSON.parse(localStorage.getItem('user') || '{}').email
          },
        body: JSON.stringify(questionData)
      });
      } else {
        // Create new question
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
        // Reset form and refresh questions list
        setFormData({ ...initialFormState });
        setStarterCodes([]);
        setAllowedLanguages(['python']);
        setTestCases([{ input: '', expected_output: '', is_hidden: false, order: 1, points: 0 }]);
        setEditingQuestion(null);
        setShowForm(false);
        await fetchQuestions();
      }
    } catch (error) {
      console.error('Error submitting question:', error);
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('An error occurred while submitting the question');
      }
    }
  };

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

  const handleMaximize = () => {
    setIsMaximized(!isMaximized);
    // Allow time for the transition to complete before adjusting editor sizes
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 300);
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
      
      <div className={styles.header}>
        <button 
          className={styles.addButton}
          onClick={() => {
            setFormData(initialFormState);
            setStarterCodes([]);
            setAllowedLanguages(['python']);
            setTestCases([{ input: '', expected_output: '', is_hidden: false, order: 1, points: 0 }]);
            setEditingQuestion(null);
            setShowForm(true);
          }}
        >
          Add Question
        </button>
        <div className={styles.filters}>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="">All Categories</option>
            {filters.categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          <select
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="">All Difficulties</option>
            {filters.difficulties.map(difficulty => (
              <option key={difficulty} value={difficulty}>{difficulty}</option>
            ))}
          </select>
        </div>
      </div>

      {showForm && (
        <div className={styles.formOverlay}>
          <div className={`${styles.formContainer} ${isMaximized ? styles.maximized : ''}`}>
            <div className={styles.formHeader}>
              <h2>{editingQuestion ? 'Edit Question' : 'Add New Question'}</h2>
              <div className={styles.formControls}>
                <button 
                  className={styles.maximizeButton}
                  onClick={handleMaximize}
                  title={isMaximized ? "Minimize" : "Maximize"}
                >
                  {isMaximized ? '⊟' : '⊞'}
                </button>
                <button 
                  className={styles.closeButton}
                  onClick={() => {
                    setShowForm(false);
                    setEditingQuestion(null);
                    setIsMaximized(false);
                  }}
                  title="Close"
                >
                  ×
                </button>
              </div>
            </div>
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
                  <button 
                    type="button" 
                    onClick={handleAddCategory}
                    className={styles.addCategoryButton}
                  >
                    Add
                  </button>
                </div>
                <div className={styles.categoryTags}>
                  {formData.category.map((cat, index) => (
                    <span key={index} className={styles.categoryTag}>
                      {cat}
                      <button 
                        type="button"
                        onClick={() => handleRemoveCategory(cat)}
                        className={styles.removeCategoryButton}
                      >
                        ×
                      </button>
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
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.examples}>
                <label>Examples</label>
                {formData.examples.map((example, index) => (
                  <div key={index} className={styles.example}>
                    <div className={styles.formGroup}>
                      <div className={styles.editorHeader}>
                        <label>Input</label>
                        <select
                          value={example.inputLanguage}
                          onChange={(e) => handleEditorLanguageChange(index, 'inputLanguage', e.target.value)}
                          className={styles.languageSelect}
                        >
                          <option value="plaintext">Plain Text</option>
                          <option value="javascript">JavaScript</option>
                          <option value="typescript">TypeScript</option>
                          <option value="python">Python</option>
                          <option value="java">Java</option>
                          <option value="cpp">C++</option>
                          <option value="csharp">C#</option>
                          <option value="ruby">Ruby</option>
                          <option value="go">Go</option>
                          <option value="rust">Rust</option>
                          <option value="sql">SQL</option>
                          <option value="json">JSON</option>
                          <option value="xml">XML</option>
                        </select>
                      </div>
                      <div className={styles.editorContainer}>
                        <MonacoEditorWrapper
                          height="200px"
                          language={example.inputLanguage}
                          value={example.input}
                          onChange={(value: string | undefined) => handleEditorChange(index, 'input', value)}
                          options={{
                            minimap: { enabled: false },
                            fontSize: 14,
                            lineNumbers: 'on',
                            scrollBeyondLastLine: false,
                            wordWrap: 'on',
                            wrappingIndent: 'indent',
                            automaticLayout: true,
                          }}
                        />
                      </div>
                      <div className={styles.imageUploadInExample}>
                        <label>Input Illustration</label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                const newExamples = [...formData.examples];
                                newExamples[index].inputImage = {
                                  url: event.target?.result as string,
                                  caption: ''
                                };
                                setFormData(prev => ({
                                  ...prev,
                                  examples: newExamples
                                }));
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                        {example.inputImage && (
                          <div className={styles.exampleImagePreview}>
                            <img src={example.inputImage.url} alt="Input Example" />
                            <input
                              type="text"
                              placeholder="Image caption"
                              value={example.inputImage.caption}
                              onChange={(e) => {
                                const newExamples = [...formData.examples];
                                newExamples[index].inputImage = {
                                  ...newExamples[index].inputImage!,
                                  caption: e.target.value
                                };
                                setFormData(prev => ({
                                  ...prev,
                                  examples: newExamples
                                }));
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newExamples = [...formData.examples];
                                newExamples[index].inputImage = null;
                                setFormData(prev => ({
                                  ...prev,
                                  examples: newExamples
                                }));
                              }}
                              className={styles.removeImageButton}
                            >
                              Remove Image
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className={styles.formGroup}>
                      <div className={styles.editorHeader}>
                        <label>Output</label>
                        <select
                          value={example.outputLanguage}
                          onChange={(e) => handleEditorLanguageChange(index, 'outputLanguage', e.target.value)}
                          className={styles.languageSelect}
                        >
                          <option value="plaintext">Plain Text</option>
                          <option value="javascript">JavaScript</option>
                          <option value="typescript">TypeScript</option>
                          <option value="python">Python</option>
                          <option value="java">Java</option>
                          <option value="cpp">C++</option>
                          <option value="csharp">C#</option>
                          <option value="ruby">Ruby</option>
                          <option value="go">Go</option>
                          <option value="rust">Rust</option>
                          <option value="sql">SQL</option>
                          <option value="json">JSON</option>
                          <option value="xml">XML</option>
                        </select>
                      </div>
                      <div className={styles.editorContainer}>
                        <MonacoEditorWrapper
                          height="200px"
                          language={example.outputLanguage}
                          value={example.output}
                          onChange={(value: string | undefined) => handleEditorChange(index, 'output', value)}
                          options={{
                            minimap: { enabled: false },
                            fontSize: 14,
                            lineNumbers: 'on',
                            scrollBeyondLastLine: false,
                            wordWrap: 'on',
                            wrappingIndent: 'indent',
                            automaticLayout: true,
                          }}
                        />
                      </div>
                      <div className={styles.imageUploadInExample}>
                        <label>Output Illustration</label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                const newExamples = [...formData.examples];
                                newExamples[index].outputImage = {
                                  url: event.target?.result as string,
                                  caption: ''
                                };
                                setFormData(prev => ({
                                  ...prev,
                                  examples: newExamples
                                }));
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                        {example.outputImage && (
                          <div className={styles.exampleImagePreview}>
                            <img src={example.outputImage.url} alt="Output Example" />
                            <input
                              type="text"
                              placeholder="Image caption"
                              value={example.outputImage.caption}
                              onChange={(e) => {
                                const newExamples = [...formData.examples];
                                newExamples[index].outputImage = {
                                  ...newExamples[index].outputImage!,
                                  caption: e.target.value
                                };
                                setFormData(prev => ({
                                  ...prev,
                                  examples: newExamples
                                }));
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newExamples = [...formData.examples];
                                newExamples[index].outputImage = null;
                                setFormData(prev => ({
                                  ...prev,
                                  examples: newExamples
                                }));
                              }}
                              className={styles.removeImageButton}
                            >
                              Remove Image
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addExample}
                  className={styles.addExampleButton}
                >
                  Add Example
                </button>
              </div>

              {addStarterCodeSection()}

              <div className={styles.formSection}>
                <h3>Working Code Solution</h3>
                <div className={styles.workingCodeEditor}>
                  <MonacoEditorWrapper
                    height="300px"
                    language="python"
                    value={formData.working_driver}
                    onChange={(value: string | undefined) => {
                      setFormData(prev => ({
                        ...prev,
                        working_driver: value || ''
                      }));
                    }}
                    theme="vs-dark"
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      lineNumbers: 'on',
                      wordWrap: 'on'
                    }}
                  />
                </div>
              </div>

              {addTestCaseSection()}

              <div className={styles.formActions}>
                <button type="submit" className={styles.submitButton}>
                  {editingQuestion ? 'Update' : 'Create'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingQuestion(null);
                  }}
                  className={styles.cancelButton}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className={styles.questionsList}>
        <div className={styles.questionsHeader}>
          <div className={styles.questionTitle}>Title</div>
          <div className={styles.questionCategories}>Categories</div>
          <div className={styles.questionDifficulty}>Difficulty</div>
          <div className={styles.questionPoints}>Points</div>
          <div className={styles.questionDocker}>Docker</div>
          <div className={styles.questionDescription}>Description</div>
          <div className={styles.questionActions}>Actions</div>
        </div>
        {questions && questions.length > 0 ? (
          questions.map((question) => (
            <div key={question.id} className={styles.questionRow}>
              <div className={styles.questionTitle}>{question.title}</div>
              <div className={styles.questionCategories}>
                <div className={styles.categoryContainer}>
                  {question.category.map((cat, index) => (
                    <span key={index} className={styles.categoryBadge}>{cat}</span>
                  ))}
                </div>
              </div>
              <div className={styles.questionDifficulty}>
                <span className={`${styles.difficultyBadge} ${styles[question.difficulty.toLowerCase()]}`}>
                  {question.difficulty}
                </span>
              </div>
              <div className={styles.questionPoints}>
                <span className={styles.pointsBadge}>{question.points} points</span>
              </div>
              <div className={styles.questionDocker}>
                <span className={styles.dockerBadge}>
                  {question.docker_runner || 'only_python'}
                </span>
              </div>
              <div className={styles.questionDescription}>
                {question.description.length > 100 
                  ? `${question.description.substring(0, 100)}...` 
                  : question.description}
              </div>
              <div className={styles.questionActions}>
                <button
                  onClick={() => handleEditQuestion(question)}
                  className={styles.editButton}
                >
                  Update
                </button>
                <button
                  onClick={() => handleDelete(question.id)}
                  className={styles.deleteButton}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className={styles.noQuestions}>
            No questions available.
          </div>
        )}
      </div>
    </div>
  );
};

export default QuestionManagement; 