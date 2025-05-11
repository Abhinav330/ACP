'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import styles from './signup.module.css';

type FormStatus = 'idle' | 'loading' | 'error' | 'success';

export default function Signup() {
  const router = useRouter();
  const [formStatus, setFormStatus] = useState<FormStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successEmail, setSuccessEmail] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormStatus('loading');
    setErrorMessage('');

    const formData = new FormData(e.currentTarget);
    const firstName = formData.get('firstName') as string;
    const lastName = formData.get('lastName') as string;
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const company = formData.get('company') as string;

    const requestData = {
      firstName,
      lastName,
      email,
      password,
      company,
    };

    console.log('=== Signup Request ===');
    console.log('Request Data:', requestData);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACK_END_URL}/api/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      console.log('=== Signup Response ===');
      console.log('Status:', response.status);
      console.log('Status Text:', response.statusText);
      
      const data = await response.json();
      console.log('Response Data:', data);

      if (!response.ok) {
        // Handle validation error
        if (response.status === 422) {
          const errorMsg = Array.isArray(data.detail) 
            ? data.detail.map((err: any) => err.msg).join(', ')
            : data.detail;
          throw new Error(errorMsg);
        }
        throw new Error(data.detail || 'Failed to create account');
      }

      // Show success state with email
      setSuccessEmail(email);
      setFormStatus('success');
    } catch (error: any) {
      console.error('=== Signup Error ===');
      console.error('Error:', error);
      setFormStatus('error');
      setErrorMessage(error.message || 'An error occurred during signup');
    } finally {
      if (formStatus === 'loading') {
        setFormStatus('idle');
      }
    }
  };

  if (formStatus === 'success') {
    return (
      <div className="container flex h-screen w-screen flex-col items-center justify-center">
        <div className="w-[700px]">
          <div>
            <div className="text-2xl text-center">Check your email</div>
            <div className="text-center">
              We've sent a 4-digit OTP to {successEmail}
            </div>
          </div>
          <div className="flex justify-center">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
          </div>
          <div className="flex flex-col space-y-4">
            <button
              className="w-full"
              onClick={() => router.push(`/verify-otp?email=${encodeURIComponent(successEmail)}`)}
            >
              Enter OTP
            </button>
            <button
              className="w-full"
              onClick={() => router.push('/login')}
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen flex flex-col justify-center items-center overflow-hidden">
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover z-0"
        src="/back.mp4"
      />
      <div className="container flex h-full w-full flex-col items-center justify-center relative z-20">
        <div className={styles.formWrapper}>
          <h2 className={styles.title}>Create Account</h2>
          <form className={styles.form} onSubmit={handleSubmit} style={{ fontSize: '0.95rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div className={styles.formGroup} style={{ flex: 1 }}>
                <label htmlFor="firstName" style={{ fontSize: '0.95rem' }}>First Name</label>
                <input
                  id="firstName"
                  className={styles.input}
                  name="firstName"
                  type="text"
                  placeholder="Enter your first name"
                  disabled={formStatus === 'loading'}
                  style={{ height: '2.2rem', fontSize: '0.95rem' }}
                />
              </div>
              <div className={styles.formGroup} style={{ flex: 1 }}>
                <label htmlFor="lastName" style={{ fontSize: '0.95rem' }}>Last Name *</label>
                <input
                  id="lastName"
                  className={styles.input}
                  name="lastName"
                  type="text"
                  placeholder="Enter your last name"
                  required
                  disabled={formStatus === 'loading'}
                  style={{ height: '2.2rem', fontSize: '0.95rem' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div className={styles.formGroup} style={{ flex: 1 }}>
                <label htmlFor="email" style={{ fontSize: '0.95rem' }}>Email</label>
                <input
                  id="email"
                  className={styles.input}
                  name="email"
                  type="email"
                  placeholder="Enter your email"
                  disabled={formStatus === 'loading'}
                  style={{ height: '2.2rem', fontSize: '0.95rem' }}
                />
              </div>
              <div className={styles.formGroup} style={{ flex: 1 }}>
                <label htmlFor="phone" style={{ fontSize: '0.95rem' }}>Phone Number</label>
                <input
                  id="phone"
                  className={styles.input}
                  name="phone"
                  type="tel"
                  placeholder="Enter your phone number"
                  disabled={formStatus === 'loading'}
                  style={{ height: '2.2rem', fontSize: '0.95rem' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <div className={styles.formGroup} style={{ flex: 1 }}>
                <label htmlFor="password" style={{ fontSize: '0.95rem' }}>Password *</label>
                <input
                  id="password"
                  className={styles.input}
                  name="password"
                  type="password"
                  placeholder="Create a password"
                  required
                  disabled={formStatus === 'loading'}
                  style={{ height: '2.2rem', fontSize: '0.95rem' }}
                />
              </div>
              <div className={styles.formGroup} style={{ flex: 1 }}>
                <label htmlFor="confirmPassword" style={{ fontSize: '0.95rem' }}>Confirm Password *</label>
                <input
                  id="confirmPassword"
                  className={styles.input}
                  name="confirmPassword"
                  type="password"
                  placeholder="Confirm your password"
                  required
                  disabled={formStatus === 'loading'}
                  style={{ height: '2.2rem', fontSize: '0.95rem' }}
                />
              </div>
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="company" style={{ fontSize: '0.95rem' }}>Company</label>
              <input
                id="company"
                className={styles.input}
                name="company"
                type="text"
                placeholder="Enter your company name"
                disabled={formStatus === 'loading'}
                style={{ height: '2.2rem', fontSize: '0.95rem' }}
              />
            </div>
            {formStatus === 'error' && (
              <div className={styles.error} style={{ fontSize: '0.9rem' }}>{errorMessage}</div>
            )}
            <button
              type="submit"
              className={styles.submitButton}
              disabled={formStatus === 'loading'}
              style={{ height: '2.4rem', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', width: '100%' }}
            >
              {formStatus === 'loading' ? 'Creating account...' : 'Create Account'}
            </button>
            <div className={styles.signupLink} style={{ fontSize: '0.9rem' }}>
              Already have an account?{' '}
              <Link href="/login">Sign in</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
} 