// API client with automatic authentication handling
import { toast } from 'react-hot-toast';

class ApiClient {
  private baseUrl = '';

  async request(url: string, options: RequestInit & { skipAuthRedirect?: boolean } = {}): Promise<Response> {
    const { skipAuthRedirect, ...fetchOptions } = options;
    const response = await fetch(url, {
      ...fetchOptions,
      credentials: 'include', // Always include cookies
    });

    // Handle session termination/expiration (unless explicitly skipped)
    if (response.status === 401 && !skipAuthRedirect) {
      // Clone the response to read the body without consuming it
      const responseClone = response.clone();
      const errorData = await responseClone.json().catch(() => ({}));
      
      // Check if it's a session-related error
      if (errorData.error === 'Session terminated' || 
          errorData.error === 'Session expired' || 
          errorData.error === 'Session not found') {
        
        // Show appropriate message
        if (errorData.error === 'Session terminated') {
          toast.error('Your session has been terminated by an administrator');
        } else if (errorData.error === 'Session expired') {
          toast.error('Your session has expired');
        } else {
          toast.error('Session invalid');
        }

        // Clear any local storage/state if needed
        // Force redirect to root page after a short delay to show the toast
        // The AuthWrapper will handle showing the login form
        setTimeout(() => {
          window.location.href = '/';
        }, 1000);
        return response; // Return the original response
      }
    }

    return response;
  }

  async get(url: string, options: RequestInit & { skipAuthRedirect?: boolean } = {}) {
    return this.request(url, { ...options, method: 'GET' });
  }

  async post(url: string, data?: any, options: RequestInit & { skipAuthRedirect?: boolean } = {}) {
    return this.request(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put(url: string, data?: any, options: RequestInit & { skipAuthRedirect?: boolean } = {}) {
    return this.request(url, {
      ...options,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete(url: string, options: RequestInit & { skipAuthRedirect?: boolean } = {}) {
    return this.request(url, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient(); 