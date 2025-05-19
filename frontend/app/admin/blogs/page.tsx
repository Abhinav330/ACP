'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { apiRequest } from '@/app/utils/api';
import styles from './page.module.css';

interface BlogPost {
  _id: string;
  title: string;
  content: string;
  author: {
    name: string;
    email: string;
  };
  status: 'draft' | 'published';
  tags: string[];
  created_at: string;
  updated_at: string;
}

export default function BlogManagement() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (session?.user?.is_admin !== true) {
      router.push('/');
    }
  }, [session, status, router]);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const response = await apiRequest('/api/blogs', {
          method: 'GET'
        });
        setPosts(response);
      } catch (err) {
        setError('Failed to load blog posts');
        console.error('Error fetching blog posts:', err);
      } finally {
        setLoading(false);
      }
    };

    if (session?.user?.is_admin) {
      fetchPosts();
    }
  }, [session]);

  const handleDelete = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this post?')) {
      return;
    }

    try {
      await apiRequest(`/api/blogs/${postId}`, {
        method: 'DELETE'
      });
      setPosts(posts.filter(post => post._id !== postId));
    } catch (err) {
      setError('Failed to delete blog post');
      console.error('Error deleting blog post:', err);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  if (error) {
    return <div className={styles.error}>{error}</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Blog Management</h1>
        <button
          onClick={() => router.push('/blog/create')}
          className={styles.createButton}
        >
          Create New Post
        </button>
      </div>

      <div className={styles.postsTable}>
        <table className={styles.table}>
          <thead className={styles.tableHead}>
            <tr>
              <th>Title</th>
              <th>Status</th>
              <th>Tags</th>
              <th>Created</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody className={styles.tableBody}>
            {posts.map((post) => (
              <tr key={post._id}>
                <td>{post.title}</td>
                <td>
                  <span className={`${styles.status} ${styles[post.status]}`}>
                    {post.status}
                  </span>
                </td>
                <td>
                  <div className={styles.tags}>
                    {post.tags.map((tag) => (
                      <span key={tag} className={styles.tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </td>
                <td>{new Date(post.created_at).toLocaleDateString()}</td>
                <td>{new Date(post.updated_at).toLocaleDateString()}</td>
                <td>
                  <div className={styles.actions}>
                    <button
                      onClick={() => router.push(`/blog/edit/${post._id}`)}
                      className={styles.editButton}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(post._id)}
                      className={styles.deleteButton}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 