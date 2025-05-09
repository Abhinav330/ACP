'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import styles from '../login/login.module.css';

type FormStatus = 'idle' | 'loading' | 'success' | 'error';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [formStatus, setFormStatus] = useState<FormStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormStatus('loading');
    setErrorMessage('');

    if (!token) {
      setFormStatus('error');
      setErrorMessage('Invalid or expired reset token');
      return;
    }

    const formData = new FormData(e.currentTarget);
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (password !== confirmPassword) {
      setFormStatus('error');
      setErrorMessage('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setFormStatus('error');
      setErrorMessage('Password must be at least 8 characters long');
      return;
    }

    try {
      const response = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to reset password');
      }

      setFormStatus('success');
    } catch (error) {
      setFormStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'An error occurred');
    }
  };

  if (!token) {
    return (
      <div className="container flex h-screen w-screen flex-col items-center justify-center">
        <div className="w-[400px]">
          <div>
            <div className="text-2xl text-center">Invalid Reset Link</div>
            <div className="text-center">
              This password reset link is invalid or has expired. Please request a new one.
            </div>
          </div>
          <div className="flex justify-center">
            <button variant="outline" onClick={() => router.push('/forgot-password')}>
              Request New Link
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (formStatus === 'success') {
    return (
      <div className="container flex h-screen w-screen flex-col items-center justify-center">
        <div className="w-[400px]">
          <div>
            <div className="text-2xl text-center">Password Reset Successful</div>
            <div className="text-center">
              Your password has been reset successfully. You can now log in with your new password.
            </div>
          </div>
          <div className="flex justify-center">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
          </div>
          <div className="flex justify-center">
            <button variant="outline" onClick={() => router.push('/login')}>
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container flex h-screen w-screen flex-col items-center justify-center">
      <div className={styles.formWrapper}>
        <h2 className={styles.title}>Reset Password</h2>
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="password">New Password</label>
            <input
              id="password"
              className={styles.input}
              name="password"
              type="password"
              required
              disabled={formStatus === 'loading'}
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="confirmPassword">Confirm New Password</label>
            <input
              id="confirmPassword"
              className={styles.input}
              name="confirmPassword"
              type="password"
              required
              disabled={formStatus === 'loading'}
            />
          </div>
          {formStatus === 'error' && (
            <div className={styles.error}>{errorMessage}</div>
          )}
          <button
            type="submit"
            className={styles.submitButton}
            disabled={formStatus === 'loading'}
          >
            {formStatus === 'loading' ? 'Resetting password...' : 'Reset Password'}
          </button>
          <div className={styles.signupLink}>
            Remember your password?{' '}
            <Link href="/login">Sign in</Link>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ResetPassword() {
  return (
    <Suspense fallback={
      <div className="container flex items-center justify-center min-h-screen py-12">
        <div className="w-full max-w-md">
          <div>
            <div className="text-2xl text-center">Loading...</div>
          </div>
          <div className="flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </div>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
} 