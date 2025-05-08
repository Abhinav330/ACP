'use client';

import React from 'react';
import { IconType } from 'react-icons';
import { FaLinkedin, FaGlobe, FaGithub, FaTwitter } from 'react-icons/fa';
import styles from './SocialLinks.module.css';

interface SocialLink {
  platform: string;
  url: string;
  icon: IconType;
}

interface SocialLinksProps {
  linkedinUrl?: string;
  websiteUrl?: string;
  githubUrl?: string;
  twitterUrl?: string;
  onEdit?: () => void;
  isEditable?: boolean;
}

export default function SocialLinks({
  linkedinUrl,
  websiteUrl,
  githubUrl,
  twitterUrl,
  onEdit,
  isEditable = false,
}: SocialLinksProps) {
  const socialLinks: SocialLink[] = [
    {
      platform: 'LinkedIn',
      url: linkedinUrl || '',
      icon: FaLinkedin,
    },
    {
      platform: 'Website',
      url: websiteUrl || '',
      icon: FaGlobe,
    },
    {
      platform: 'GitHub',
      url: githubUrl || '',
      icon: FaGithub,
    },
    {
      platform: 'Twitter',
      url: twitterUrl || '',
      icon: FaTwitter,
    },
  ];

  const validLinks = socialLinks.filter((link) => link.url);

  if (!validLinks.length) {
    return (
      <div className={styles.emptyState}>
        <p>No social links added yet.</p>
        {isEditable && (
          <button className={styles.addButton} onClick={onEdit}>
            Add Social Links
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Social Links</h3>
        {isEditable && (
          <button className={styles.editButton} onClick={onEdit}>
            Edit
          </button>
        )}
      </div>
      <div className={styles.links}>
        {validLinks.map((link) => {
          const Icon = link.icon;
          return (
            <a
              key={link.platform}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.link}
            >
              <Icon className={styles.icon} />
              <span className={styles.platform}>{link.platform}</span>
            </a>
          );
        })}
      </div>
    </div>
  );
} 