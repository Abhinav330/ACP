import { getSession, signOut } from 'next-auth/react';

interface RequestOptions extends RequestInit {
  requireAuth?: boolean;
}

interface ApiError extends Error {
  status?: number;
}

export async function apiRequest(url: string, options: RequestOptions = {}) {
  const { requireAuth = true, ...fetchOptions } = options;
  let absoluteUrl = '';
  
  try {
    // Get session from NextAuth
    const session = await getSession();
    
    if (requireAuth && !session) {
      const error = new Error('Authentication required') as ApiError;
      error.status = 401;
      throw error;
    }

    // Convert existing headers to object for easier manipulation
    const existingHeaders = fetchOptions.headers || {};
    const headerObj = existingHeaders instanceof Headers 
      ? Object.fromEntries(existingHeaders.entries())
      : (typeof existingHeaders === 'object' ? { ...existingHeaders } : {});

    // Check if the request body is FormData
    const isFormData = fetchOptions.body instanceof FormData;

    // Prepare headers object
    const headers = {
      ...headerObj,
      // Only set Content-Type for non-FormData requests
      ...(!isFormData && {
        'Content-Type': 'application/json'
      }),
      // Add authentication header if required
      ...(requireAuth && session?.user?.token && {
        'Authorization': `Bearer ${session.user.token}`
      })
    } as Record<string, string>;

    // Ensure the URL is absolute
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    absoluteUrl = url.startsWith('http') 
      ? url 
      : `${baseUrl}${url.startsWith('/') ? url : `/${url}`}`;

    // Log request details
    console.log('API Request:', {
      url: absoluteUrl,
      method: fetchOptions.method || 'GET',
      headers: {
        ...headers,
        'Authorization': headers.Authorization ? 'Bearer [REDACTED]' : undefined
      },
      body: isFormData 
        ? 'FormData' 
        : typeof fetchOptions.body === 'string'
          ? `${fetchOptions.body.substring(0, 500)}...`
          : fetchOptions.body
    });

    const response = await fetch(absoluteUrl, {
      ...fetchOptions,
      headers,
    });

    // Handle 401 Unauthorized responses
    if (response.status === 401) {
      // Sign out the user if the token is invalid
      await signOut({ redirect: true, callbackUrl: '/login' });
      const error = new Error('Session expired') as ApiError;
      error.status = 401;
      throw error;
    }

    // Get the content type once
    const contentType = response.headers.get('content-type');
    const isJson = contentType?.includes('application/json');

    // Read the response body once
    const responseData = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      // For error responses, extract the error detail
      const errorDetail = isJson 
        ? responseData.detail || responseData.message || response.statusText
        : responseData || response.statusText;

      const error = new Error(errorDetail || 'Request failed') as ApiError;
      error.status = response.status;
      throw error;
    }

    // Return the already parsed response
    return responseData;

  } catch (error) {
    // Log the full error details
    console.error('API Request Error:', {
      url: absoluteUrl,
      error: error instanceof Error ? {
        message: error.message,
        status: (error as ApiError).status,
        stack: error.stack
      } : 'Unknown error'
    });
    throw error;
  }
} 
