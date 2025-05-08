'use client';

import React, { useState } from 'react';
import { FaEdit, FaSave, FaTimes } from 'react-icons/fa';
import styles from './BioSection.module.css';

interface BioSectionProps {
  bio: string;
  onUpdate: (newBio: string) => Promise<void>;
  isEditable?: boolean;
}

export default function BioSection({
  bio,
  onUpdate,
  isEditable = false,
}: BioSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedBio, setEditedBio] = useState(bio);
  const [isSaving, setIsSaving] = useState(false);

  const handleEdit = () => {
    setEditedBio(bio);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setEditedBio(bio);
    setIsEditing(false);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await onUpdate(editedBio);
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating bio:', error);
      alert('Failed to update bio. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!bio && !isEditable) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>About</h3>
        {isEditable && !isEditing && (
          <button className={styles.editButton} onClick={handleEdit}>
            <FaEdit className={styles.icon} />
            Edit
          </button>
        )}
      </div>

      {isEditing ? (
        <div className={styles.editMode}>
          <textarea
            value={editedBio}
            onChange={(e) => setEditedBio(e.target.value)}
            placeholder="Write something about yourself..."
            className={styles.textarea}
            rows={4}
            maxLength={500}
          />
          <div className={styles.actions}>
            <button
              className={styles.cancelButton}
              onClick={handleCancel}
              disabled={isSaving}
            >
              <FaTimes className={styles.icon} />
              Cancel
            </button>
            <button
              className={styles.saveButton}
              onClick={handleSave}
              disabled={isSaving}
            >
              <FaSave className={styles.icon} />
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.displayMode}>
          {bio ? (
            <p className={styles.bio}>{bio}</p>
          ) : (
            <p className={styles.placeholder}>
              No bio added yet. Click edit to add your bio.
            </p>
          )}
        </div>
      )}
    </div>
  );
} 