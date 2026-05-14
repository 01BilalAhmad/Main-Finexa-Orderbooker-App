// Finexa Orderbooker
import { useContext } from 'react';
import { LockContext, LockContextType } from '@/contexts/LockContext';

export function useLock(): LockContextType {
  const context = useContext(LockContext);
  if (!context) throw new Error('useLock must be used within LockProvider');
  return context;
}
