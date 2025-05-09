'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import styles from '../login/login.module.css';

type Status = 'loading' | 'success' | 'error' | 'idle';

function VerifyEmailContent() {
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('');
  const [otp, setOtp] = useState('');
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get('email');

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 4);
    setOtp(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setMessage('');

    if (otp.length !== 4) {
      setStatus('error');
      setMessage('Please enter a valid 4-digit OTP');
      return;
    }

    try {
      const response = await fetch('/api/verify-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, otp }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        setMessage('Email verified successfully! You can now log in.');
        // Redirect to login after 3 seconds
        setTimeout(() => {
          router.push('/login');
        }, 3000);
      } else {
        setStatus('error');
        setMessage(data.detail || 'Failed to verify email');
      }
    } catch (error) {
      setStatus('error');
      setMessage('An error occurred while verifying your email');
    }
  };

  const handleResendOTP = async () => {
    setStatus('loading');
    setMessage('');

    try {
      const response = await fetch('/api/resend-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('New OTP has been sent to your email');
      } else {
        setStatus('error');
        setMessage(data.detail || 'Failed to resend OTP');
      }
    } catch (error) {
      setStatus('error');
      setMessage('An error occurred while resending OTP');
    } finally {
      setStatus('idle');
    }
  };

  if (status === 'success') {
    return (
      <div className="container flex items-center justify-center min-h-screen py-12">
        <div className="w-full max-w-md">
          <div>
            <div className="text-2xl text-center">Email Verified</div>
            <div className="text-center">
              Your email has been verified successfully!
            </div>
          </div>
          <div className="flex justify-center">
            <div>
              <CheckCircle2 className="h-4 w-4" />
              <div>{message}</div>
            </div>
          </div>
          <div className="flex justify-center">
            <button
              onClick={() => router.push('/login')}
              className="w-full"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.formWrapper}>
      <h2 className={styles.title}>Verify Your Email</h2>
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.formGroup}>
          <label htmlFor="otp">Verification Code</label>
          <input
            id="otp"
            className={styles.input}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="Enter 4-digit code"
            value={otp}
            onChange={handleOtpChange}
            maxLength={4}
            disabled={status === 'loading'}
            required
          />
        </div>
        {status === 'error' && (
          <div className={styles.error}>{message}</div>
        )}
        <button
          type="submit"
          className={styles.submitButton}
          disabled={status === 'loading'}
        >
          {status === 'loading' ? 'Verifying...' : 'Verify Email'}
        </button>
        <button
          type="button"
          className={styles.submitButton}
          onClick={handleResendOTP}
          disabled={status === 'loading'}
          style={{ marginTop: 8 }}
        >
          Resend Code
        </button>
      </form>
    </div>
  );
}

export default function VerifyEmail() {
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
      <VerifyEmailContent />
    </Suspense>
  );
} 