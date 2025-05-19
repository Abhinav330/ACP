'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { apiRequest } from '@/app/utils/api';
import styles from './blog.module.css';

interface BlogPost {
  _id: string;
  title: string;
  content: {
    blocks: Array<{
      type: string;
      data: {
        text?: string;
        [key: string]: any;
      };
    }>;
    version: string;
  };
  author: {
    name: string;
    email: string;
  } | null;
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'published';
  tags: string[];
}

export default function BlogPage() {
  const { data: session } = useSession();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const response = await apiRequest('/api/blogs', {
          method: 'GET'
        });
        // Map created_at to createdAt for compatibility
        const mapped = response.map((post: any) => ({
          ...post,
          createdAt: post.created_at || post.createdAt || null,
        }));
        setPosts(mapped);
      } catch (err) {
        setError('Failed to load blog posts');
        console.error('Error fetching blog posts:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, []);

  if (loading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  if (error) {
    return <div className={styles.error}>{error}</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Blog</h1>
        {session?.user?.is_admin && (
          <a href="/blog/create" className={styles.createButton}>
            Create New Post
          </a>
        )}
      </div>

      <div className={styles.postsGrid}>
        {posts.map((post) => (
          <article key={post._id} className={styles.postCard}>
            <h2>{post.title}</h2>
            <div className={styles.metadata}>
              <span>By {post.author?.name || 'Unknown'}</span>
              <span>
                {post.createdAt && !isNaN(new Date(post.createdAt).getTime())
                  ? new Date(post.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
                  : 'No date'}
              </span>
            </div>
            <div className={styles.tags}>
              {post.tags.map((tag) => (
                <span key={tag} className={styles.tag}>
                  {tag}
                </span>
              ))}
            </div>
            <p className={styles.excerpt}>
              {(() => {
                const firstParagraph = post.content.blocks.find(block => block.type === 'paragraph' && block.data.text);
                return firstParagraph?.data?.text ? firstParagraph.data.text.substring(0, 150) + '...' : 'No content available';
              })()}
            </p>
            <a href={`/blog/${post._id}`} className={styles.readMore}>
              Read More
            </a>
          </article>
        ))}
      </div>
    </div>
  );
} 