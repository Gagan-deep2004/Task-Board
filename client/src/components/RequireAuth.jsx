import React from 'react';
import { Navigate } from 'react-router-dom';

// Wrap any route that needs a logged-in user; bounces back to the login
// screen instead of rendering a broken/empty page when there's no token.
export default function RequireAuth({ children }) {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/" replace />;
  }
  return children;
}
