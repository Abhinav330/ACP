'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { signIn, useSession } from 'next-auth/react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import styles from './login.module.css';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  const [formStatus, setFormStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const callbackUrl = searchParams?.get('callbackUrl') || '/problems';

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      if (session.user.is_restricted) {
        setFormStatus('error');
        setErrorMessage('Your account has been restricted. Please contact the administrator.');
        return;
      }

      // Redirect all users to learning hub
      router.replace('/learning-hub');
    }
  }, [session, status, router]);

  const onSubmit = async (data: LoginFormData) => {
    setFormStatus('loading');
    setErrorMessage('');

    try {
      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (!result) {
        throw new Error('No response from authentication server');
      }

      if (result.error) {
        setFormStatus('error');
        if (result.error.includes('verify your email')) {
          setErrorMessage('Please verify your email before logging in. Check your inbox for the verification link.');
        } else if (result.error.includes('restricted')) {
          setErrorMessage('Your account has been restricted. Please contact the administrator.');
        } else {
          setErrorMessage(result.error || 'Invalid email or password');
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      setFormStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'An error occurred during login. Please try again.');
    } finally {
      if (formStatus === 'loading') {
        setFormStatus('idle');
      }
    }
  };

  if (status === 'loading') {
    return (
      <div className="container flex h-screen w-screen flex-col items-center justify-center">
        <div className="w-[400px]">
          <div className="flex justify-center py-6">
            <Loader2 className="h-8 w-8 animate-spin" />
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
          <h2 className={styles.title}>Login</h2>
          <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
            <div className={styles.formGroup}>
              <label htmlFor="email">Email</label>
              <input
                id="email"
                className={styles.input}
                type="email"
                placeholder="Enter your email"
                {...register('email')}
                disabled={formStatus === 'loading'}
              />
              {errors.email && (
                <p className={styles.error}>{errors.email.message}</p>
              )}
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="password">Password</label>
              <input
                id="password"
                className={styles.input}
                type="password"
                placeholder="Enter your password"
                {...register('password')}
                disabled={formStatus === 'loading'}
              />
              {errors.password && (
                <p className={styles.error}>{errors.password.message}</p>
              )}
            </div>
            {errorMessage && (
              <div className={styles.error}>
                <AlertCircle className="h-4 w-4" />
                <span>{errorMessage}</span>
              </div>
            )}
            <button
              type="submit"
              className={styles.submitButton}
              disabled={formStatus === 'loading'}
            >
              {formStatus === 'loading' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </button>
            <div className={styles.signupLink}>
              Don't have an account?{' '}
              <Link href="/signup">Sign up</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function Login() {
  return (
    <Suspense fallback={
      <div className="container flex items-center justify-center min-h-screen py-12">
        <div className="w-full max-w-md">
          <div>
            <h2 className="text-2xl text-center">Loading...</h2>
          </div>
          <div className="flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
} 
