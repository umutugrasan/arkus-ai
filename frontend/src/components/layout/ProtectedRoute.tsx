import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { useAuth } from '../../context/AuthContext';

interface Props {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: Props) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
        <Loader2 size={32} className="text-indigo-400 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
