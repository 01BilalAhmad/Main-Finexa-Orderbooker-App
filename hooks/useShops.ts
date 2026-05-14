// Powered by Finexa
import { useContext } from 'react';
import { ShopsContext, ShopsContextType } from '@/contexts/ShopsContext';

export function useShops(): ShopsContextType {
  const context = useContext(ShopsContext);
  if (!context) throw new Error('useShops must be used within ShopsProvider');
  return context;
}
