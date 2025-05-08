import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { User as NextAuthUser } from 'next-auth';

interface User extends NextAuthUser {
  id: string;
  email: string;
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
            name: data.user.name,
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
        token.name = user.name;
        token.is_admin = user.is_admin;
        token.is_restricted = user.is_restricted;
        token.token = user.token;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user = {
          id: token.id as string,
          email: token.email as string,
          name: token.name as string,
          is_admin: token.is_admin as boolean,
          is_restricted: token.is_restricted as boolean,
          token: token.token as string,
        };
      }
      return session;
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  debug: process.env.NODE_ENV === 'development',
}; 