'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import styles from './modules.module.css';
import { apiRequest } from '@/app/utils/api';

interface Module {
  id: string;
  name: string;
  description: string;
  icon?: string;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const ModuleManagement = () => {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [modules, setModules] = useState<Module[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: '',
    order: 0,
    isActive: true
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'loading') return;

    if (!session || !session.user.is_admin) {
      router.push('/login?callbackUrl=/admin/modules');
      return;
    }

    fetchModules();
  }, [session, status, router]);

  const fetchModules = async () => {
    try {
      const response = await apiRequest('/api/admin/modules', 'GET');
      setModules(response.data);
      setIsLoading(false);
    } catch (err) {
      setError('Failed to fetch modules');
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingModule) {
        await apiRequest(`/api/admin/modules/${editingModule.id}`, 'PUT', formData);
      } else {
        await apiRequest('/api/admin/modules', 'POST', formData);
      }
      setShowForm(false);
      setEditingModule(null);
      setFormData({
        name: '',
        description: '',
        icon: '',
        order: 0,
        isActive: true
      });
      fetchModules();
    } catch (err) {
      setError('Failed to save module');
    }
  };

  const handleEdit = (module: Module) => {
    setEditingModule(module);
    setFormData({
      name: module.name,
      description: module.description,
      icon: module.icon || '',
      order: module.order,
      isActive: module.isActive
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this module?')) return;
    
    try {
      await apiRequest(`/api/admin/modules/${id}`, 'DELETE');
      fetchModules();
    } catch (err) {
      setError('Failed to delete module');
    }
  };

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Module Management</h1>
        <button 
          className={styles.addButton}
          onClick={() => {
            setShowForm(true);
            setEditingModule(null);
            setFormData({
              name: '',
              description: '',
              icon: '',
              order: 0,
              isActive: true
            });
          }}
        >
          Add New Module
        </button>
      </div>

      {showForm && (
        <div className={styles.formContainer}>
          <h2>{editingModule ? 'Edit Module' : 'Add New Module'}</h2>
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formGroup}>
              <label>Name:</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label>Description:</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label>Icon (optional):</label>
              <input
                type="text"
                name="icon"
                value={formData.icon}
                onChange={handleInputChange}
                placeholder="e.g., fa-python"
              />
            </div>
            <div className={styles.formGroup}>
              <label>Order:</label>
              <input
                type="number"
                name="order"
                value={formData.order}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label>
                <input
                  type="checkbox"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleInputChange}
                />
                Active
              </label>
            </div>
            <div className={styles.formActions}>
              <button type="submit" className={styles.submitButton}>
                {editingModule ? 'Update' : 'Create'}
              </button>
              <button 
                type="button" 
                className={styles.cancelButton}
                onClick={() => {
                  setShowForm(false);
                  setEditingModule(null);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className={styles.modulesList}>
        {modules.map(module => (
          <div key={module.id} className={styles.moduleCard}>
            <div className={styles.moduleHeader}>
              <h3>{module.name}</h3>
              <div className={styles.moduleActions}>
                <button 
                  onClick={() => handleEdit(module)}
                  className={styles.editButton}
                >
                  Edit
                </button>
                <button 
                  onClick={() => handleDelete(module.id)}
                  className={styles.deleteButton}
                >
                  Delete
                </button>
              </div>
            </div>
            <p>{module.description}</p>
            <div className={styles.moduleMeta}>
              <span>Order: {module.order}</span>
              <span>Status: {module.isActive ? 'Active' : 'Inactive'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ModuleManagement; 