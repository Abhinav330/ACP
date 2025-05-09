'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import styles from '../login/login.module.css';

type FormStatus = 'idle' | 'loading' | 'success' | 'error';

export default function ForgotPassword() {
  const router = useRouter();
  const [formStatus, setFormStatus] = useState<FormStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormStatus('loading');
    setErrorMessage('');

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;

    try {
      const response = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to send reset email');
      }

      setFormStatus('success');
    } catch (error) {
      setFormStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'An error occurred');
    }
  };

  if (formStatus === 'success') {
    return (
      <div className="container flex h-screen w-screen flex-col items-center justify-center">
        <div className="w-[400px]">
          <div>
            <div className="text-2xl text-center">Check your email</div>
            <div className="text-center">
              We've sent you a password reset link. Please check your email to reset your password.
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
        <h2 className={styles.title}>Forgot Password</h2>
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              className={styles.input}
              name="email"
              type="email"
              placeholder="john@example.com"
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
            {formStatus === 'loading' ? 'Sending reset link...' : 'Send Reset Link'}
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