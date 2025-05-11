'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Loader2 } from 'lucide-react';
import styles from '../login/login.module.css';

type FormStatus = 'idle' | 'loading' | 'error';

function VerifyOTPContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email');
  const [formStatus, setFormStatus] = useState<FormStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [otp, setOtp] = useState<string>('');

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 4);
    setOtp(value);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormStatus('loading');
    setErrorMessage('');

    if (otp.length !== 4) {
      setFormStatus('error');
      setErrorMessage('Please enter a valid 4-digit OTP');
      return;
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACK_END_URL}/api/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          otp,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to verify OTP');
      }

      // Redirect to login page with success message
      router.push('/login?message=Email verified successfully. Please login.');
    } catch (error: any) {
      setFormStatus('error');
      setErrorMessage(error.message || 'An error occurred during verification');
    } finally {
      if (formStatus === 'loading') {
        setFormStatus('idle');
      }
    }
  };

  const handleResendOTP = async () => {
    setFormStatus('loading');
    setErrorMessage('');

    try {
      const response = await fetch('http://localhost:8000/api/resend-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to resend OTP');
      }

      // Show success message
      setErrorMessage('OTP has been resent to your email');
    } catch (error: any) {
      setFormStatus('error');
      setErrorMessage(error.message || 'Failed to resend OTP');
    } finally {
      if (formStatus === 'loading') {
        setFormStatus('idle');
      }
    }
  };

  if (!email) {
    return (
      <div className="container flex h-screen w-screen flex-col items-center justify-center">
        <div className="w-[400px]">
          <div>
            <div className="text-2xl text-center">Invalid Request</div>
            <div className="text-center">
              Please use the link from your email to verify your account
            </div>
          </div>
          <div className="flex justify-center">
            <button onClick={() => router.push('/login')}>
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
        <h2 className={styles.title}>Verify OTP</h2>
        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.formGroup}>
            <label htmlFor="otp">OTP</label>
            <input
              id="otp"
              className={styles.input}
              name="otp"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              placeholder="Enter 4-digit OTP"
              value={otp}
              onChange={handleOtpChange}
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
            disabled={formStatus === 'loading' || otp.length !== 4}
          >
            {formStatus === 'loading' ? 'Verifying...' : 'Verify OTP'}
          </button>
          <button
            type="button"
            className={styles.submitButton}
            onClick={handleResendOTP}
            disabled={formStatus === 'loading'}
            style={{ marginTop: 8 }}
          >
            Resend OTP
          </button>
        </form>
      </div>
    </div>
  );
}

export default function VerifyOTP() {
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
      <VerifyOTPContent />
    </Suspense>
  );
} 