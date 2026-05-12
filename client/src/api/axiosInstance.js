/**
 * axiosInstance.js
 * Pre-configured Axios instance for all FreightFlow API calls.
 *
 * Features:
 *  - Base URL from VITE_API_BASE_URL env variable
 *  - 10-second request timeout
 *  - Request interceptor: attaches JWT token from localStorage
 *  - Response interceptor: handles 401 by clearing session and redirecting
 */

import axios from 'axios';

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/* ----- REQUEST INTERCEPTOR -----
   Attaches the JWT token to every outgoing request if one exists in storage.
*/
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('ff_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/* ----- RESPONSE INTERCEPTOR -----
   On a 401 Unauthorized response: clear local storage and redirect to /login.
   All other responses (success or error) pass through normally.
*/
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.clear();
      // Use window.location so this works outside React Router context
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
