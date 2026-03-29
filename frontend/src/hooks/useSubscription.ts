import { useState, useEffect } from 'react';

interface SubscriptionState {
  isPremium: boolean;
  isLoading: boolean;
}

/**
 * Subscription hook for premium features
 * Currently always returns isPremium: true for development
 * When billing is added, this will check actual subscription status
 */
export function useSubscription(): SubscriptionState {
  const [state, setState] = useState<SubscriptionState>({
    isPremium: true, // Always true for now - gates are in place
    isLoading: false
  });

  useEffect(() => {
    // TODO: Check actual subscription status from backend
    // For now, always premium (free during development)
    setState({
      isPremium: true,
      isLoading: false
    });
  }, []);

  return state;
}

export default useSubscription;
