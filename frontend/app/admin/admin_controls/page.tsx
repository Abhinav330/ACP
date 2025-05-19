'use client';

import React from 'react';
import Link from 'next/link';
import styles from './admin_controls.module.css';

const AdminControls = () => {
  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Admin Controls</h1>
      <div className={styles.cardContainer}>
        <Link href="/admin/questions" className={styles.card}>
          <div className={styles.cardIcon}>📝</div>
          <h2>Question Management</h2>
          <p>Create, edit, and manage assessment questions</p>
        </Link>
        <Link href="/admin/question-collections" className={styles.card}>
          <div className={styles.cardIcon}>📚</div>
          <h2>Question Collections</h2>
          <p>Create and manage collections of questions</p>
        </Link>
        <Link href="/admin/users" className={styles.card}>
          <div className={styles.cardIcon}>👥</div>
          <h2>User Management</h2>
          <p>View and manage user accounts</p>
        </Link>
        <Link href="/admin/blogs" className={styles.card}>
          <div className={styles.cardIcon}>📰</div>
          <h2>Blog Management</h2>
          <p>Create, edit, and manage blog posts</p>
        </Link>
      </div>
    </div>
  );
};

export default AdminControls; 