import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

let socket = null;

// One shared socket connection for the whole app, authenticated with
// whatever token is currently in localStorage.
export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      auth: (cb) => cb({ token: localStorage.getItem('token') }),
    });
  }
  return socket;
}
