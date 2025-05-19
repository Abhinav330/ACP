"use client";

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import BlogEditor from '@/app/components/BlogEditor';
import Output from 'editorjs-react-renderer';
import styles from '../../create/create.module.css';
import { apiRequest } from '@/app/utils/api';

function sanitizeEditorJsData(data: any) {
  if (!data || !Array.isArray(data.blocks)) return null;
  return {
    ...data,
    blocks: data.blocks.map((block: any) => ({
      ...block,
      data: Object.fromEntries(
        Object.entries(block.data || {}).map(([k, v]) => [k, typeof v === 'string' ? v : (v == null ? '' : String(v))])
      )
    }))
  };
}

export default function EditBlog() {
  const router = useRouter();
  const params = useParams();
  const { data: session, status: authStatus } = useSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [mainImage, setMainImage] = useState<{ url: string; caption: string } | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [postStatus, setPostStatus] = useState<'draft' | 'published'>('draft');
  const [blogContent, setBlogContent] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [author, setAuthor] = useState<{ name: string; email: string }>({ name: '', email: '' });
  const [createdAt, setCreatedAt] = useState<string | null>(null);

  const blogId = params?.id as string;

  useEffect(() => {
    const fetchBlog = async () => {
      try {
        setLoading(true);
        const response = await apiRequest(`/api/blogs/${blogId}`, { method: 'GET' });
        setTitle(response.title || '');
        setMainImage(response.main_image || null);
        setTags(response.tags || []);
        setPostStatus(response.status || 'draft');
        setBlogContent(response.content || null);
        setCreatedAt(response.created_at ? new Date(response.created_at).toISOString() : null);

        // If author is missing, use session user
        if (response.author && response.author.name) {
          setAuthor(response.author);
        } else if (session?.user) {
          const fullName = session.user.firstName && session.user.lastName
            ? `${session.user.firstName} ${session.user.lastName}`.trim()
            : session.user.name && session.user.name.trim()
              ? session.user.name
              : session.user.email
                ? session.user.email.split('@')[0]
                : '';
          setAuthor({ name: fullName, email: session.user.email || '' });
        } else {
          setAuthor({ name: '', email: '' });
        }
      } catch (err) {
        setError('Failed to load blog');
      } finally {
        setLoading(false);
      }
    };
    if (blogId && authStatus === 'authenticated') fetchBlog();
  }, [blogId, session, authStatus]);

  const handleMainImageUpload = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await apiRequest('/api/upload-blog-image', {
        method: 'POST',
        body: formData,
      });
      setMainImage({ url: response.url, caption: '' });
    } catch (err) {
      setError('Failed to upload main image');
    }
  };

  function formatDateForDisplay(dateString: string | null) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      let newCreatedAt = createdAt;
      if (postStatus === 'published' && !newCreatedAt) {
        newCreatedAt = new Date().toISOString();
        setCreatedAt(newCreatedAt);
      }
      const blogData = {
        title,
        main_image: mainImage,
        tags,
        status: postStatus,
        content: blogContent,
        author,
        created_at: newCreatedAt,
      };
      await apiRequest(`/api/blogs/${blogId}`, {
        method: 'PUT',
        body: JSON.stringify(blogData),
      });
      router.push('/admin/blogs');
    } catch (err) {
      setError('Failed to update blog post');
    } finally {
      setLoading(false);
    }
  };

  if (authStatus === 'unauthenticated') {
    router.push('/login');
    return null;
  }

  if (loading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  if (error) {
    return <div className={styles.error}>{error}</div>;
  }

  return (
    <div className={styles.container}>
      <h1>Edit Blog Post</h1>
      <form onSubmit={handleSave} className={styles.form}>
        <div className={styles.field}>
          <label htmlFor="title">Title</label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className={styles.input}
          />
        </div>
        <div className={styles.mainImageSection}>
          <label>Main Image</label>
          <div className={styles.mainImageUpload}>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleMainImageUpload(file);
              }}
              className={styles.fileInput}
            />
          </div>
          {mainImage && (
            <div className={styles.mainImagePreview}>
              <img src={mainImage.url} alt={mainImage.caption} className={styles.mainImage} />
              <input
                type="text"
                value={mainImage.caption}
                onChange={(e) => setMainImage({ ...mainImage, caption: e.target.value })}
                placeholder="Main image caption"
                className={styles.captionInput}
              />
            </div>
          )}
        </div>
        <div className={styles.field}>
          <label>Content</label>
          <BlogEditor initialData={blogContent} onChange={setBlogContent} />
        </div>
        <div style={{ marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => setShowPreview((prev) => !prev)}
            className={styles.submitButton}
            style={{ background: showPreview ? '#888' : '#007bff' }}
          >
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </button>
        </div>
        {showPreview && blogContent && (
          (() => {
            const safeContent = sanitizeEditorJsData(blogContent);
            if (safeContent) {
              return (
                <div style={{ background: '#f9f9f9', padding: 24, borderRadius: 8, marginTop: 16 }}>
                  <h2>Preview</h2>
                  <Output data={safeContent} />
                </div>
              );
            } else {
              return (
                <div style={{ color: 'red', marginTop: 16 }}>
                  <strong>Preview Error:</strong> Blog content is not in the correct format.
                </div>
              );
            }
          })()
        )}
        <div className={styles.field}>
          <label htmlFor="tags">Tags (comma-separated)</label>
          <input
            type="text"
            id="tags"
            value={tags.join(', ')}
            onChange={(e) => setTags(e.target.value.split(',').map(tag => tag.trim()))}
            className={styles.input}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="status">Status</label>
          <select
            id="status"
            value={postStatus}
            onChange={(e) => setPostStatus(e.target.value as 'draft' | 'published')}
            className={styles.select}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </div>
        <div className={styles.field}>
          <label htmlFor="authorName">Author Name</label>
          <input
            type="text"
            id="authorName"
            value={author.name}
            onChange={e => setAuthor({ ...author, name: e.target.value })}
            className={styles.input}
            required
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="authorEmail">Author Email</label>
          <input
            type="email"
            id="authorEmail"
            value={author.email}
            onChange={e => setAuthor({ ...author, email: e.target.value })}
            className={styles.input}
            required
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="createdAt">Created At</label>
          <input
            type="text"
            id="createdAt"
            value={formatDateForDisplay(createdAt)}
            onChange={e => {
              // Parse the pretty date back to ISO if user edits it (optional, or keep read-only)
              setCreatedAt(new Date(e.target.value).toISOString());
            }}
            className={styles.input}
            placeholder="DD MMMM YYYY"
            disabled={postStatus === 'published'}
          />
        </div>
        {error && <div className={styles.error}>{error}</div>}
        <button
          type="submit"
          disabled={loading}
          className={styles.submitButton}
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
} 