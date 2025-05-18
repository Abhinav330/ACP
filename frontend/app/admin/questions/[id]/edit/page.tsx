'use client';

import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import styles from "../../questions.module.css";
import dynamic from "next/dynamic";
import { apiRequest } from "@/app/utils/api";
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";

const MDEditor = dynamic(
  () => import("@uiw/react-md-editor").then((mod) => {
    const { default: MDEditor } = mod;
    return function CustomMDEditor({ value, onChange, ...props }: any) {
      return (
        <div data-color-mode="light" style={{ width: "100%" }}>
          <MDEditor
            value={value}
            onChange={onChange}
            preview="edit"
            hideToolbar={false}
            enableScroll={true}
            textareaProps={{
              placeholder: "Enter your markdown content here...",
              style: {
                width: "100%",
                minHeight: "200px",
                padding: "10px",
                fontSize: "14px",
                lineHeight: "1.5",
              },
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
  () => import("@monaco-editor/react").then((mod) => {
    const { default: Editor } = mod;
    return function Wrapper(props: any) {
      return <Editor {...props} />;
    };
  }),
  { ssr: false }
);

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
  images?: { url: string; caption: string; }[];
}

const initialFormState: FormData = {
  title: "",
  summary: "",
  description: "",
  category: [],
  difficulty: "",
  points: 0,
  examples: [
    {
      input: "",
      output: "",
      inputLanguage: "plaintext",
      outputLanguage: "plaintext",
      inputImage: null,
      outputImage: null,
    },
  ],
  starterCodes: [],
  allowedLanguages: ["python"],
  testCases: [
    { input: "", expected_output: "", is_hidden: false, order: 1, points: 0 },
  ],
  docker_runner: "only_python",
  working_driver: "",
  Q_type: "pandas",
};

const availableLanguages = [
  { value: "python", label: "Python" },
  { value: "javascript", label: "JavaScript" },
  { value: "java", label: "Java" },
  { value: "cpp", label: "C++" },
];

const moduleTypes = [
  { value: "pandas", label: "Pandas" },
  { value: "sklearn", label: "Scikit-learn" },
  { value: "ai", label: "AI/ML" },
];

const getBackendQuestionImageUrl = (filename: string) => {
  if (!filename) return '';
  return `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/question-image/${filename}`;
};

const extractFilename = (url: string) => {
  if (!url) return '';
  if (url.startsWith('http')) {
    const parts = url.split('/');
    return parts[parts.length - 1].split('?')[0];
  }
  return url;
};

export default function EditQuestion() {
  const router = useRouter();
  const params = useParams();
  const { data: session, status } = useSession();
  const id = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";

  const [formData, setFormData] = useState<FormData>(initialFormState);
  const [starterCodes, setStarterCodes] = useState<StarterCode[]>([]);
  const [allowedLanguages, setAllowedLanguages] = useState<string[]>(["python"]);
  const [testCases, setTestCases] = useState<TestCase[]>([
    { input: "", expected_output: "", is_hidden: false, order: 1, points: 0 },
  ]);
  const [newCategory, setNewCategory] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!id) return;
    setIsLoading(true);
    setError("");
    apiRequest(`/api/admin/questions/${id}`, { method: "GET" })
      .then((data: any) => {
        setFormData({
          ...data,
          images: (data.images || []).map((img: any) => ({
            ...img,
            url: extractFilename(img.url)
          })),
          examples: (data.examples || []).map((ex: any) => ({
            ...ex,
            inputImage: ex.inputImage
              ? { ...ex.inputImage, url: extractFilename(ex.inputImage.url) }
              : null,
            outputImage: ex.outputImage
              ? { ...ex.outputImage, url: extractFilename(ex.outputImage.url) }
              : null,
          })),
          starterCodes: data.starterCodes || [],
          allowedLanguages: data.allowedLanguages || ["python"],
          testCases: data.testCases && data.testCases.length > 0 ? data.testCases : initialFormState.testCases,
          docker_runner: data.docker_runner,
          working_driver: data.working_driver,
          Q_type: data.Q_type || "pandas",
        });
        setStarterCodes(data.starterCodes || []);
        setAllowedLanguages(data.allowedLanguages || ["python"]);
        setTestCases(data.testCases && data.testCases.length > 0 ? data.testCases : initialFormState.testCases);
        setIsLoading(false);
      })
      .catch((err) => {
        setError("Failed to load question");
        setIsLoading(false);
      });
  }, [id]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditorChange = (index: number, field: "input" | "output", value: string | undefined) => {
    setFormData((prev) => ({
      ...prev,
      examples: prev.examples.map((example, i) =>
        i === index ? { ...example, [field]: value || "" } : example
      ),
    }));
  };

  const handleEditorLanguageChange = (index: number, field: "inputLanguage" | "outputLanguage", value: string) => {
    setFormData((prev) => ({
      ...prev,
      examples: prev.examples.map((example, i) =>
        i === index ? { ...example, [field]: value } : example
      ),
    }));
  };

  const addExample = () => {
    setFormData((prev) => ({
      ...prev,
      examples: [
        ...prev.examples,
        {
          input: "",
          output: "",
          inputLanguage: "plaintext",
          outputLanguage: "plaintext",
          inputImage: null,
          outputImage: null,
        },
      ],
    }));
  };

  const removeExample = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      examples: prev.examples.filter((_, i) => i !== index),
    }));
  };

  const handleAddCategory = () => {
    if (newCategory && !formData.category.includes(newCategory)) {
      setFormData((prev) => ({
        ...prev,
        category: [...prev.category, newCategory],
      }));
      setNewCategory("");
    }
  };

  const handleRemoveCategory = (categoryToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      category: prev.category.filter((cat) => cat !== categoryToRemove),
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const questionData = {
        ...formData,
        examples: formData.examples.map((example) => ({
          ...example,
          inputLanguage: example.inputLanguage || "plaintext",
          outputLanguage: example.outputLanguage || "plaintext",
        })),
        starterCodes: starterCodes,
        allowedLanguages: allowedLanguages,
        testCases: testCases.map((tc, index) => ({
          ...tc,
          order: index + 1,
          points: Number(tc.points),
        })),
      };
      const response = await apiRequest(`/api/questions/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          email: JSON.parse(localStorage.getItem("user") || "{}").email,
        },
        body: JSON.stringify(questionData),
      });
      if (response) {
        router.push("/admin/questions");
      }
    } catch (error) {
      setError("An error occurred while updating the question");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMaximize = () => {
    setIsMaximized(!isMaximized);
    setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 300);
  };

  if (status === "loading" || isLoading) {
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

  const token = session?.user?.token;
  const email = session?.user?.email;

  return (
    <div className={styles.container}>
      {error && <div className={styles.error}>{error}</div>}
      <div className={styles.formContainer + (isMaximized ? " " + styles.maximized : "") }>
        <div className={styles.formHeader}>
          <h2>Edit Question</h2>
          <div className={styles.formControls}>
            <button
              className={styles.maximizeButton}
              onClick={handleMaximize}
              title={isMaximized ? "Minimize" : "Maximize"}
            >
              {isMaximized ? "⊟" : "⊞"}
            </button>
            <button
              className={styles.closeButton}
              onClick={() => router.push("/admin/questions")}
              title="Close"
            >
              ×
            </button>
          </div>
        </div>
        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Title */}
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="title">Title</label>
            <input
              className={styles.input}
              id="title"
              name="title"
              type="text"
              value={formData.title}
              onChange={handleInputChange}
              required
            />
          </div>

          {/* Summary */}
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="summary">Summary</label>
            <input
              className={styles.input}
              id="summary"
              name="summary"
              type="text"
              value={formData.summary}
              onChange={handleInputChange}
              required
            />
          </div>

          {/* Description */}
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="description">Description</label>
            <div data-color-mode="light">
              <MDEditor
                value={formData.description}
                onChange={(value: string | undefined) => setFormData((prev) => ({ ...prev, description: value || "" }))}
              />
            </div>
          </div>

          {/* Categories */}
          <div className={styles.formGroup}>
            <label className={styles.label}>Categories</label>
            <div className={styles.categoryInput}>
              <input
                className={styles.input}
                type="text"
                value={newCategory}
                onChange={e => setNewCategory(e.target.value)}
                placeholder="Add category"
              />
              <button type="button" className={styles.addCategoryButton} onClick={handleAddCategory}>Add</button>
            </div>
            <div className={styles.categoryTags}>
              {formData.category.map((cat) => (
                <span key={cat} className={styles.categoryTag}>
                  {cat}
                  <button type="button" className={styles.removeCategoryButton} onClick={() => handleRemoveCategory(cat)}>&times;</button>
                </span>
              ))}
            </div>
          </div>

          {/* Difficulty */}
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="difficulty">Difficulty</label>
            <select
              className={styles.select}
              id="difficulty"
              name="difficulty"
              value={formData.difficulty}
              onChange={handleInputChange}
              required
            >
              <option value="">Select difficulty</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>

          {/* Points */}
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="points">Points</label>
            <input
              className={styles.input}
              id="points"
              name="points"
              type="number"
              min={0}
              value={formData.points}
              onChange={handleInputChange}
              required
            />
          </div>

          {/* Examples */}
          <div className={styles.formSection}>
            <h3>Examples</h3>
            {formData.examples.map((example, idx) => (
              <div key={idx} className={styles.exampleContainer}>
                <div className={styles.exampleHeader}>
                  <span>Example {idx + 1}</span>
                  <button type="button" className={styles.removeCategoryButton} onClick={() => removeExample(idx)} title="Remove Example">&times;</button>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Input</label>
                  <div data-color-mode="light">
                    <MDEditor
                      value={example.input}
                      onChange={(val: string | undefined) => handleEditorChange(idx, "input", val)}
                    />
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Input Language</label>
                  <select
                    className={styles.select}
                    value={example.inputLanguage}
                    onChange={e => handleEditorLanguageChange(idx, "inputLanguage", e.target.value)}
                  >
                    <option value="plaintext">Plaintext</option>
                    <option value="python">Python</option>
                    <option value="javascript">JavaScript</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Input Image</label>
                  {/* Image upload and preview for inputImage */}
                  {example.inputImage ? (
                    <div className={styles.exampleImagePreview}>
                      <img src={getBackendQuestionImageUrl(example.inputImage.url)} alt="Input Example" />
                      <input
                        className={styles.input}
                        type="text"
                        value={example.inputImage.caption}
                        onChange={e => {
                          const caption = e.target.value;
                          setFormData(prev => ({
                            ...prev,
                            examples: prev.examples.map((ex, i) =>
                              i === idx
                                ? { ...ex, inputImage: { ...ex.inputImage!, caption } }
                                : ex
                            )
                          }));
                        }}
                        placeholder="Caption"
                      />
                      <button type="button" className={styles.removeImageButton} onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          examples: prev.examples.map((ex, i) =>
                            i === idx
                              ? { ...ex, inputImage: null }
                              : ex
                          )
                        }));
                      }}>Remove</button>
                    </div>
                  ) : (
                    <input
                      className={styles.input}
                      type="file"
                      accept="image/*"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          // Create FormData for file upload
                          const formData = new FormData();
                          formData.append('file', file);

                          // Upload to Azure Blob Storage
                          console.log('Uploading to:', `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/upload-question-image`);
                          fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/upload-question-image`, {
                            method: 'POST',
                            body: formData,
                            headers: {
                              ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                              ...(email ? { 'email': email } : {}),
                            },
                          })
                          .then(response => response.json())
                          .then(data => {
                          setFormData(prev => ({
                            ...prev,
                              examples: prev.examples.map((ex, i) =>
                                i === idx
                                  ? { ...ex, inputImage: { url: data.filename, caption: "" } }
                                  : ex
                              )
                          }));
                          })
                          .catch(error => {
                            console.error('Error uploading image:', error);
                            alert('Failed to upload image. Please try again.');
                          });
                        }
                      }}
                    />
                  )}
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Output</label>
                  <div data-color-mode="light">
                    <MDEditor
                      value={example.output}
                      onChange={(val: string | undefined) => handleEditorChange(idx, "output", val)}
                    />
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Output Language</label>
                  <select
                    className={styles.select}
                    value={example.outputLanguage}
                    onChange={e => handleEditorLanguageChange(idx, "outputLanguage", e.target.value)}
                  >
                    <option value="plaintext">Plaintext</option>
                    <option value="python">Python</option>
                    <option value="javascript">JavaScript</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Output Image</label>
                  {/* Image upload and preview for outputImage */}
                  {example.outputImage ? (
                    <div className={styles.exampleImagePreview}>
                      <img src={getBackendQuestionImageUrl(example.outputImage.url)} alt="Output Example" />
                      <input
                        className={styles.input}
                        type="text"
                        value={example.outputImage.caption}
                        onChange={e => {
                          const caption = e.target.value;
                          setFormData(prev => ({
                            ...prev,
                            examples: prev.examples.map((ex, i) =>
                              i === idx
                                ? { ...ex, outputImage: { ...ex.outputImage!, caption } }
                                : ex
                            )
                          }));
                        }}
                        placeholder="Caption"
                      />
                      <button type="button" className={styles.removeImageButton} onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          examples: prev.examples.map((ex, i) =>
                            i === idx
                              ? { ...ex, outputImage: null }
                              : ex
                          )
                        }));
                      }}>Remove</button>
                    </div>
                  ) : (
                    <input
                      className={styles.input}
                      type="file"
                      accept="image/*"
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          // Create FormData for file upload
                          const formData = new FormData();
                          formData.append('file', file);

                          // Upload to Azure Blob Storage
                          console.log('Uploading to:', `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/upload-question-image`);
                          fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/upload-question-image`, {
                            method: 'POST',
                            body: formData,
                            headers: {
                              ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                              ...(email ? { 'email': email } : {}),
                            },
                          })
                          .then(response => response.json())
                          .then(data => {
                          setFormData(prev => ({
                            ...prev,
                              examples: prev.examples.map((ex, i) =>
                                i === idx
                                  ? { ...ex, outputImage: { url: data.filename, caption: "" } }
                                  : ex
                              )
                          }));
                          })
                          .catch(error => {
                            console.error('Error uploading image:', error);
                            alert('Failed to upload image. Please try again.');
                          });
                        }
                      }}
                    />
                  )}
                </div>
              </div>
            ))}
            <button type="button" className={styles.addButton} onClick={addExample}>Add Example</button>
          </div>

          {/* Starter Codes */}
          <div className={styles.formSection}>
            <h3>Starter Codes</h3>
            {starterCodes.map((sc, idx) => (
              <div key={idx} className={styles.starterCodeContainer}>
                <div className={styles.starterCodeHeader}>
                  <span>Starter Code {idx + 1}</span>
                  <button type="button" className={styles.removeCategoryButton} onClick={() => setStarterCodes(starterCodes.filter((_, i) => i !== idx))} title="Remove Starter Code">&times;</button>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Language</label>
                  <select
                    className={styles.select}
                    value={sc.language}
                    onChange={e => {
                      const language = e.target.value;
                      setStarterCodes(prev => prev.map((code, i) => i === idx ? { ...code, language } : code));
                    }}
                  >
                    {availableLanguages.map(lang => (
                      <option key={lang.value} value={lang.value}>{lang.label}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Code</label>
                  <MonacoEditorWrapper
                    height="150px"
                    language={sc.language}
                    value={sc.code}
                    onChange={(val: string | undefined) => setStarterCodes(prev => prev.map((code, i) => i === idx ? { ...code, code: val || "" } : code))}
                  />
                </div>
              </div>
            ))}
            <button type="button" className={styles.addButton} onClick={() => setStarterCodes([...starterCodes, { language: "python", code: "" }])}>Add Starter Code</button>
          </div>

          {/* Allowed Languages */}
          <div className={styles.formGroup}>
            <label className={styles.label}>Allowed Languages</label>
            <div className={styles.checkboxGroup}>
              {availableLanguages.map(lang => (
                <label key={lang.value} className={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={allowedLanguages.includes(lang.value)}
                    onChange={e => {
                      if (e.target.checked) {
                        setAllowedLanguages(prev => [...prev, lang.value]);
                      } else {
                        setAllowedLanguages(prev => prev.filter(l => l !== lang.value));
                      }
                    }}
                  />
                  {lang.label}
                </label>
              ))}
            </div>
          </div>

          {/* Test Cases */}
          <div className={styles.formSection}>
            <h3>Test Cases</h3>
            {testCases.map((tc, idx) => (
              <div key={idx} className={styles.testCaseContainer}>
                <div className={styles.testCaseHeader}>
                  <span>Test Case {idx + 1}</span>
                  <button type="button" className={styles.removeCategoryButton} onClick={() => setTestCases(testCases.filter((_, i) => i !== idx))} title="Remove Test Case">&times;</button>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Input</label>
                  <textarea
                    className={styles.textarea}
                    value={tc.input}
                    onChange={e => setTestCases(prev => prev.map((t, i) => i === idx ? { ...t, input: e.target.value } : t))}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Expected Output</label>
                  <textarea
                    className={styles.textarea}
                    value={tc.expected_output}
                    onChange={e => setTestCases(prev => prev.map((t, i) => i === idx ? { ...t, expected_output: e.target.value } : t))}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Is Hidden</label>
                  <input
                    type="checkbox"
                    checked={tc.is_hidden}
                    onChange={e => setTestCases(prev => prev.map((t, i) => i === idx ? { ...t, is_hidden: e.target.checked } : t))}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Points</label>
                  <input
                    className={styles.input}
                    type="number"
                    min={0}
                    value={tc.points}
                    onChange={e => setTestCases(prev => prev.map((t, i) => i === idx ? { ...t, points: Number(e.target.value) } : t))}
                  />
                </div>
              </div>
            ))}
            <button type="button" className={styles.addTestCaseButton} onClick={() => setTestCases([...testCases, { input: "", expected_output: "", is_hidden: false, order: testCases.length + 1, points: 0 }])}>Add Test Case</button>
          </div>

          {/* Docker Runner */}
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="docker_runner">Docker Runner</label>
            <select
              className={styles.select}
              id="docker_runner"
              name="docker_runner"
              value={formData.docker_runner}
              onChange={handleInputChange}
              required
            >
              <option value="only_python">Only Python</option>
              <option value="pandas">Pandas</option>
              <option value="visualizations">Visualizations</option>
              <option value="gpu">GPU</option>
            </select>
          </div>

          {/* Working Driver */}
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="working_driver">Working Driver Code</label>
            <MonacoEditorWrapper
              height="200px"
              language="python"
              value={formData.working_driver}
              onChange={(val: string | undefined) => setFormData(prev => ({ ...prev, working_driver: val || "" }))}
            />
          </div>

          {/* Q_type */}
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="Q_type">Module Type</label>
            <select
              className={styles.select}
              id="Q_type"
              name="Q_type"
              value={formData.Q_type}
              onChange={handleInputChange}
              required
            >
              {moduleTypes.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          <div className={styles.imageUploadSection}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Question Images</label>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={async (e) => {
                  const files = e.target.files;
                  if (files) {
                    for (let i = 0; i < files.length; i++) {
                      const file = files[i];
                      const formData = new FormData();
                      formData.append('file', file);

                      try {
                        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/upload-question-image`, {
                          method: 'POST',
                          body: formData,
                          headers: {
                            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
                            ...(email ? { 'email': email } : {}),
                          },
                        });
                        const data = await response.json();
                        
                        setFormData(prev => ({
                          ...prev,
                          images: [
                            ...(prev.images || []),
                            { url: data.filename, caption: '' }
                          ]
                        }));
                      } catch (error) {
                        console.error('Error uploading image:', error);
                        alert('Failed to upload image. Please try again.');
                      }
                    }
                  }
                }}
                className={styles.input}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <button type="submit" className={styles.button} disabled={isLoading}>Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  );
} 