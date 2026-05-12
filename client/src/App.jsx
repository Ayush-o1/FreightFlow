/**
 * App.jsx
 * Application root component.
 * Simply renders AppRouter — all layout, auth, and routing live inside it.
 */

import AppRouter from './routes/AppRouter';

export default function App() {
  return <AppRouter />;
}
