'use client';

import React from 'react';
import { IconType } from 'react-icons';
import { FaUserCircle, FaEdit, FaKey } from 'react-icons/fa';
import ProfilePictureUpload from './ProfilePictureUpload';
import styles from './ProfileHeader.module.css';

interface ProfileHeaderProps {
  userName: string;
  email: string;
  profilePicture?: string;
  onPictureUpload: (file: File) => Promise<void>;
  onEditProfile: () => void;
  onChangePassword: () => void;
  isEditable?: boolean;
}

export default function ProfileHeader({
  userName,
  email,
  profilePicture,
  onPictureUpload,
  onEditProfile,
  onChangePassword,
  isEditable = false,
}: ProfileHeaderProps) {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.pictureSection}>
          {isEditable ? (
            <ProfilePictureUpload
              currentPicture={profilePicture}
              onUpload={onPictureUpload}
              size="large"
            />
          ) : (
            <div className={styles.pictureDisplay}>
              {profilePicture ? (
                <img
                  src={profilePicture}
                  alt={userName}
                  className={styles.image}
                />
              ) : (
                <FaUserCircle className={styles.placeholder} />
              )}
            </div>
          )}
        </div>

        <div className={styles.infoSection}>
          <h1 className={styles.userName}>{userName}</h1>
          <p className={styles.email}>{email}</p>

          {isEditable && (
            <div className={styles.actions}>
              <button
                className={styles.actionButton}
                onClick={onEditProfile}
              >
                <FaEdit className={styles.icon} />
                Edit Profile
              </button>
              <button
                className={styles.actionButton}
                onClick={onChangePassword}
              >
                <FaKey className={styles.icon} />
                Change Password
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 