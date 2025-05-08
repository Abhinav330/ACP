'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import styles from './question-collections.module.css';
import MarkdownIt from 'markdown-it';

// Import Quill CSS
import 'quill/dist/quill.snow.css';

// Initialize markdown-it
const md = new MarkdownIt();

// Define toolbar configuration
const toolbarOptions = [
  ['bold', 'italic', 'underline', 'strike'],
  ['blockquote', 'code-block'],
  [{ 'header': 1 }, { 'header': 2 }],
  [{ 'list': 'ordered'}, { 'list': 'bullet' }],
  [{ 'color': [] }, { 'background': [] }],
  ['clean']
];

interface Question {
  _id: string;
  title: string;
  summary: string;
  description: string;
  category: string[];
  difficulty: string;
  points: number;
  examples: any[];
  created_at: string;
  updated_at: string;
  allowedLanguages: string[];
  starterCodes: any[];
  testCases: any[];
  docker_runner: string;
  images: any[];
}

interface QuestionCollection {
  _id: string;
  name: string;
  description: string;
  questions: string[]; // Array of question IDs
  use_tier: string;
  createdAt: string;
  updatedAt: string;
}

const QuestionCollections = () => {
  const router = useRouter();
  const [collections, setCollections] = useState<QuestionCollection[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // States for collection management
  const [selectedCollection, setSelectedCollection] = useState<QuestionCollection | null>(null);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [newCollectionDescription, setNewCollectionDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // State for selected questions
  const [selectedQuestions, setSelectedQuestions] = useState<Set<string>>(new Set());
  
  // States for question filtering
  const [searchTerm, setSearchTerm] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('all');

  const [editorContent, setEditorContent] = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<any>(null);

  useEffect(() => {
    // Check if user is admin
    const user = localStorage.getItem('user');
    if (!user || !JSON.parse(user).is_admin) {
      router.push('/login');
      return;
    }

    fetchCollections();
    fetchQuestions();
  }, [router]);

  useEffect(() => {
    // Update selected questions when a collection is selected for editing
    if (selectedCollection) {
      setSelectedQuestions(new Set(selectedCollection.questions));
      setEditorContent(selectedCollection.description || '');
    } else {
      setSelectedQuestions(new Set());
      setEditorContent('');
    }
  }, [selectedCollection]);

  useEffect(() => {
    // Initialize Quill editor when the component mounts
    if (editorRef.current && !quillRef.current) {
      // Dynamically import Quill
      import('quill').then((Quill) => {
        const QuillEditor = Quill.default;
        
        // Create the editor
        if (editorRef.current) {
          quillRef.current = new QuillEditor(editorRef.current, {
            theme: 'snow',
            modules: {
              toolbar: toolbarOptions
            },
            placeholder: 'Enter collection description...'
          });
          
          // Set initial content if available
          if (editorContent) {
            quillRef.current.root.innerHTML = editorContent;
          }
          
          // Add change handler
          quillRef.current.on('text-change', () => {
            setEditorContent(quillRef.current.root.innerHTML);
          });
        }
      });
    }
    
    // Cleanup function
    return () => {
      if (quillRef.current) {
        quillRef.current = null;
      }
    };
  }, []);
  
  // Update editor content when selectedCollection changes
  useEffect(() => {
    if (quillRef.current && selectedCollection) {
      quillRef.current.root.innerHTML = selectedCollection.description || '';
    }
  }, [selectedCollection]);

  const fetchCollections = async () => {
    try {
      const userStr = localStorage.getItem('user');
      if (!userStr) {
        router.push('/login');
        return;
      }
      const user = JSON.parse(userStr);

      const response = await fetch('http://localhost:8000/api/question-collections', {
        headers: {
          'Content-Type': 'application/json',
          'email': user.email
        }
      });
      if (!response.ok) throw new Error('Failed to fetch collections');
      const data = await response.json();
      setCollections(data);
    } catch (error) {
      setError('Failed to load collections');
      console.error('Error fetching collections:', error);
    }
  };

  const fetchQuestions = async () => {
    try {
      const userStr = localStorage.getItem('user');
      if (!userStr) {
        router.push('/login');
        return;
      }
      const user = JSON.parse(userStr);

      const response = await fetch('http://localhost:8000/api/questions', {
        headers: {
          'Content-Type': 'application/json',
          'email': user.email
        }
      });
      if (!response.ok) throw new Error('Failed to fetch questions');
      const data = await response.json();
      
      // Log the raw data for debugging
      console.log('Raw questions data:', data);
      
      // Ensure each question has required fields
      const validQuestions = data.filter((q: any) => q._id && q.title);
      setQuestions(validQuestions);
    } catch (error) {
      setError('Failed to load questions');
      console.error('Error fetching questions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCollection = async () => {
    try {
      const userStr = localStorage.getItem('user');
      if (!userStr) {
        router.push('/login');
        return;
      }
      const user = JSON.parse(userStr);

      const response = await fetch('http://localhost:8000/api/question-collections', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'email': user.email
        },
        body: JSON.stringify({
          name: newCollectionName,
          description: editorContent,
          questions: Array.from(selectedQuestions), // Array of question IDs
          use_tier: "free"
        })
      });

      if (!response.ok) throw new Error('Failed to create collection');
      
      await fetchCollections();
      handleCancel();
    } catch (error) {
      setError('Failed to create collection');
      console.error('Error creating collection:', error);
    }
  };

  const handleUpdateCollection = async () => {
    if (!selectedCollection) return;

    try {
      const userStr = localStorage.getItem('user');
      if (!userStr) {
        router.push('/login');
        return;
      }
      const user = JSON.parse(userStr);

      const response = await fetch(`http://localhost:8000/api/question-collections/${selectedCollection._id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'email': user.email
        },
        body: JSON.stringify({
          name: newCollectionName,
          description: editorContent,
          questions: Array.from(selectedQuestions),
          use_tier: "free"
        })
      });

      if (!response.ok) throw new Error('Failed to update collection');
      
      await fetchCollections();
      handleCancel();
    } catch (error) {
      setError('Failed to update collection');
      console.error('Error updating collection:', error);
    }
  };

  const handleDeleteCollection = async (collectionId: string) => {
    try {
      const userStr = localStorage.getItem('user');
      if (!userStr) {
        router.push('/login');
        return;
      }
      const user = JSON.parse(userStr);

      const response = await fetch(`http://localhost:8000/api/question-collections/${collectionId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'email': user.email
        }
      });

      if (!response.ok) throw new Error('Failed to delete collection');
      
      await fetchCollections();
      setSelectedCollection(null);
    } catch (error) {
      setError('Failed to delete collection');
      console.error('Error deleting collection:', error);
    }
  };

  const handleCancel = () => {
    setIsCreating(false);
    setIsEditing(false);
    setSelectedCollection(null);
    setNewCollectionName('');
    setNewCollectionDescription('');
    setEditorContent('');
    setSelectedQuestions(new Set());
  };

  const handleQuestionToggle = (questionId: string) => {
    const newSelected = new Set(selectedQuestions);
    if (newSelected.has(questionId)) {
      newSelected.delete(questionId);
    } else {
      newSelected.add(questionId);
    }
    setSelectedQuestions(newSelected);
  };

  const filteredQuestions = questions.filter(question => {
    if (!question._id || !question.title) return false;
    
    const searchMatch = (
      question.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (question.description || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
    const difficultyMatch = difficultyFilter === 'all' || question.difficulty === difficultyFilter;
    return searchMatch && difficultyMatch;
  });

  // Sort questions to show selected ones first
  const sortedQuestions = [...filteredQuestions].sort((a, b) => {
    const aSelected = selectedQuestions.has(a._id);
    const bSelected = selectedQuestions.has(b._id);
    if (aSelected === bSelected) return 0;
    return aSelected ? -1 : 1;
  });

  // Log questions data for debugging
  console.log('Questions data:', questions);
  console.log('Filtered questions:', filteredQuestions);
  console.log('Sorted questions:', sortedQuestions);

  const handleEditorChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditorContent(e.target.value);
  };

  const togglePreviewMode = () => {
    setPreviewMode(!previewMode);
  };

  if (loading) return <div className={styles.loading}>Loading...</div>;
  if (error) return <div className={styles.error}>{error}</div>;

  return (
    <div className={styles.container}>
      <div className={styles.splitLayout}>
        {/* Left Panel */}
        <div className={styles.leftPanel}>
          <div className={styles.leftHeader}>
            <h2>Collections</h2>
            <button 
              className={styles.createButton}
              onClick={() => {
                setIsCreating(true);
                setSelectedCollection(null);
                setSelectedQuestions(new Set());
              }}
            >
              Create New
            </button>
          </div>

          <div className={styles.collectionsList}>
            {collections.map(collection => (
              <div 
                key={collection._id}
                className={`${styles.collectionItem} ${selectedCollection?._id === collection._id ? styles.selected : ''}`}
              >
                <div className={styles.collectionInfo}>
                  <h3>{collection.name}</h3>
                  <span>{collection.questions.length} questions</span>
                </div>
                <div className={styles.collectionActions}>
                  <button
                    className={styles.editButton}
                    onClick={() => {
                      setIsEditing(true);
                      setSelectedCollection(collection);
                      setNewCollectionName(collection.name);
                      setNewCollectionDescription(collection.description);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className={styles.deleteButton}
                    onClick={() => handleDeleteCollection(collection._id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel */}
        <div className={styles.rightPanel}>
          <div className={styles.rightHeader}>
            <h2>{isCreating ? 'Create New Collection' : isEditing ? 'Edit Collection' : 'Questions'}</h2>
            {(isCreating || isEditing) && (
              <div className={styles.formContainer}>
                <h2>{isCreating ? 'Create New Collection' : 'Edit Collection'}</h2>
                <div className={styles.formGroup}>
                  <label htmlFor="name">Collection Name</label>
                <input
                  type="text"
                    id="name"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.target.value)}
                  className={styles.input}
                    placeholder="Enter collection name"
                  />
                </div>
                
                <div className={styles.formGroup}>
                  <label htmlFor="description">Description</label>
                  <div className={styles.editorTabs}>
                    <button 
                      className={`${styles.tabButton} ${!previewMode ? styles.activeTab : ''}`}
                      onClick={() => setPreviewMode(false)}
                    >
                      Edit
                    </button>
                    <button 
                      className={`${styles.tabButton} ${previewMode ? styles.activeTab : ''}`}
                      onClick={() => setPreviewMode(true)}
                    >
                      Preview
                    </button>
                  </div>
                  <div className={styles.editorContainer}>
                    {previewMode ? (
                      <div 
                        className={styles.previewContainer}
                        dangerouslySetInnerHTML={{ __html: md.render(editorContent) }}
                      />
                    ) : (
                      <div ref={editorRef} className={styles.quillEditor}></div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className={styles.filters}>
            <input
              type="text"
              placeholder="Search questions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
            <select
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
              className={styles.select}
            >
              <option key="all" value="all">All Difficulties</option>
              <option key="easy" value="easy">Easy</option>
              <option key="medium" value="medium">Medium</option>
              <option key="hard" value="hard">Hard</option>
            </select>
          </div>

          <div className={styles.questionList}>
            {sortedQuestions.length > 0 ? (
              sortedQuestions.map((question, index) => {
                // Ensure we have a unique key even if _id is undefined
                const uniqueKey = question._id ? `question-${question._id}` : `question-index-${index}`;
                
                return (
                  <div 
                    key={uniqueKey}
                    className={`${styles.questionItem} ${selectedQuestions.has(question._id) ? styles.selected : ''}`}
                  >
                    <label>
                      <input
                        type="checkbox"
                        checked={selectedQuestions.has(question._id)}
                        onChange={() => question._id && handleQuestionToggle(question._id)}
                        className={styles.checkbox}
                        disabled={!question._id}
                      />
                      <div className={styles.questionInfo}>
                        <h4>{question.title || 'Untitled Question'}</h4>
                        <span className={styles.difficulty}>{question.difficulty || 'Unknown'}</span>
                      </div>
                    </label>
                  </div>
                );
              })
            ) : (
              <div className={styles.noQuestions}>
                No questions found
              </div>
            )}
          </div>

          {(isCreating || isEditing) && (
            <div className={styles.actionButtons}>
              <button
                className={styles.confirmButton}
                onClick={isCreating ? handleCreateCollection : handleUpdateCollection}
                disabled={!newCollectionName}
              >
                {isCreating ? 'Create' : 'Update'}
              </button>
              <button
                className={styles.cancelButton}
                onClick={handleCancel}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuestionCollections; 