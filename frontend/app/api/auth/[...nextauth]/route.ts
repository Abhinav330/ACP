import NextAuth from 'next-auth';
import { authOptions } from './auth.config';

// Ensure required environment variables are set
if (!process.env.NEXTAUTH_SECRET) {
  throw new Error('NEXTAUTH_SECRET is not set');
}
if (!process.env.NEXTAUTH_URL) {
  throw new Error('NEXTAUTH_URL is not set');
}
if (!process.env.NEXT_PUBLIC_API_URL) {
  throw new Error('NEXT_PUBLIC_API_URL is not set');
}

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST }; 