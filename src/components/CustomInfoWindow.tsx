import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Group } from '@/lib/interfaces';
import GroupDetailsCard from './GroupDetailsCard';

interface CustomInfoWindowProps {
  group: Group;
  map: google.maps.Map;
  position: google.maps.LatLng | google.maps.LatLngLiteral;
  onClose?: () => void;
}

const CustomInfoWindow: React.FC<CustomInfoWindowProps> = ({ 
  group, 
  map, 
  position, 
  onClose 
}) => {
  const [infoWindow, setInfoWindow] = useState<google.maps.InfoWindow | null>(null);
  const [containerElement, setContainerElement] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    // Create container element for our React content
    const container = document.createElement('div');
    container.className = 'custom-info-window-container';
    setContainerElement(container);

    // Create InfoWindow with custom options
    const infoWindowInstance = new google.maps.InfoWindow({
      content: container,
      position,
      disableAutoPan: false,
      maxWidth: 380, // Slightly increased max width for better readability
      pixelOffset: new google.maps.Size(0, -10) // Adjusted offset for better positioning
    });

    // Add close listener
    google.maps.event.addListener(infoWindowInstance, 'closeclick', () => {
      if (onClose) onClose();
    });

    // Open the InfoWindow
    infoWindowInstance.open(map);

    // Store the InfoWindow instance
    setInfoWindow(infoWindowInstance);

    // Cleanup
    return () => {
      google.maps.event.clearListeners(infoWindowInstance, 'closeclick');
      infoWindowInstance.close();
    };
  }, [map, position, onClose]);

  // Style the InfoWindow once it's ready
  useEffect(() => {
    if (infoWindow) {
      const styleInfoWindow = () => {
        try {
          // Target the info window elements
          const iwOuter = document.querySelector('.gm-style-iw-a') as HTMLElement;
          if (iwOuter) {
            // Style the outer container
            iwOuter.style.boxShadow = 'none'; // Remove default shadow as our card has its own
            iwOuter.style.overflow = 'visible';
            
            // Style the inner container
            const iwInner = document.querySelector('.gm-style-iw-d') as HTMLElement;
            if (iwInner) {
              iwInner.style.overflow = 'hidden';
              iwInner.style.padding = '0';
              // Make sure content isn't truncated
              iwInner.style.maxHeight = 'none !important';
              // Remove scrollbars
              iwInner.style.scrollbarWidth = 'none';
              // Use type assertion for MS-specific property
              (iwInner.style as any).msOverflowStyle = 'none';
              
              // Remove scrollbar in WebKit
              const style = document.createElement('style');
              style.textContent = `
                .gm-style-iw-d::-webkit-scrollbar {
                  display: none;
                }
              `;
              document.head.appendChild(style);
            }
            
            // Style the wrapping container
            const iwWrapper = document.querySelector('.gm-style-iw-c') as HTMLElement;
            if (iwWrapper) {
              iwWrapper.style.padding = '0';
              iwWrapper.style.overflow = 'visible';
              // Force hardware acceleration for smoother animations
              iwWrapper.style.transform = 'translate3d(0, 0, 0)';
              iwWrapper.style.transition = 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
              iwWrapper.style.borderRadius = '16px'; // Consistent with our card design
              
              // Apply entrance animation with easing
              requestAnimationFrame(() => {
                iwWrapper.style.opacity = '0';
                iwWrapper.style.transform = 'translate3d(0, 20px, 0) scale(0.95)';
                
                setTimeout(() => {
                  iwWrapper.style.opacity = '1';
                  iwWrapper.style.transform = 'translate3d(0, 0, 0) scale(1)';
                }, 50);
              });
              
              // Make background transparent since our card has its own background
              iwWrapper.style.backgroundColor = 'transparent';
              
              // Remove the tail/arrow from InfoWindow
              const arrow = document.querySelector('.gm-style-iw-tc') as HTMLElement;
              if (arrow) {
                arrow.style.display = 'none';
              }
              
              // Hide the default close button since we have our own in GroupDetailsCard
              const closeButton = document.querySelector('.gm-ui-hover-effect') as HTMLElement;
              if (closeButton) {
                closeButton.style.display = 'none';
              }
            }
            
            // Make sure the info window has correct z-index
            const iwContainer = document.querySelector('.gm-style-iw') as HTMLElement;
            if (iwContainer) {
              iwContainer.style.zIndex = '10'; // Ensure it's above markers
              iwContainer.style.filter = 'drop-shadow(0 4px 20px rgba(0, 0, 0, 0.15))'; // Add subtle shadow
            }
            
            // Add subtle highlight below the infowindow to create an illusion of floating
            const highlightDiv = document.createElement('div');
            highlightDiv.style.position = 'absolute';
            highlightDiv.style.left = '50%';
            highlightDiv.style.bottom = '-20px';
            highlightDiv.style.width = '30px';
            highlightDiv.style.height = '10px';
            highlightDiv.style.borderRadius = '50%';
            highlightDiv.style.background = 'radial-gradient(rgba(0,0,0,0.15), transparent 70%)';
            highlightDiv.style.transform = 'translateX(-50%)';
            highlightDiv.style.zIndex = '-1';
            highlightDiv.style.pointerEvents = 'none';
            
            // Append the highlight element
            const iwWrapperParent = iwWrapper.parentElement;
            if (iwWrapperParent) {
              iwWrapperParent.style.zIndex = '999';
              iwWrapperParent.appendChild(highlightDiv);
            }
          }
        } catch (error) {
          console.error('Error styling info window:', error);
        }
      };

      // Add listener for when the InfoWindow's DOM is ready
      google.maps.event.addListener(infoWindow, 'domready', styleInfoWindow);

      return () => {
        google.maps.event.clearListeners(infoWindow, 'domready');
      };
    }
  }, [infoWindow]);

  // Render our React component into the InfoWindow using Portal
  return containerElement 
    ? createPortal(<GroupDetailsCard group={group} onClose={onClose} />, containerElement) 
    : null;
};

export default CustomInfoWindow; 