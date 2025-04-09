// Flag to prevent duplicate Google Maps loading
let isLoading = false;

// Function to load Google Maps API
export const loadGoogleMaps = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    // If already loaded, just return
    if (window.google?.maps) {
      resolve();
      return;
    }
    
    // If already loading, wait for it to complete
    if (isLoading) {
      const checkLoaded = setInterval(() => {
        if (window.google?.maps) {
          clearInterval(checkLoaded);
          resolve();
        }
      }, 100);
      
      setTimeout(() => {
        clearInterval(checkLoaded);
        reject(new Error('Google Maps loading timeout'));
      }, 10000);
      
      return;
    }
    
    // Set flag to prevent duplicate loads
    isLoading = true;
    
    // Load the Google Maps API
    const script = document.createElement('script');
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    
    if (!apiKey) {
      isLoading = false;
      reject(new Error('Google Maps API key not found'));
      return;
    }
    
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&v=beta`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      isLoading = false;
      resolve();
    };
    
    script.onerror = () => {
      isLoading = false;
      reject(new Error('Failed to load Google Maps'));
    };
    
    document.head.appendChild(script);
  });
}; 