'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { apiRequest } from '@/app/utils/api';
import styles from './create.module.css';
import BlogEditor from '@/app/components/BlogEditor';
import Output from 'editorjs-react-renderer';

export default function CreateBlog() {
  const router = useRouter();
  const { data: session, status: authStatus } = useSession();
  const [title, setTitle] = useState('');
  const [mainImage, setMainImage] = useState<{ url: string; caption: string } | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [postStatus, setPostStatus] = useState<'draft' | 'published'>('draft');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blogContent, setBlogContent] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [author, setAuthor] = useState<{ name: string; email: string }>({ name: session?.user?.name || '', email: session?.user?.email || '' });

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const blogData = {
        title,
        main_image: mainImage,
        tags,
        status: postStatus,
        content: blogContent, // Editor.js output
        author,
      };
      await apiRequest('/api/blogs', {
        method: 'POST',
        body: JSON.stringify(blogData)
      });
      router.push('/admin/blogs');
    } catch (err) {
      setError('Failed to create blog post');
    } finally {
      setLoading(false);
    }
  };

  if (authStatus === 'unauthenticated') {
    router.push('/login');
    return null;
  }

  return (
    <div className={styles.container}>
      <h1>Create New Blog Post</h1>
      <form onSubmit={handleSubmit} className={styles.form}>
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
          <BlogEditor initialData={null} onChange={setBlogContent} />
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
          <div style={{ background: '#f9f9f9', padding: 24, borderRadius: 8, marginTop: 16 }}>
            <h2>Preview</h2>
            <Output data={blogContent} />
          </div>
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
        {error && <div className={styles.error}>{error}</div>}
        <button
          type="submit"
          disabled={loading}
          className={styles.submitButton}
        >
          {loading ? 'Creating...' : 'Create Blog Post'}
        </button>
      </form>
    </div>
  );
} 