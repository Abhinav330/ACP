import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id?: string;
      email?: string;
      name?: string;
      token?: string;
      isLoggedIn?: boolean;
      is_admin?: boolean;
      is_restricted?: boolean;
      profile_picture?: string;
    }
    lastActivity?: number;
  }

  interface User {
    id: string;
    email: string;
    name: string;
    token: string;
    isLoggedIn: boolean;
    is_admin: boolean;
    is_restricted: boolean;
    profile_picture?: string;
  }
} 