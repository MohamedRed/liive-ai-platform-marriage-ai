import { useMemo } from 'react';

export function useLocale() {
  const locale = useMemo(() => {
    // Try to get locale from browser
    const browserLocale = navigator.language;
    
    // Check if locale uses 24-hour format
    const date = new Date();
    date.setHours(13, 0, 0, 0);
    const uses24Hour = new Intl.DateTimeFormat(browserLocale, { 
      hour: 'numeric', 
      hour12: false 
    }).format(date).includes('24');
    
    return {
      locale: browserLocale,
      uses24Hour
    };
  }, []);

  return locale;
} 