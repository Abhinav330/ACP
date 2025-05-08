'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
      const response = await fetch('http://localhost:8000/api/signup', {
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
        <Card className="w-[700px]">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Check your email</CardTitle>
            <CardDescription className="text-center">
              We've sent a 4-digit OTP to {successEmail}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button
              className="w-full"
              onClick={() => router.push(`/verify-otp?email=${encodeURIComponent(successEmail)}`)}
            >
              Enter OTP
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => router.push('/login')}
            >
              Back to Login
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="container flex h-screen w-screen flex-col items-center justify-center">
      <div className={styles.formWrapper}>
        <Card className="w-[700px]">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Create Account</CardTitle>
          <CardDescription className="text-center">
            Enter your details to create your account
          </CardDescription>
        </CardHeader>
          <form className={styles.form} onSubmit={handleSubmit}>
            <CardContent>
            {formStatus === 'error' && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                name="firstName"
                type="text"
                placeholder="Enter your first name"
                disabled={formStatus === 'loading'}
              />
            </div>
                <div className={styles.formGroup}>
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                name="lastName"
                type="text"
                placeholder="Enter your last name"
                required
                disabled={formStatus === 'loading'}
              />
            </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="Enter your email"
                disabled={formStatus === 'loading'}
              />
            </div>
                <div className={styles.formGroup}>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    placeholder="Enter your phone number"
                    disabled={formStatus === 'loading'}
                  />
                </div>
              </div>
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Create a password"
                required
                disabled={formStatus === 'loading'}
              />
                </div>
                <div className={styles.formGroup}>
                  <Label htmlFor="confirmPassword">Confirm Password *</Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    placeholder="Confirm your password"
                    required
                    disabled={formStatus === 'loading'}
                  />
                </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">Company</Label>
              <Input
                id="company"
                name="company"
                type="text"
                placeholder="Enter your company name"
                disabled={formStatus === 'loading'}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button
              type="submit"
              className="w-full"
              disabled={formStatus === 'loading'}
            >
              {formStatus === 'loading' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                'Create Account'
              )}
            </Button>
            <div className="text-center text-sm">
              Already have an account?{' '}
              <Link href="/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
      </div>
    </div>
  );
} 