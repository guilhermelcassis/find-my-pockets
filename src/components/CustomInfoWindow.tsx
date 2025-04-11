import React, { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Group } from '@/lib/interfaces';
import GroupDetailsCard from './GroupDetailsCard';

interface CustomInfoWindowProps {
  group: Group;
  map: google.maps.Map;
  position: google.maps.LatLng | google.maps.LatLngLiteral;
  onClose?: () => void;
  allGroups?: Group[];
}

const CustomInfoWindow: React.FC<CustomInfoWindowProps> = ({ 
  group, 
  map, 
  position, 
  onClose,
  allGroups = []
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

  // State to store groups at the same location
  const [groupsAtSameLocation, setGroupsAtSameLocation] = useState<Group[]>([]);
  const [currentGroupIndex, setCurrentGroupIndex] = useState<number>(0);
  
  // Track when toggle is visible (for detailed view)
  const [isTooltipVisible, setIsTooltipVisible] = useState<boolean>(false);

  // Find other groups at the same location using the allGroups prop
  useEffect(() => {
    // Find groups at the same university with very close coordinates
    const sameLocationGroups = allGroups.filter(g => 
      g.university === group.university && 
      g.coordinates && 
      Math.abs(g.coordinates.latitude - group.coordinates.latitude) < 0.0001 &&
      Math.abs(g.coordinates.longitude - group.coordinates.longitude) < 0.0001
    );
    
    // Set the groups and find the current index
    if (sameLocationGroups.length > 1) {
      setGroupsAtSameLocation(sameLocationGroups);
      const currentIndex = sameLocationGroups.findIndex(g => g.id === group.id);
      setCurrentGroupIndex(currentIndex >= 0 ? currentIndex : 0);
    } else {
      // Reset if there's only one group at this location
      setGroupsAtSameLocation([group]);
      setCurrentGroupIndex(0);
    }
  }, [group, allGroups]);

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
              
              // IMPORTANT: Ensure styles from the parent document can reach into the InfoWindow shadow DOM 
              iwInner.style.isolation = 'auto';
              
              // Check if style already exists to prevent duplicates
              const existingStyle = document.getElementById('custom-info-window-styles');
              if (!existingStyle) {
                // Add enhanced keyframe animations for smoother transitions
                const style = document.createElement('style');
                style.id = 'custom-info-window-styles';
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
                    20% { transform: scale(0.98); opacity: 0.9; }
                    70% { transform: scale(1.01); opacity: 0.95; }
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
                  
                  /* Group toggle styles */
                  .group-toggle-container {
                    position: absolute;
                    top: -28px;
                    left: 50%;
                    transform: translateX(-50%);
                    z-index: 1000;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    background-color: white;
                    border-radius: 20px;
                    padding: 4px 6px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                    border: 1px solid rgba(0, 0, 0, 0.05);
                    transition: all 0.2s ease;
                  }
                  
                  .group-toggle-container:hover {
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                  }
                  
                  .group-toggle-button {
                    width: 26px;
                    height: 26px;
                    border-radius: 50%;
                    border: none;
                    background-color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    color: #3b82f6;
                  }
                  
                  .group-toggle-button:hover {
                    background-color: #f0f7ff;
                    transform: scale(1.05);
                  }
                  
                  .group-toggle-button:active {
                    transform: scale(0.95);
                  }
                  
                  .group-toggle-button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                  }
                  
                  .group-indicator-wrapper {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    margin: 0 4px;
                    padding: 2px;
                  }
                  
                  .group-count-label {
                    font-size: 11px;
                    color: #4b5563;
                    margin-right: 4px;
                    white-space: nowrap;
                    font-weight: 500;
                    background-color: #f3f4f6;
                    padding: 2px 6px;
                    border-radius: 10px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                  }
                  
                  .group-count-label:hover {
                    background-color: #e5e7eb;
                  }
                  
                  .group-indicator {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background-color: #e5e7eb;
                    transition: all 0.25s ease;
                    cursor: pointer;
                    opacity: 0.7;
                    border: 1px solid transparent;
                  }
                  
                  .group-indicator:hover {
                    opacity: 1;
                    transform: scale(1.2);
                  }
                  
                  .group-indicator.active {
                    background-color: #3b82f6;
                    opacity: 1;
                    transform: scale(1.1);
                    border: 1px solid rgba(255, 255, 255, 0.8);
                    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
                  }
                  
                  .groups-tooltip {
                    position: absolute;
                    top: 38px;
                    left: 50%;
                    transform: translateX(-50%);
                    background-color: white;
                    border-radius: 12px;
                    padding: 10px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                    z-index: 1000;
                    width: 250px;
                    opacity: 0;
                    visibility: hidden;
                    transition: all 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94);
                    pointer-events: none;
                    border: 1px solid rgba(0, 0, 0, 0.05);
                    transform-origin: top center;
                    transform: translateX(-50%) translateY(-8px) scale(0.95);
                    will-change: transform, opacity, visibility;
                    backface-visibility: hidden;
                  }
                  
                  .groups-tooltip.visible {
                    opacity: 1;
                    visibility: visible;
                    pointer-events: auto;
                    transform: translateX(-50%) translateY(0) scale(1);
                  }
                  
                  .groups-tooltip-arrow {
                    position: absolute;
                    top: -6px;
                    left: 50%;
                    transform: translateX(-50%) rotate(45deg);
                    width: 12px;
                    height: 12px;
                    background-color: white;
                    border-top: 1px solid rgba(0, 0, 0, 0.05);
                    border-left: 1px solid rgba(0, 0, 0, 0.05);
                  }
                  
                  .groups-tooltip-header {
                    margin-bottom: 8px;
                    padding-bottom: 8px;
                    border-bottom: 1px solid #f3f4f6;
                  }
                  
                  .tooltip-title {
                    font-weight: 600;
                    font-size: 13px;
                    color: #1f2937;
                    margin-bottom: 2px;
                  }
                  
                  .tooltip-subtitle {
                    font-size: 12px;
                    color: #6b7280;
                  }
                  
                  .group-item {
                    display: flex;
                    align-items: center;
                    padding: 8px 10px;
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    margin-bottom: 6px;
                  }
                  
                  .group-item:last-child {
                    margin-bottom: 0;
                  }
                  
                  .group-item:hover {
                    background-color: #f3f4f6;
                  }
                  
                  .group-item.active {
                    background-color: #ebf5ff;
                  }
                  
                  .group-item-icon {
                    width: 28px;
                    height: 28px;
                    border-radius: 50%;
                    background-color: #3b82f6;
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                    font-size: 13px;
                    margin-right: 10px;
                    flex-shrink: 0;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                    border: 2px solid white;
                  }
                  
                  .group-item-content {
                    flex: 1;
                    min-width: 0;
                  }
                  
                  .group-item-title {
                    font-weight: 600;
                    font-size: 13px;
                    color: #1f2937;
                    margin-bottom: 3px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                  }
                  
                  .group-item-subtitle {
                    font-size: 12px;
                    color: #6b7280;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                  }
                  
                  .group-toggle-wrapper {
                    position: relative;
                    z-index: 1000;
                  }

                  /* Ensure card container has proper spacing for the toggle */
                  .card-container {
                    position: relative;
                    margin-top: 24px;
                  }

                  /* Slide transition for list item clicks */
                  @keyframes slideTransition {
                    0% { opacity: 0.85; transform: translateX(-5px); }
                    100% { opacity: 1; transform: translateX(0); }
                  }

                  /* Enhanced list item transition effect */
                  .list-item-transition {
                    animation: slideTransition 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
                  }

                  /* Group toggle transition */
                  .group-toggle-transition {
                    animation: togglePulse 0.3s ease-in-out;
                  }
                  
                  /* Highlight animation for selected list item */
                  @keyframes highlightItem {
                    0% { background-color: #ebf5ff; }
                    50% { background-color: #dbeafe; }
                    100% { background-color: #ebf5ff; }
                  }
                  
                  /* Fade content animation without disappearing */
                  @keyframes fadeContent {
                    0% { opacity: 1; }
                    50% { opacity: 0.7; }
                    100% { opacity: 1; }
                  }
                  
                  /* Smooth content change animation */
                  .content-change {
                    animation: fadeContent 0.3s ease-in-out;
                  }
                  
                  /* Enhanced glow for card transition */
                  @keyframes togglePulse {
                    0% { box-shadow: 0 0 0 rgba(59, 130, 246, 0); }
                    50% { box-shadow: 0 0 15px rgba(59, 130, 246, 0.2); }
                    100% { box-shadow: 0 0 0 rgba(59, 130, 246, 0); }
                  }

                  /* Group item button optimizations */
                  .group-item {
                    backface-visibility: hidden;
                    perspective: 1000px;
                    transform-style: preserve-3d;
                  }
                  
                  .group-item:active {
                    transform: scale(0.97);
                  }
                  
                  /* Content wrapper optimizations for smooth transitions */
                  .group-details-card {
                    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
                    backface-visibility: hidden;
                    transform: translateZ(0);
                    will-change: transform, opacity;
                  }
                `;
                document.head.appendChild(style);
              }
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
        transformOrigin: 'center center',
        willChange: 'transform, opacity'
      };
    }
    return {};
  };
  
  // Handle navigation between groups at the same location
  const navigateToGroup = (direction: 'next' | 'prev') => {
    if (groupsAtSameLocation.length <= 1) return;
    
    // Calculate the new index with wrapping
    let newIndex: number;
    if (direction === 'next') {
      newIndex = (currentGroupIndex + 1) % groupsAtSameLocation.length;
    } else {
      newIndex = (currentGroupIndex - 1 + groupsAtSameLocation.length) % groupsAtSameLocation.length;
    }
    
    // Set transition animation state
    setAnimationState('update');
    
    // Update the index after a small delay to trigger animation
    setTimeout(() => {
      setCurrentGroupIndex(newIndex);
      
      // Reset animation state after transition
      setTimeout(() => {
        setAnimationState('idle');
      }, 300);
    }, 100);
  };
  
  // Handle direct navigation to a specific group
  const navigateToGroupIndex = (index: number) => {
    if (index === currentGroupIndex || index < 0 || index >= groupsAtSameLocation.length) return;
    
    // Store current scroll position to prevent page jump
    const scrollPosition = window.scrollY;
    
    // Get references to elements for visual feedback
    const groupItem = document.querySelector(`.group-item:nth-child(${index + 1})`) as HTMLElement;
    if (groupItem) {
      // Add a highlight pulse effect to the clicked item
      groupItem.style.transition = 'all 0.2s ease';
      groupItem.style.backgroundColor = '#dbeafe';
      groupItem.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.4)';
      groupItem.style.transform = 'scale(0.98)';
      
      // Reset highlight after animation completes
      setTimeout(() => {
        groupItem.style.backgroundColor = '';
        groupItem.style.boxShadow = '';
        groupItem.style.transform = '';
      }, 300);
    }
    
    // Add a gentle glow effect to the InfoWindow during transition
    const glowBackground = document.querySelector('.card-glow-background') as HTMLElement;
    if (glowBackground) {
      glowBackground.style.animation = 'glowPulse 0.7s ease-in-out';
      
      setTimeout(() => {
        glowBackground.style.animation = '';
      }, 700);
    }
    
    // Add transition effect to group details card
    const groupDetailsCard = document.querySelector('.group-details-card') as HTMLElement;
    if (groupDetailsCard) {
      groupDetailsCard.classList.add('content-change');
      
      setTimeout(() => {
        groupDetailsCard.classList.remove('content-change');
      }, 300);
    }
    
    // Set animation state to 'update' directly - avoid 'exit' which causes the blipping
    setAnimationState('update');
    
    // Add a subtle transform effect on the card container
    const cardContainer = document.querySelector('.card-container') as HTMLElement;
    if (cardContainer) {
      cardContainer.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
      cardContainer.style.transform = 'scale(0.98)';
      cardContainer.style.opacity = '0.9';
      
      // Reset transform after brief delay
      setTimeout(() => {
        cardContainer.style.transform = 'scale(1)';
        cardContainer.style.opacity = '1';
      }, 150);
    }
    
    // Update the content with a small delay for visual feedback
    setTimeout(() => {
      setCurrentGroupIndex(index);
      
      // Restore scroll position to prevent page jump
      window.scrollTo({ top: scrollPosition });
      
      // Add a subtle entrance effect for the new content
      setTimeout(() => {
        // Reset animation state after transition completes
        setAnimationState('idle');
      }, 300);
    }, 150);
    
    // Delay hiding tooltip to allow the animation to be visible
    setTimeout(() => {
      setIsTooltipVisible(false);
    }, 500);
  };
  
  // Toggle tooltip visibility
  const toggleTooltip = () => {
    setIsTooltipVisible(!isTooltipVisible);
  };
  
  // Get the current displayed group based on navigation
  const displayedGroup = groupsAtSameLocation.length > 1 
    ? groupsAtSameLocation[currentGroupIndex] 
    : group;
  
  // Helper to get leader's first name (or first name + last initial)
  const getLeaderName = (group: Group) => {
    if (!group.leader || !group.leader.name) return "N/A";
    
    const fullName = group.leader.name;
    const nameParts = fullName.split(' ');
    
    if (nameParts.length === 1) return fullName;
    
    // Show first name and first letter of last name
    const firstName = nameParts[0];
    
    // If name has multiple parts, use last part as last name
    const lastName = nameParts[nameParts.length - 1];
    
    // If the last name is very short (like "da", "de", etc.), include the previous part too
    if (nameParts.length > 2 && lastName.length <= 3) {
      const lastNameWithPrefix = `${nameParts[nameParts.length - 2]} ${lastName}`;
      return `${firstName} ${lastNameWithPrefix}`;
    }
    
    return `${firstName} ${lastName}`;
  };
  
  // Helper to format day and time for display
  const formatMeetingDay = (group: Group) => {
    if (!group.meetingTimes || group.meetingTimes.length === 0) return "N/A";
    const meeting = group.meetingTimes[0];
    
    // Create a more informative display with both day and time if available
    let displayText = meeting.dayofweek || "N/A";
    
    if (meeting.time) {
      displayText += ` · ${meeting.time}`;
    }
    
    return displayText;
  };
  
  // Handle click outside to close tooltip
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Only proceed if tooltip is visible
      if (!isTooltipVisible) return;
      
      // Find tooltip element
      const tooltipElement = document.querySelector('.groups-tooltip');
      const toggleWrapper = document.querySelector('.group-toggle-container');
      
      // Check if click was outside tooltip and toggle
      if (tooltipElement && 
          toggleWrapper && 
          !tooltipElement.contains(event.target as Node) && 
          !toggleWrapper.contains(event.target as Node)) {
        setIsTooltipVisible(false);
      }
    };
    
    // Add click listener
    document.addEventListener('mousedown', handleClickOutside);
    
    // Clean up on unmount
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isTooltipVisible]);

  // Render our React component into the InfoWindow using Portal
  return containerElement 
    ? createPortal(
        <div 
          className={`card-container ${animationState !== 'idle' ? `card-${animationState}` : ''}`}
          style={{
            ...getTransitionStyle(), 
            position: 'relative', 
            marginTop: groupsAtSameLocation.length > 1 ? '24px' : '0',
            transition: 'all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1.0)'
          }}
          key={`group-${displayedGroup.id}-${currentGroupIndex}`}
        >
          {/* Enhanced toggle controls for multiple groups */}
          {groupsAtSameLocation.length > 1 && (
            <div className="group-toggle-wrapper" style={{ 
              position: 'absolute', 
              top: '-28px', 
              left: '50%', 
              transform: 'translateX(-50%)',
              zIndex: 1001,
              width: 'auto',
              display: 'block'
            }}>
              <div className="group-toggle-container" style={{
                backgroundColor: 'white',
                borderRadius: '20px',
                padding: '4px 6px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                border: '1px solid rgba(0, 0, 0, 0.05)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <button 
                  className="group-toggle-button"
                  onClick={() => navigateToGroup('prev')}
                  aria-label="Grupo anterior"
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    border: 'none',
                    backgroundColor: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#3b82f6'
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                
                <div className="group-indicator-wrapper" onClick={toggleTooltip} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  margin: '0 4px',
                  padding: '2px'
                }}>
                  <div className="group-count-label" style={{
                    fontSize: '11px',
                    color: '#4b5563',
                    marginRight: '4px',
                    whiteSpace: 'nowrap',
                    fontWeight: 500,
                    backgroundColor: '#f3f4f6',
                    padding: '2px 6px',
                    borderRadius: '10px',
                    cursor: 'pointer'
                  }}>{groupsAtSameLocation.length} grupos</div>
                  {groupsAtSameLocation.map((_, index) => (
                    <div 
                      key={index}
                      className={`group-indicator ${index === currentGroupIndex ? 'active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigateToGroupIndex(index);
                      }}
                      aria-label={`Group ${index + 1}`}
                      style={{
                        width: index === currentGroupIndex ? '10px' : '8px',
                        height: index === currentGroupIndex ? '10px' : '8px',
                        borderRadius: '50%',
                        backgroundColor: index === currentGroupIndex ? '#3b82f6' : '#e5e7eb',
                        cursor: 'pointer',
                        opacity: index === currentGroupIndex ? 1 : 0.7,
                        border: index === currentGroupIndex ? '1px solid rgba(255, 255, 255, 0.8)' : '1px solid transparent',
                        boxShadow: index === currentGroupIndex ? '0 0 0 2px rgba(59, 130, 246, 0.3)' : 'none'
                      }}
                    />
                  ))}
                </div>
                
                <button 
                  className="group-toggle-button"
                  onClick={() => navigateToGroup('next')}
                  aria-label="Próximo grupo"
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    border: 'none',
                    backgroundColor: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#3b82f6'
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
              
              {/* Tooltip with details of all groups at this location */}
              <div className={`groups-tooltip ${isTooltipVisible ? 'visible' : ''}`} style={{
                position: 'absolute',
                top: '38px',
                left: '50%',
                transform: isTooltipVisible 
                  ? 'translateX(-50%) translateY(0) scale(1)' 
                  : 'translateX(-50%) translateY(-8px) scale(0.95)',
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '10px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
                zIndex: 1000,
                width: '250px',
                opacity: isTooltipVisible ? 1 : 0,
                visibility: isTooltipVisible ? 'visible' : 'hidden',
                pointerEvents: isTooltipVisible ? 'auto' : 'none',
                border: '1px solid rgba(0, 0, 0, 0.05)',
                transition: 'all 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                transformOrigin: 'top center',
                willChange: 'transform, opacity, visibility'
              }}>
                <div className="groups-tooltip-arrow" style={{
                  position: 'absolute',
                  top: '-6px',
                  left: '50%',
                  transform: 'translateX(-50%) rotate(45deg)',
                  width: '12px',
                  height: '12px',
                  backgroundColor: 'white',
                  borderTop: '1px solid rgba(0, 0, 0, 0.05)',
                  borderLeft: '1px solid rgba(0, 0, 0, 0.05)'
                }}></div>
                <div className="groups-tooltip-header" style={{
                  marginBottom: '8px',
                  paddingBottom: '8px',
                  borderBottom: '1px solid #f3f4f6'
                }}>
                  <div className="tooltip-title" style={{
                    fontWeight: 600,
                    fontSize: '13px',
                    color: '#1f2937',
                    marginBottom: '2px'
                  }}>Grupos neste local</div>
                  <div className="tooltip-subtitle" style={{
                    fontSize: '12px',
                    color: '#6b7280'
                  }}>{group.university}</div>
                </div>
                {groupsAtSameLocation.map((g, index) => (
                  <div 
                    key={g.id}
                    className={`group-item ${index === currentGroupIndex ? 'active' : ''}`}
                    onClick={() => navigateToGroupIndex(index)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '8px 10px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      marginBottom: '6px',
                      backgroundColor: index === currentGroupIndex ? '#ebf5ff' : 'transparent',
                      transition: 'all 0.2s ease-in-out',
                      transform: 'translateZ(0)', // Force hardware acceleration for smoother animations
                      willChange: 'background-color, transform, box-shadow' // Optimize for animations
                    }}
                  >
                    <div className="group-item-icon" style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: '#3b82f6',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      fontSize: '13px',
                      marginRight: '10px',
                      flexShrink: 0,
                      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                      border: '2px solid white'
                    }}>
                      {g.leader?.name?.charAt(0) || 'U'}
                    </div>
                    <div className="group-item-content" style={{
                      flex: 1,
                      minWidth: 0
                    }}>
                      <div className="group-item-title" style={{
                        fontWeight: 600,
                        fontSize: '13px',
                        color: '#1f2937',
                        marginBottom: '3px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {getLeaderName(g)}
                      </div>
                      <div className="group-item-subtitle" style={{
                        fontSize: '12px',
                        color: '#6b7280',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {formatMeetingDay(g)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <GroupDetailsCard 
            group={displayedGroup} 
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