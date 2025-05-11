'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './users.module.css';

interface User {
  id: string;
  firstName?: string;
  lastName: string;
  email: string;
  phone?: string;
  is_admin: boolean;
  is_restricted: boolean;
}

interface Filters {
  adminStatus: 'all' | 'admin' | 'non-admin';
  restrictionStatus: 'all' | 'restricted' | 'non-restricted';
}

const UserManagement = () => {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<Filters>({
    adminStatus: 'all',
    restrictionStatus: 'all'
  });

  useEffect(() => {
    // Check if user is admin
    const user = localStorage.getItem('user');
    if (!user || !JSON.parse(user).is_admin) {
      router.push('/login');
      return;
    }

    fetchUsers();
  }, [router]);

  const fetchUsers = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACK_END_URL}/api/users`);
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      setError('Failed to load users');
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (userId: string, field: 'is_admin' | 'is_restricted', value: boolean) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACK_END_URL}/api/users/${userId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ [field]: value }),
      });

      if (!response.ok) {
        throw new Error('Failed to update user status');
      }

      const updatedUser = await response.json();
      setUsers(users.map(user => 
        user.id === userId ? { ...user, [field]: value } : user
      ));
    } catch (error) {
      setError('Failed to update user status');
      console.error('Error updating user status:', error);
    }
  };

  const filteredUsers = users.filter(user => {
    const searchMatch = 
      (user.firstName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase());

    const adminMatch = 
      filters.adminStatus === 'all' ||
      (filters.adminStatus === 'admin' && user.is_admin) ||
      (filters.adminStatus === 'non-admin' && !user.is_admin);

    const restrictionMatch = 
      filters.restrictionStatus === 'all' ||
      (filters.restrictionStatus === 'restricted' && user.is_restricted) ||
      (filters.restrictionStatus === 'non-restricted' && !user.is_restricted);

    return searchMatch && adminMatch && restrictionMatch;
  });

  if (loading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  if (error) {
    return <div className={styles.error}>{error}</div>;
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>User Management</h1>
      
      <div className={styles.controls}>
        <div className={styles.searchBar}>
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>
        
        <div className={styles.filters}>
          <select
            value={filters.adminStatus}
            onChange={(e) => setFilters(prev => ({ ...prev, adminStatus: e.target.value as Filters['adminStatus'] }))}
            className={styles.filterSelect}
          >
            <option value="all">All Users</option>
            <option value="admin">Admins Only</option>
            <option value="non-admin">Non-Admins Only</option>
          </select>

          <select
            value={filters.restrictionStatus}
            onChange={(e) => setFilters(prev => ({ ...prev, restrictionStatus: e.target.value as Filters['restrictionStatus'] }))}
            className={styles.filterSelect}
          >
            <option value="all">All Access Status</option>
            <option value="restricted">Restricted Only</option>
            <option value="non-restricted">Non-Restricted Only</option>
          </select>
        </div>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Admin Status</th>
              <th>Restriction Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(user => (
              <tr key={user.id}>
                <td>
                  {[user.firstName, user.lastName].filter(Boolean).join(' ')}
                </td>
                <td>{user.email}</td>
                <td>{user.phone || '-'}</td>
                <td>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={user.is_admin}
                      onChange={(e) => handleStatusChange(user.id, 'is_admin', e.target.checked)}
                      className={styles.checkbox}
                    />
                    Admin
                  </label>
                </td>
                <td>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={user.is_restricted}
                      onChange={(e) => handleStatusChange(user.id, 'is_restricted', e.target.checked)}
                      className={styles.checkbox}
                    />
                    Restricted
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserManagement; 
