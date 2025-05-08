'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { signIn, useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Loader2 } from 'lucide-react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

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

      // Handle admin redirection
      if (session.user.is_admin) {
        router.replace('/admin/questions');
        return;
      }

      // Handle regular user redirection
      router.replace(callbackUrl);
    }
  }, [session, status, router, callbackUrl]);

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
        <Card className="w-[400px]">
          <CardContent className="flex justify-center py-6">
            <Loader2 className="h-8 w-8 animate-spin" />
          </CardContent>
        </Card>
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
        <Card className="loginCardResponsive bg-white/90 shadow-2xl">
        <CardHeader>
          <CardTitle>Login</CardTitle>
          <CardDescription>Enter your credentials to access your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                {...register('email')}
                disabled={formStatus === 'loading'}
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                {...register('password')}
                disabled={formStatus === 'loading'}
              />
              {errors.password && (
                <p className="text-sm text-red-500">{errors.password.message}</p>
              )}
            </div>
            {errorMessage && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}
            <Button
              type="submit"
              className="w-full"
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
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-gray-500">
            Don't have an account?{' '}
            <Link href="/signup" className="text-primary hover:underline">
              Sign up
            </Link>
          </p>
        </CardFooter>
      </Card>
      </div>
    </div>
  );
}

export default function Login() {
  return (
    <Suspense fallback={
      <div className="container flex items-center justify-center min-h-screen py-12">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Loading...</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Loader2 className="h-8 w-8 animate-spin" />
          </CardContent>
        </Card>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
} 
