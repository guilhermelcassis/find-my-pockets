import React, { useEffect, useState, useRef } from 'react';
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
  
  // Add refs to track previous group for smooth transitions
  const prevGroupRef = useRef<Group | null>(null);
  const isTransitioningRef = useRef<boolean>(false);
  
  // Create a state to control animation and transition effects
  const [animationState, setAnimationState] = useState<'enter' | 'update' | 'exit' | 'idle'>('idle');
  
  // Store previous content position for fluid movement animation
  const contentPositionRef = useRef<{x: number, y: number} | null>(null);

  useEffect(() => {
    // Create container element for our React content
    const container = document.createElement('div');
    container.className = 'custom-info-window-container';
    setContainerElement(container);

    // Create InfoWindow with custom options
    const infoWindowInstance = new google.maps.InfoWindow({
      content: container,
      position,
      disableAutoPan: true, // Prevent auto-panning during same university transitions
      maxWidth: 380,
      pixelOffset: new google.maps.Size(0, -10)
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

  // Add a more sophisticated animation timing function
  const getAnimationTiming = (isSameUniversity: boolean) => {
    // Use faster timings for university transitions
    if (isSameUniversity) {
      return {
        prepTransition: 10,   // Time to prepare for transition 
        contentSwap: 30,      // Time to swap content
        resetState: 300       // Time to complete and reset animation states
      };
    }
    
    // Default timing for regular transitions
    return {
      prepTransition: 30,
      contentSwap: 50,
      resetState: 350
    };
  };

  // Handle group changes with transition effects
  useEffect(() => {
    // Skip on initial render
    if (!prevGroupRef.current) {
      prevGroupRef.current = group;
      setAnimationState('enter');
      
      // Reset animation state after entrance animation
      setTimeout(() => {
        setAnimationState('idle');
      }, 300);
      return;
    }
    
    // Check if we're transitioning between different groups at the same university
    const isSameUniversity = 
      prevGroupRef.current.university === group.university && 
      prevGroupRef.current.id !== group.id;
      
    if (isSameUniversity) {
      console.log('CustomInfoWindow: Transitioning between groups at the same university');
      isTransitioningRef.current = true;
      
      // Get optimized animation timing for same-university transitions
      const timing = getAnimationTiming(true);
      
      // Store current content position before animation starts
      const cardElement = document.querySelector('.custom-info-window-container .group-details-card');
      if (cardElement) {
        const rect = cardElement.getBoundingClientRect();
        contentPositionRef.current = {
          x: rect.left,
          y: rect.top
        };
      }
      
      // Start update animation instead of a full exit/enter cycle
      setAnimationState('update');
      
      // After a brief pause, update the data then reset animation state
      setTimeout(() => {
        // Activate the glow effect during transition
        const glowBackground = document.querySelector('.card-glow-background') as HTMLElement;
        if (glowBackground) {
          glowBackground.classList.add('card-wrapper-transition');
          // Remove the animation class after it completes
          setTimeout(() => {
            glowBackground.classList.remove('card-wrapper-transition');
          }, timing.resetState);
        }
        
        prevGroupRef.current = group;
        
        // Reset animation state after transition completes
        setTimeout(() => {
          isTransitioningRef.current = false;
          setAnimationState('idle');
          contentPositionRef.current = null;
        }, timing.resetState);
      }, timing.contentSwap);
    } else {
      // Regular update without special animation - standard behavior
      prevGroupRef.current = group;
    }
  }, [group]);

  // Style the InfoWindow once it's ready
  useEffect(() => {
    if (infoWindow) {
      const styleInfoWindow = () => {
        try {
          // Target the info window elements
          const iwOuter = document.querySelector('.gm-style-iw-a') as HTMLElement;
          if (iwOuter) {
            // Style the outer container
            iwOuter.style.boxShadow = 'none';
            iwOuter.style.overflow = 'visible';
            
            // Style the inner container
            const iwInner = document.querySelector('.gm-style-iw-d') as HTMLElement;
            if (iwInner) {
              iwInner.style.overflow = 'hidden';
              iwInner.style.padding = '0';
              iwInner.style.maxHeight = 'none !important';
              iwInner.style.scrollbarWidth = 'none';
              (iwInner.style as any).msOverflowStyle = 'none';
              
              // Add enhanced keyframe animations for smoother transitions
              const style = document.createElement('style');
              style.textContent = `
                .gm-style-iw-d::-webkit-scrollbar {
                  display: none;
                }
                
                /* Enhanced animations with more natural easing */
                @keyframes fadeIn {
                  from { opacity: 0; transform: translateY(10px); }
                  to { opacity: 1; transform: translateY(0); }
                }
                
                @keyframes fadeOut {
                  from { opacity: 1; transform: translateY(0); }
                  to { opacity: 0; transform: translateY(-10px); }
                }
                
                @keyframes updateContent {
                  0% { transform: scale(1); opacity: 1; }
                  20% { transform: scale(1.02); opacity: 0.9; }
                  100% { transform: scale(1); opacity: 1; }
                }
                
                /* Background glow animation for smoother transitions */
                @keyframes glowPulse {
                  0% { 
                    box-shadow: 0 0 0 rgba(59, 130, 246, 0);
                    background-color: rgba(255, 255, 255, 0);
                  }
                  25% { 
                    box-shadow: 0 0 20px rgba(59, 130, 246, 0.15);
                    background-color: rgba(241, 245, 255, 0.1);
                  }
                  50% { 
                    box-shadow: 0 0 25px rgba(59, 130, 246, 0.25); 
                    background-color: rgba(241, 245, 255, 0.15);
                  }
                  75% { 
                    box-shadow: 0 0 20px rgba(59, 130, 246, 0.15);
                    background-color: rgba(241, 245, 255, 0.1);
                  }
                  100% { 
                    box-shadow: 0 0 0 rgba(59, 130, 246, 0);
                    background-color: rgba(255, 255, 255, 0);
                  }
                }
                
                /* Content transition animations */
                .card-enter {
                  animation: fadeIn 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
                }
                
                .card-exit {
                  animation: fadeOut 0.15s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
                }
                
                .card-update {
                  animation: updateContent 0.3s cubic-bezier(0.25, 0.1, 0.25, 1.0) forwards;
                  will-change: transform, opacity;
                }
                
                /* Card wrapper transition */
                .card-wrapper-transition {
                  animation: glowPulse 0.5s ease-in-out;
                }
              `;
              document.head.appendChild(style);
            }
            
            // Style the wrapping container for smoother animations
            const iwWrapper = document.querySelector('.gm-style-iw-c') as HTMLElement;
            if (iwWrapper) {
              iwWrapper.style.padding = '0';
              iwWrapper.style.overflow = 'visible';
              iwWrapper.style.transform = 'translate3d(0, 0, 0)';
              iwWrapper.style.transition = 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
              iwWrapper.style.borderRadius = '16px';
              
              // Apply entrance animation with easing
              requestAnimationFrame(() => {
                iwWrapper.style.opacity = '0';
                iwWrapper.style.transform = 'translate3d(0, 20px, 0) scale(0.95)';
                
                setTimeout(() => {
                  iwWrapper.style.opacity = '1';
                  iwWrapper.style.transform = 'translate3d(0, 0, 0) scale(1)';
                }, 50);
              });
              
              // Make background transparent
              iwWrapper.style.backgroundColor = 'transparent';
              
              // Remove the tail/arrow from InfoWindow
              const arrow = document.querySelector('.gm-style-iw-tc') as HTMLElement;
              if (arrow) {
                arrow.style.display = 'none';
              }
              
              // Hide the default close button
              const closeButton = document.querySelector('.gm-ui-hover-effect') as HTMLElement;
              if (closeButton) {
                closeButton.style.display = 'none';
                closeButton.style.visibility = 'hidden';
                closeButton.style.opacity = '0';
                closeButton.style.pointerEvents = 'none';
                
                const closeButtonContainer = closeButton.parentElement;
                if (closeButtonContainer) {
                  closeButtonContainer.style.display = 'none';
                }
              }
            }
            
            // Make sure the info window has correct z-index
            const iwContainer = document.querySelector('.gm-style-iw') as HTMLElement;
            if (iwContainer) {
              iwContainer.style.zIndex = '10';
              iwContainer.style.filter = 'drop-shadow(0 4px 20px rgba(0, 0, 0, 0.15))';
              
              // Prevent infowindow from jittering during transitions
              iwContainer.style.willChange = 'transform';
              iwContainer.style.transformStyle = 'preserve-3d';
              iwContainer.style.backfaceVisibility = 'hidden';
            }
            
            // Add subtle highlight effect
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
            
            const iwWrapperParent = iwWrapper.parentElement;
            if (iwWrapperParent) {
              iwWrapperParent.style.zIndex = '999';
              iwWrapperParent.appendChild(highlightDiv);
            }
            
            // Add a glow background element for smoother transitions
            const glowBackground = document.createElement('div');
            glowBackground.className = 'card-glow-background';
            glowBackground.style.position = 'absolute';
            glowBackground.style.top = '0';
            glowBackground.style.left = '0';
            glowBackground.style.right = '0';
            glowBackground.style.bottom = '0';
            glowBackground.style.borderRadius = '16px';
            glowBackground.style.pointerEvents = 'none';
            glowBackground.style.zIndex = '-1';
            
            const customInfoContainer = document.querySelector('.custom-info-window-container');
            if (customInfoContainer) {
              customInfoContainer.appendChild(glowBackground);
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

  // Calculate dynamic style for smooth transitions
  const getTransitionStyle = () => {
    if (animationState === 'update' && contentPositionRef.current) {
      // This will create a smooth positional transition if needed
      return {
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        transformOrigin: 'center center'
      };
    }
    return {};
  };

  // Render our React component into the InfoWindow using Portal
  return containerElement 
    ? createPortal(
        <div 
          className={`card-container ${animationState !== 'idle' ? `card-${animationState}` : ''}`}
          style={getTransitionStyle()}
        >
          <GroupDetailsCard 
            group={group} 
            onClose={onClose} 
            isInsideInfoWindow={true}
            animationState={animationState}
          />
        </div>, 
        containerElement
      ) 
    : null;
};

export default CustomInfoWindow; 