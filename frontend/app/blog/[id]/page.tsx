"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiRequest } from "@/app/utils/api";
import styles from "../blog.module.css";

interface BlogPost {
  _id: string;
  title: string;
  main_image?: {
    url: string;
    caption?: string;
  };
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
  createdAt?: string;
  updatedAt?: string;
  status: "draft" | "published";
  tags: string[];
}

const renderBlock = (block: any) => {
  switch (block.type) {
    case "header":
      return React.createElement(`h${block.data.level || 2}`, {}, block.data.text);
    case "paragraph":
      return <p>{block.data.text}</p>;
    case "list":
      return (
        <ul>
          {block.data.items?.map((item: any, idx: number) => (
            <li key={idx}>{item.content || item}</li>
          ))}
        </ul>
      );
    default:
      return null;
  }
};

export default function BlogPostPage() {
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const fetchPost = async () => {
      try {
        const response = await apiRequest(`/api/blogs/${id}`, { method: "GET" });
        setPost(response);
      } catch (err) {
        setError("Failed to load blog post");
      } finally {
        setLoading(false);
      }
    };
    fetchPost();
  }, [id]);

  if (loading) return <div className={styles.loading}>Loading...</div>;
  if (error) return <div className={styles.error}>{error}</div>;
  if (!post) return <div className={styles.error}>Blog post not found.</div>;

  return (
    <div className={styles.container}>
      <h1>{post.title}</h1>
      {post.main_image?.url && (
        <img
          src={post.main_image.url}
          alt={post.main_image.caption || "Blog main image"}
          className={styles.mainImage}
        />
      )}
      <div className={styles.metadata}>
        <span>By {post.author?.name || "Unknown"}</span>
        {post.createdAt && (
          <span>{new Date(post.createdAt).toLocaleDateString()}</span>
        )}
      </div>
      <div className={styles.tags}>
        {post.tags.map((tag) => (
          <span key={tag} className={styles.tag}>
            {tag}
          </span>
        ))}
      </div>
      <div className={styles.content}>
        {post.content?.blocks?.length > 0 ? (
          post.content.blocks.map((block, idx) => <div key={idx}>{renderBlock(block)}</div>)
        ) : (
          <p>No content available.</p>
        )}
      </div>
    </div>
  );
} 