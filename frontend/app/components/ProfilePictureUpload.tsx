'use client';

import React, { useRef, useState } from 'react';
import { FaUserCircle, FaCamera } from 'react-icons/fa';
import styles from './ProfilePictureUpload.module.css';

interface ProfilePictureUploadProps {
  currentPicture?: string;
  onUpload: (file: File) => Promise<void>;
  size?: 'small' | 'medium' | 'large';
}

export default function ProfilePictureUpload({
  currentPicture,
  onUpload,
  size = 'medium',
}: ProfilePictureUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image size should be less than 5MB');
      return;
    }

    try {
      setIsUploading(true);
      await onUpload(file);
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  return (
    <div
      className={`${styles.container} ${styles[size]} ${
        isDragging ? styles.dragging : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileInputChange}
        className={styles.fileInput}
      />

      {currentPicture ? (
        <img
          src={currentPicture}
          alt="Profile"
          className={styles.image}
        />
      ) : (
        <FaUserCircle className={styles.placeholder} />
      )}

      <div className={styles.overlay}>
        <FaCamera className={styles.cameraIcon} />
        <span className={styles.uploadText}>
          {isUploading ? 'Uploading...' : 'Click or drag to upload'}
        </span>
      </div>
    </div>
  );
} 