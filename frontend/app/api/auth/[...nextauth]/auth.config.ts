import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { User as NextAuthUser } from 'next-auth';

interface User extends NextAuthUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  name: string;
  is_admin: boolean;
  is_restricted: boolean;
  token: string;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required');
        }

        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.detail || 'Authentication failed');
          }

          if (!data.access_token) {
            throw new Error('No access token received');
          }

          return {
            id: data.user.id,
            email: data.user.email,
            firstName: data.user.firstName,
            lastName: data.user.lastName,
            name: `${data.user.firstName || ''} ${data.user.lastName || ''}`.trim(),
            is_admin: data.user.is_admin,
            is_restricted: data.user.is_restricted,
            token: data.access_token,
          } as User;
        } catch (error) {
          console.error('Authentication error:', error);
          throw error;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.firstName = (user as any).firstName;
        token.lastName = (user as any).lastName;
        token.name = user.name || '';
        token.is_admin = user.is_admin;
        token.is_restricted = user.is_restricted;
        token.token = user.token;
        token.lastActivity = Date.now();
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        // Check if session has expired due to inactivity
        const lastActivity = token.lastActivity as number;
        const now = Date.now();
        const inactiveTime = now - lastActivity;
        
        if (inactiveTime > 20 * 60 * 1000) { // 20 minutes in milliseconds
          // Return an expired session
          return {
            ...session,
            expires: new Date(0).toISOString() // Set expiry to epoch time
          };
        }
        
        session.user = {
          id: token.id as string,
          email: token.email as string,
          name: token.name as string,
          is_admin: token.is_admin as boolean,
          is_restricted: token.is_restricted as boolean,
          token: token.token as string,
          firstName: (token as any).firstName as string,
          lastName: (token as any).lastName as string,
        } as any;
      }
      return session;
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 20 * 60, // 20 minutes in seconds
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  debug: process.env.NODE_ENV === 'development',
}; 