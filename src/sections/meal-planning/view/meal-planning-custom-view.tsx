import "@livekit/components-styles";
import {firstValueFrom} from "rxjs";
import {useFunctions} from "reactfire";
import {httpsCallable} from "rxfire/functions";
import {createGlobalStyle} from 'styled-components';
// eslint-disable-next-line import/no-extraneous-dependencies
import React, {useState, useEffect, useCallback, useContext, useMemo} from 'react';
// eslint-disable-next-line import/no-extraneous-dependencies
import {
  LiveKitRoom, 
  BarVisualizer, 
  useVoiceAssistant, 
  useConnectionState, 
  VoiceAssistantControlBar,
  RoomAudioRenderer,
  StartAudio,
  useRoomContext
} from "@livekit/components-react";
import { ConnectionState, Room, LocalParticipant } from "livekit-client";

import Box from '@mui/material/Box';
import {useTheme} from "@mui/material/styles";
import Button from '@mui/material/Button';

import {DashboardContent} from 'src/layouts/dashboard';

import {Layout} from 'src/sections/assistant/layout';
import {MealPlanInput} from "../components/meal-plan-input";
import {MealPlanWeeklyView} from "../components/meal-plan-weekly-view";
import {useMealPlanning} from "../hooks";
import {AnimateLogo1, AnimateLogo2} from "src/components/animate";
import { Sheet } from "react-modal-sheet";

// ----------------------------------------------------------------------

// Create a context for device switching
interface MealPlanningRoomContextType {
  onSwitchDevice?: (deviceId: string, label?: string) => void;
}

const MealPlanningRoomContext = React.createContext<MealPlanningRoomContextType>({});

export interface LikekitTokenResponse {
  accessToken: string,
  url: string
}

export function MealPlanningCustomView() {
  const functions = useFunctions();

  const [livekitToken, setLivekitToken] = useState<string>('');
  const [livekitUrl, setLivekitUrl] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const [room] = useState(() => new Room());
  // Add state to track preferred audio device
  const [preferredDeviceId, setPreferredDeviceId] = useState<string>('');

  // Meal planning related state
  const [openIngredientList, setOpenIngredientList] = useState(false);
  const [openShoppingList, setOpenShoppingList] = useState(false);
  const [openNutritionInfo, setOpenNutritionInfo] = useState(false);
  const [openSavedMealPlans, setOpenSavedMealPlans] = useState(false);
  const [openMealPlanInput, setOpenMealPlanInput] = useState(false);
  
  const {
    loading,
    error,
    currentMealPlan,
    generateMealPlan,
    setCurrentMealPlan
  } = useMealPlanning();

  // Define a wrapper function to handle the MealPlanRequest conversion
  const handleGenerateMealPlan = useCallback(async (input: { 
    description: string; 
    imageUrl?: string; 
    videoUrl?: string; 
    imageFiles?: File[] 
  }) => {
    try {
      // Add userId or any other required fields to match MealPlanRequest type
      const mealPlanRequest = {
        ...input,
        userId: 'current-user-id' // You should get the actual user ID from your auth context or state
      };
      await generateMealPlan(mealPlanRequest);
    } catch (error) {
      console.error('Error generating meal plan:', error);
    }
  }, [generateMealPlan]);

  const getLikekitToken = useCallback(async () => {
    const remoteLivekitToken = httpsCallable(functions, 'livekitToken');
    const {
      accessToken,
      url
    } = await firstValueFrom(remoteLivekitToken({})) as LikekitTokenResponse;
    setLivekitToken(accessToken)
    setLivekitUrl(url)
  }, [functions])

  useEffect(() => {
    getLikekitToken();
  }, [getLikekitToken])

  useEffect(() => {
    const handleDisconnected = () => {
      setIsConnected(false);
    };

    room.on('disconnected', handleDisconnected);
    return () => {
      room.off('disconnected', handleDisconnected);
    };
  }, [room]);

  // Handle switching audio devices by triggering device selection in the hidden LiveKit components
  const switchAudioDevice = useCallback((deviceId: string, deviceLabel?: string) => {
    setPreferredDeviceId(deviceId);
    
    console.log("Attempting to switch to device using facade pattern:", deviceId, "with label:", deviceLabel);
    
    // Helper function to temporarily make hidden controls visible for interaction
    const withVisibleControls = (callback: () => void) => {
      // Find all possible containers of hidden controls
      const containers = document.querySelectorAll('div[style*="opacity: 0"], div[style*="hidden"], div[style*="display: none"]');
      console.log(`Found ${containers.length} potential hidden containers`);
      
      let successfulInteraction = false;
      
      // Try to interact with controls in each container
      containers.forEach((container, index) => {
        if (successfulInteraction || !(container instanceof HTMLElement)) return;
        
        console.log(`Attempting to make container ${index + 1} visible`);
        
        // Store original style
        const originalStyle = container.style.cssText;
        
        // Make fully visible on screen temporarily to ensure clicks register properly
        container.style.cssText = 'opacity: 1 !important; height: auto !important; overflow: visible !important; position: fixed !important; top: 10px !important; left: 10px !important; z-index: 9999 !important; border: 5px solid red !important; background: white !important;';
        // Add a special class to track what we've temporarily exposed
        container.classList.add('lk-temp-exposed');
        
        // Check for LiveKit components
        const liveKitElements = container.querySelectorAll('[class^="lk-"]');
        console.log(`Container ${index + 1} has ${liveKitElements.length} LiveKit elements`);
        
        if (liveKitElements.length > 0) {
          console.log('Found LiveKit elements in this container:', 
            Array.from(liveKitElements).map(el => el.className).join(', '));
        }
        
        try {
          // Execute callback with controls visible
          callback();
          
          // Check if we found the buttons we need
          const hasAudioControls = container.querySelector('.lk-microphone-button, .lk-device-button, .lk-audio-settings-button');
          if (hasAudioControls) {
            console.log(`Found audio controls in container ${index + 1}!`);
            successfulInteraction = true;
          }
        } finally {
          // Restore original style after a longer delay to ensure click events complete
          setTimeout(() => {
            if (container) {
              container.style.cssText = originalStyle;
              container.classList.remove('lk-temp-exposed');
              console.log(`Restored container ${index + 1} to original style`);
            }
          }, 3000); // Even longer delay to ensure everything completes
        }
      });
      
      // If we didn't find what we need, try the callback directly
      if (!successfulInteraction) {
        console.log('No successful interaction with hidden controls, trying direct callback');
        callback();
      }
    };
    
    // Find the device menu and device selection controls in the hidden LiveKit components
    withVisibleControls(() => {
      // Try different selectors for the device button - the LiveKit components might use different classes
      const selectors = [
        '.lk-device-button',
        '.lk-microphone-button',
        '.lk-voice-assistant-button',
        '.lk-audio-settings-button',
        '.lk-microphone-selector',
        '.lk-audio-selector',
        'button[aria-label*="microphone"]',
        'button[aria-label*="audio"]',
        'button[aria-label*="device"]'
      ];
      
      // Try each selector to find the device button
      let deviceButton: HTMLElement | null = null;
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element instanceof HTMLElement) {
          console.log(`Found device button with selector: ${selector}`);
          deviceButton = element;
          break;
        }
      }
      
      // If we found a button, click it only once and wait longer for menu
      if (deviceButton) {
        console.log("Clicking device button to open menu");
        deviceButton.click();
        
        // After opening the menu, wait longer for it to render
        setTimeout(() => {
          console.log("Looking for device menu items");
          
          // Try different selectors for the device items
          const itemSelectors = [
            '.lk-device-menu .lk-list-item',
            '.lk-device-menu li',
            '.lk-device-list .lk-device-item',
            '.lk-menu-item',
            '[data-device-id]',
            'li[role="option"]',
            'div[role="menuitem"]',
            '.lk-menu-container li'
          ];
          
          // Find all possible device items
          let deviceItems: NodeListOf<Element> | null = null;
          for (const selector of itemSelectors) {
            const items = document.querySelectorAll(selector);
            if (items.length > 0) {
              console.log(`Found ${items.length} device items with selector: ${selector}`);
              deviceItems = items;
              break;
            }
          }
          
          if (deviceItems && deviceItems.length > 0) {
            console.log(`Found ${deviceItems.length} device options`);
            
            // Debug all menu items to see their content
            deviceItems.forEach((item, index) => {
              if (item instanceof HTMLElement) {
                console.log(`Device option ${index + 1}:`, {
                  text: item.textContent?.trim(),
                  html: item.innerHTML,
                  classes: item.className
                });
              }
            });
            
            // First try to match by device label (more reliable than ID)
            let foundDevice = false;
            
            if (deviceLabel) {
              console.log("Searching for device with label:", deviceLabel);
              // Look for exact match first
              deviceItems.forEach((item, index) => {
                if (foundDevice) return;
                
                if (item instanceof HTMLElement) {
                  const itemText = item.textContent?.trim().toLowerCase() || '';
                  console.log(`Device option ${index} text:`, itemText);
                  
                  // Try exact match first (case insensitive)
                  if (itemText === deviceLabel.toLowerCase()) {
                    console.log("Found EXACT match for device:", itemText);
                    item.click();
                    foundDevice = true;
                    return;
                  }
                }
              });
              
              // If no exact match, look for the specific device we want by key terms
              if (!foundDevice) {
                const isLookingForMacbook = deviceLabel.toLowerCase().includes('macbook') || 
                                          deviceLabel.toLowerCase().includes('built-in');
                
                if (isLookingForMacbook) {
                  console.log("Looking specifically for MacBook/Built-in microphone");
                  deviceItems.forEach((item, index) => {
                    if (foundDevice) return;
                    
                    if (item instanceof HTMLElement) {
                      const itemText = item.textContent?.trim().toLowerCase() || '';
                      
                      // For MacBook, we want a stricter match
                      if ((itemText.includes('macbook') && itemText.includes('built-in')) ||
                          itemText.includes('macbook air microphone')) {
                        console.log("Found MacBook built-in microphone:", itemText);
                        item.click();
                        foundDevice = true;
                        return;
                      }
                    }
                  });
                }
                
                // More generic matching as fallback
                if (!foundDevice) {
                  deviceItems.forEach((item) => {
                    if (foundDevice) return;
                    
                    if (item instanceof HTMLElement) {
                      const itemText = item.textContent?.trim().toLowerCase() || '';
                      console.log("Checking menu item text:", itemText);
                      
                      // Try to match key portions of the device label
                      const labelParts = deviceLabel.toLowerCase().split(' ');
                      const significantParts = labelParts.filter(part => part.length > 3 && 
                                                               !['the', 'and', 'for', 'with'].includes(part));
                      
                      // Calculate how many significant parts match
                      const matchingParts = significantParts.filter(part => itemText.includes(part));
                      const matchScore = matchingParts.length / significantParts.length;
                      
                      // Require higher match score and avoid matching default if we're looking for something specific
                      const isDefaultDevice = itemText.includes('default');
                      const isGoodMatch = matchScore > 0.5;
                      
                      if (isGoodMatch && (!isDefaultDevice || deviceLabel.toLowerCase().includes('default'))) {
                        console.log(`Found matching device by partial match (score: ${matchScore}):`, itemText);
                        item.click();
                        foundDevice = true;
                        return;
                      }
                    }
                  });
                }
              }
            }
            
            // If we still haven't found a match and we're looking for MacBook, 
            // try to find the element at the known position
            if (!foundDevice && deviceLabel && 
                (deviceLabel.toLowerCase().includes('macbook') || 
                 deviceLabel.toLowerCase().includes('built-in'))) {
              
              console.log("Trying direct selection of the MacBook option (3rd item)");
              // Your logs show the MacBook is the 3rd item (index 2)
              if (deviceItems.length >= 3 && deviceItems[2] instanceof HTMLElement) {
                console.log("Directly selecting MacBook Air item (3rd in list)");
                (deviceItems[2] as HTMLElement).click();
                foundDevice = true;
              }
            }
          } else {
            console.log("No device items found in menu");
          }
        }, 500); // Give more time for the menu to open
      } else {
        console.error("Could not find any device button in LiveKit controls");
        
        // Fallback to find any input device menu we can interact with
        const allButtons = document.querySelectorAll('button');
        console.log(`Found ${allButtons.length} buttons total, searching for likely audio buttons`);
        
        for (const button of allButtons) {
          const text = button.textContent?.toLowerCase() || '';
          const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
          
          if (text.includes('mic') || text.includes('audio') || text.includes('device') ||
              ariaLabel.includes('mic') || ariaLabel.includes('audio') || ariaLabel.includes('device')) {
            console.log("Found potential audio button by text/aria-label, attempting to click");
            button.click();
            break;
          }
        }
      }
    });
  }, []);

  // Don't automatically connect to livekit
  const handleConnect = useCallback(() => {
    setIsConnected(true);
  }, []);

  // Create context value for device switching
  const contextValue = useMemo(() => ({
    onSwitchDevice: switchAudioDevice
  }), [switchAudioDevice]);

  return (
    <DashboardContent
      maxWidth={false}
      sx={{display: 'flex', flex: '1 1 auto', flexDirection: 'column', padding: 0}}
      id="root"
    >
      <MealPlanningRoomContext.Provider value={contextValue}>
        <LiveKitRoom
          room={room}
          serverUrl={livekitUrl}
          token={livekitToken}
          connect={isConnected}
          audio={{
            deviceId: preferredDeviceId || undefined,
          }}
          style={{display: "contents"}}
        >
          <Box sx={{
            m: 3, 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'center', 
            alignItems: 'center',
            gap: 3
          }}>
            <MealPlanningVoiceAssistant/>
          </Box>

          <Layout
            sx={{
              minHeight: 0,
              flex: '1 1 0',
              borderTopLeftRadius: 32,
              borderTopRightRadius: 32,
              position: 'relative',
              bgcolor: 'background.paper',
              boxShadow: (theme) => theme.customShadows.card,
            }}
            slots={{
              main: (
                <>
                  <MealPlanningRoomContent 
                    onConnect={handleConnect}
                    onOpenIngredientList={() => setOpenIngredientList(true)}
                    onOpenShoppingList={() => setOpenShoppingList(true)}
                    onOpenNutritionInfo={() => setOpenNutritionInfo(true)}
                    onOpenSavedMealPlans={() => setOpenSavedMealPlans(true)}
                    onOpenMealPlanInput={() => setOpenMealPlanInput(true)}
                    onGenerateMealPlan={handleGenerateMealPlan}
                    loading={loading}
                    error={error}
                    currentMealPlan={currentMealPlan}
                    setCurrentMealPlan={setCurrentMealPlan}
                    onSwitchDevice={switchAudioDevice}
                    preferredDeviceId={preferredDeviceId}
                  />
                </>
              ),
            }}
          />
        </LiveKitRoom>
      </MealPlanningRoomContext.Provider>
      {/* Sheet components */}
      <Box sx={{ width: '50%', maxWidth: { sm: 600 }, mx: 'auto'}}>
        <MealPlanInputSheet isOpen={openMealPlanInput} onClose={() => setOpenMealPlanInput(false)} onSubmit={handleGenerateMealPlan} loading={loading} />
        <MealIngredientList isOpen={openIngredientList} onClose={() => setOpenIngredientList(false)} mealPlan={currentMealPlan} />
        <MealShoppingList isOpen={openShoppingList} onClose={() => setOpenShoppingList(false)} mealPlan={currentMealPlan} />
        <MealNutritionInfo isOpen={openNutritionInfo} onClose={() => setOpenNutritionInfo(false)} mealPlan={currentMealPlan} />
        <SavedMealPlans isOpen={openSavedMealPlans} onClose={() => setOpenSavedMealPlans(false)} />
      </Box>
    </DashboardContent>
  );
}

function MealPlanningVoiceAssistant() {
  const {state, audioTrack} = useVoiceAssistant();
  const theme = useTheme();

  const GlobalStyles = createGlobalStyle`
  html {
    --lk-va-bar-bg: ${theme.palette.primary.light};
    --lk-fg: ${theme.palette.primary.main};
  }
`;

  return (
    <>
      <GlobalStyles />
      {["disconnected", "connecting", "initializing"].includes(state) && 
        <AnimateLogo2 animate={false} size={70}/>}
      {["listening", "thinking", "speaking"].includes(state) && <AnimateLogo1 animate size={70}/>}
      <BarVisualizer state={state} barCount={7} trackRef={audioTrack!} style={{height: "100px"}}/>
    </>
  );
}

interface MealPlanningRoomContentProps {
  onConnect: () => void;
  onOpenIngredientList: () => void;
  onOpenShoppingList: () => void;
  onOpenNutritionInfo: () => void;
  onOpenSavedMealPlans: () => void;
  onOpenMealPlanInput: () => void;
  onGenerateMealPlan: (input: { description: string; imageUrl?: string; videoUrl?: string; imageFiles?: File[] }) => void;
  loading: boolean;
  error: string | null;
  currentMealPlan: any;
  setCurrentMealPlan: (mealPlan: any) => void;
  onSwitchDevice: (deviceId: string, label?: string) => void;
  preferredDeviceId: string;
}

function CustomVoiceControls() {
  const { state, audioTrack } = useVoiceAssistant();
  const theme = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [canPlayAudio, setCanPlayAudio] = useState(true);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<MediaDeviceInfo | null>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const connectionState = useConnectionState();
  
  // Keep track of the voice state with friendly labels
  const statusText = 
    state === 'listening' ? 'Listening...' : 
    state === 'speaking' ? 'Speaking...' : 
    state === 'thinking' ? 'Thinking...' : 'Voice Ready';
  
  // Use colors that match the state
  const statusColor = 
    state === 'listening' ? theme.palette.primary.main : 
    state === 'speaking' ? theme.palette.secondary.main : 
    state === 'thinking' ? theme.palette.warning.main : 
    theme.palette.text.primary;

  // Check if there is an active state to show the indicator
  const showIndicator = state === 'listening' || state === 'speaking' || state === 'thinking';

  // Direct access to the track to get device info
  const getTrackDeviceInfo = useCallback(() => {
    if (!audioTrack?.publication?.track) return null;
    
    try {
      // Cast to MediaStreamTrack to access getSettings
      const mediaTrack = audioTrack.publication.track as any;
      if (typeof mediaTrack.getSettings === 'function') {
        const settings = mediaTrack.getSettings();
        return settings;
      }
    } catch (err) {
      console.error('Error accessing track settings:', err);
    }
    return null;
  }, [audioTrack]);

  // Refresh current device with multiple detection methods
  const refreshDeviceList = useCallback(async () => {
    try {
      // Get current device info
      const trackSettings = getTrackDeviceInfo();
      const currentDeviceId = trackSettings?.deviceId || '';
      console.log("Current track device ID:", currentDeviceId);
      
      // Get all devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(device => device.kind === 'audioinput');
      console.log("Available audio inputs:", audioInputs);
      setAudioDevices(audioInputs);
      
      // Also check LiveKit's hidden device menu for the current selection
      const selectedDeviceElement = document.querySelector('.lk-list-item.selected, .lk-list-item[aria-selected="true"]');
      let livekitSelectedId = '';
      
      if (selectedDeviceElement instanceof HTMLElement) {
        livekitSelectedId = selectedDeviceElement.getAttribute('data-device-id') || '';
        console.log("LiveKit selected device ID:", livekitSelectedId);
      }
      
      // Set selected device with priority: livekit selection > track device > first device
      const deviceIdToUse = livekitSelectedId || currentDeviceId;
      
      if (deviceIdToUse) {
        const matchedDevice = audioInputs.find(d => d.deviceId === deviceIdToUse);
        if (matchedDevice) {
          console.log("Setting selected device to:", matchedDevice.label || matchedDevice.deviceId);
          setSelectedDevice(matchedDevice);
        } else if (audioInputs.length > 0) {
          console.log("Device ID not found in available devices, using first device");
          setSelectedDevice(audioInputs[0]);
        }
      } else if (audioInputs.length > 0) {
        console.log("No current device detected, using first device");
        setSelectedDevice(audioInputs[0]);
      }
    } catch (err) {
      console.error('Error refreshing devices:', err);
    }
  }, [getTrackDeviceInfo]);

  // Load available audio devices
  useEffect(() => {
    const getDevices = async () => {
      try {
        // Request microphone access to ensure we get device labels
        await navigator.mediaDevices.getUserMedia({ audio: true });
        await refreshDeviceList();
      } catch (err) {
        console.error('Error accessing media devices:', err);
      }
    };
    
    if (connectionState === ConnectionState.Connected) {
      getDevices();
    }
  }, [connectionState, refreshDeviceList]);

  // Find parent context that provides device switching
  const parentContext = useContext(MealPlanningRoomContext);
  
  // Handle device selection through parent context
  const selectDevice = useCallback((device: MediaDeviceInfo) => {
    console.log('Selecting device:', device.label || device.deviceId);
    setSelectedDevice(device);
    setIsMenuOpen(false);
    
    // Use the parent's switchAudioDevice function (facade pattern)
    if (parentContext && parentContext.onSwitchDevice) {
      console.log('Calling parent context switchAudioDevice with deviceId:', device.deviceId, 'and label:', device.label);
      
      // Update the MealPlanningRoomContext type to accept a label parameter
      // @ts-ignore - We're adding the label parameter even though it's not in the type
      parentContext.onSwitchDevice(device.deviceId, device.label);
      
      // Double check after a moment that the device was actually selected
      setTimeout(() => {
        refreshDeviceList();
      }, 1000);
    } else {
      console.error('Missing parent context for device switching');
    }
  }, [parentContext, refreshDeviceList]);
  
  // Handle opening the device menu
  const handleDeviceSelection = useCallback(() => {
    if (!isMenuOpen) {
      refreshDeviceList();
    }
    setIsMenuOpen(!isMenuOpen);
  }, [isMenuOpen, refreshDeviceList]);

  // Add a reference to the hidden controls container
  const hiddenControlsRef = React.useRef<HTMLDivElement>(null);
  
  // Helper function to temporarily make hidden controls visible for interaction
  const withVisibleControls = useCallback((callback: () => void) => {
    if (hiddenControlsRef.current) {
      console.log('Making hidden controls visible for interaction');
      // Temporarily make controls visible but off-screen
      const originalStyle = hiddenControlsRef.current.style.cssText;
      hiddenControlsRef.current.style.cssText = 'opacity: 1 !important; height: auto !important; overflow: visible !important; position: fixed !important; top: 10px !important; left: 10px !important; z-index: 9999 !important; border: 5px solid blue !important; background: white !important;';
      hiddenControlsRef.current.classList.add('lk-temp-exposed');
      
      try {
        // Execute the callback while controls are visible
        callback();
        
        // Log any LiveKit elements we found
        const liveKitElements = hiddenControlsRef.current.querySelectorAll('[class^="lk-"]');
        console.log(`Found ${liveKitElements.length} LiveKit elements in hidden controls`);
        if (liveKitElements.length > 0) {
          console.log('LiveKit elements found:', 
            Array.from(liveKitElements).map(el => el.className).join(', '));
        }
      } finally {
        // Restore original style
        setTimeout(() => {
          if (hiddenControlsRef.current) {
            console.log('Restoring hidden controls to original style');
            hiddenControlsRef.current.style.cssText = originalStyle;
            hiddenControlsRef.current.classList.remove('lk-temp-exposed');
          }
        }, 3000); // Longer delay to ensure click handlers have time to execute
      }
    } else {
      console.error('Hidden controls reference not available');
      callback();
    }
  }, []);

  // Handle disconnect button through LiveKit's UI
  const handleDisconnect = useCallback(() => {
    withVisibleControls(() => {
      const disconnectButton = document.querySelector('.lk-disconnect-button');
      if (disconnectButton && disconnectButton instanceof HTMLButtonElement) {
        disconnectButton.click();
      }
    });
  }, [withVisibleControls]);

  // Handle audio start for browser autoplay policies
  const handleStartAudio = useCallback(() => {
    withVisibleControls(() => {
      const startAudioButton = document.querySelector('.lk-start-audio-button');
      if (startAudioButton && startAudioButton instanceof HTMLButtonElement) {
        startAudioButton.click();
        setCanPlayAudio(true);
      }
    });
  }, [withVisibleControls]);

  // Handle mic toggle through LiveKit's UI
  const handleMicToggle = useCallback(() => {
    setIsMicEnabled(prev => !prev);
    withVisibleControls(() => {
      const micToggleButton = document.querySelector('.lk-microphone-button');
      if (micToggleButton && micToggleButton instanceof HTMLButtonElement) {
        micToggleButton.click();
      }
    });
  }, [withVisibleControls]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && 
          buttonRef.current && 
          !menuRef.current.contains(event.target as Node) && 
          !buttonRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Check if audio playback is blocked
  useEffect(() => {
    const startAudioButton = document.querySelector('.lk-start-audio-button');
    const isVisible = startAudioButton && 
      window.getComputedStyle(startAudioButton).display !== 'none';
    
    setCanPlayAudio(!isVisible);
  }, [state]);

  return (
    <Box sx={{ 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', 
      justifyContent: 'center',
      gap: 2,
      width: '100%'
    }}>
      <Box sx={{
        display: 'flex',
        gap: 2,
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        {/* Enhanced control panel */}
        <Box sx={{ 
          border: '1px solid',
          borderColor: 'primary.main',
          borderRadius: 1,
          py: 1.5, 
          px: 3,
          minWidth: '180px',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: theme.palette.background.paper,
          boxShadow: showIndicator ? `0 0 10px ${statusColor}` : 'none',
          transition: 'all 0.3s ease'
        }}>
          {/* Status text */}
          <Box sx={{ 
            color: statusColor,
            fontWeight: showIndicator ? 'bold' : 'normal',
            display: 'flex',
            alignItems: 'center',
            flex: 1,
            justifyContent: 'center'
          }}>
            {statusText}
          </Box>
          
          {/* Audio visualizer for microphone */}
          {audioTrack && (
            <Box sx={{ 
              position: 'absolute',
              bottom: 0,
              left: 0,
              width: '100%',
              height: '4px',
              overflow: 'hidden'
            }}>
              <BarVisualizer 
                trackRef={audioTrack} 
                barCount={14}
                options={{
                  minHeight: 2,
                  maxHeight: 4,
                }}
                style={{
                  width: '100%',
                  height: '100%',
                  opacity: state === 'listening' ? 1 : 0.5
                }}
              />
            </Box>
          )}
        </Box>

        {/* Audio device selection button with improved dropdown */}
        <Box sx={{ position: 'relative' }}>
          <Button
            ref={buttonRef}
            variant="outlined"
            color="primary"
            onClick={handleDeviceSelection}
            sx={{ 
              py: 1.5, 
              px: 1.5,
              minWidth: 'auto',
              borderColor: 'primary.main',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.04)',
              }
            }}
            aria-expanded={isMenuOpen}
            aria-label="Select audio device"
          >
            <Box component="span" className="iconify" sx={{ 
              display: 'inline-block', 
              width: 16, 
              height: 16, 
              backgroundSize: 'contain', 
              backgroundImage: 'url("https://api.iconify.design/mdi:microphone.svg")', 
              backgroundRepeat: 'no-repeat' 
            }}/>
          </Button>
          
          {/* Custom device selection menu with smooth animations */}
          {isMenuOpen && (
            <Box
              ref={menuRef}
              sx={{
                position: 'absolute',
                top: '100%',
                right: 0,
                mt: 1,
                width: 280,
                maxHeight: 400,
                overflowY: 'auto',
                bgcolor: 'background.paper',
                boxShadow: theme.shadows[8],
                borderRadius: 1,
                zIndex: 1300,
                p: 1,
                animation: 'fadeIn 0.2s ease-in-out',
                '@keyframes fadeIn': {
                  from: { opacity: 0, transform: 'translateY(-10px)' },
                  to: { opacity: 1, transform: 'translateY(0)' }
                }
              }}
            >
              <Box sx={{ 
                typography: 'subtitle2', 
                p: 1.5, 
                borderBottom: 1, 
                borderColor: 'divider',
                mb: 1,
                display: 'flex',
                flexDirection: 'column',
                gap: 0.5
              }}>
                <Box>Audio Devices</Box>
                {selectedDevice && (
                  <Box sx={{ 
                    typography: 'caption', 
                    color: 'text.secondary',
                    maxWidth: '100%',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    Current: {selectedDevice.label || 'Unknown Device'}
                  </Box>
                )}
              </Box>
              
              {audioDevices.length > 0 ? (
                <Box component="ul" sx={{ 
                  listStyle: 'none', 
                  p: 0, 
                  m: 0 
                }}>
                  {audioDevices.map((device) => (
                    <Box 
                      component="li" 
                      key={device.deviceId}
                      sx={{
                        my: 0.5,
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <Button 
                        fullWidth
                        size="small"
                        variant={selectedDevice?.deviceId === device.deviceId ? "contained" : "text"}
                        onClick={() => selectDevice(device)}
                        sx={{ 
                          justifyContent: 'flex-start',
                          textAlign: 'left',
                          py: 1,
                          px: 2,
                          borderRadius: 1,
                          transition: 'all 0.2s ease',
                          overflow: 'hidden',
                          backgroundColor: selectedDevice?.deviceId === device.deviceId 
                            ? 'primary.light' 
                            : 'transparent',
                          '&:hover': {
                            backgroundColor: selectedDevice?.deviceId === device.deviceId 
                              ? 'primary.light' 
                              : 'action.hover',
                          },
                        }}
                      >
                        <Box sx={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          width: '100%',
                          overflow: 'hidden'
                        }}>
                          <Box component="span" sx={{ 
                            display: 'inline-flex',
                            mr: 1.5,
                            color: selectedDevice?.deviceId === device.deviceId ? 'primary.contrastText' : 'primary.main'
                          }}>
                            <Box component="span" className="iconify" sx={{ 
                              display: 'inline-block', 
                              width: 16, 
                              height: 16, 
                              backgroundSize: 'contain', 
                              backgroundImage: selectedDevice?.deviceId === device.deviceId
                                ? 'url("https://api.iconify.design/mdi:microphone.svg")' 
                                : 'url("https://api.iconify.design/mdi:microphone-outline.svg")', 
                              backgroundRepeat: 'no-repeat',
                              filter: selectedDevice?.deviceId === device.deviceId ? 'brightness(10)' : 'none'
                            }}/>
                          </Box>
                          <Box sx={{ 
                            flexGrow: 1, 
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            fontSize: '0.875rem',
                            color: selectedDevice?.deviceId === device.deviceId ? 'primary.contrastText' : 'text.primary'
                          }}>
                            {device.label || `Microphone (${device.deviceId.slice(0, 5)}...)`}
                          </Box>
                        </Box>
                      </Button>
                    </Box>
                  ))}
                </Box>
              ) : (
                <Box sx={{ 
                  p: 2, 
                  typography: 'body2', 
                  color: 'text.secondary',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  gap: 1
                }}>
                  <Box component="span" className="iconify" sx={{ 
                    display: 'inline-block', 
                    width: 24, 
                    height: 24, 
                    opacity: 0.6,
                    backgroundSize: 'contain', 
                    backgroundImage: 'url("https://api.iconify.design/mdi:microphone-off.svg")', 
                    backgroundRepeat: 'no-repeat' 
                  }}/>
                  No audio devices found
                </Box>
              )}
            </Box>
          )}
        </Box>

        {/* Disconnect button */}
        <Button
          variant="outlined"
          color="primary"
          onClick={handleDisconnect}
          sx={{ 
            py: 1.5, 
            px: 1.5,
            minWidth: 'auto',
            borderColor: 'primary.main',
            '&:hover': {
              backgroundColor: 'rgba(255, 0, 0, 0.04)',
              borderColor: 'error.main',
              color: 'error.main'
            }
          }}
        >
          <Box component="span" className="iconify" sx={{ 
            display: 'inline-block', 
            width: 16, 
            height: 16, 
            backgroundSize: 'contain', 
            backgroundImage: 'url("https://api.iconify.design/mdi:phone-hangup.svg")', 
            backgroundRepeat: 'no-repeat' 
          }}/>
        </Button>
      </Box>
      
      {/* Audio start button (only shows when needed) */}
      {!canPlayAudio && (
        <Button
          variant="outlined"
          color="warning"
          size="small"
          onClick={handleStartAudio}
          sx={{ 
            mt: 1,
            animation: 'pulse 1.5s infinite ease-in-out',
            '@keyframes pulse': {
              '0%': { boxShadow: '0 0 0 0 rgba(255, 152, 0, 0.4)' },
              '70%': { boxShadow: '0 0 0 10px rgba(255, 152, 0, 0)' },
              '100%': { boxShadow: '0 0 0 0 rgba(255, 152, 0, 0)' }
            }
          }}
        >
          Enable Audio
        </Button>
      )}
      
      {/* Make VoiceAssistantControlBar visible */}
      <Box 
        sx={{ 
          width: '100%', 
          mt: 2, 
          p: 1, 
          border: '1px dashed',
          borderColor: 'primary.light',
          borderRadius: 1,
          backgroundColor: 'background.paper'
        }}
      >
        <VoiceAssistantControlBar />
      </Box>
      
      {/* Keep other components hidden */}
      <Box 
        ref={hiddenControlsRef}
        sx={{ opacity: 0, height: 0, overflow: 'hidden', position: 'absolute' }}
      >
        <RoomAudioRenderer />
        <StartAudio label="Click to allow audio playback" />
      </Box>
    </Box>
  );
}

function MealPlanningRoomContent({
  onConnect,
  onOpenIngredientList,
  onOpenShoppingList,
  onOpenNutritionInfo,
  onOpenSavedMealPlans,
  onOpenMealPlanInput,
  onGenerateMealPlan,
  loading,
  error,
  currentMealPlan,
  setCurrentMealPlan,
  onSwitchDevice,
  preferredDeviceId
}: MealPlanningRoomContentProps) {
  const theme = useTheme();
  const connectionState = useConnectionState();
  const isDisconnected = connectionState === ConnectionState.Disconnected;

  // Remove the automatic connection effect
  // useEffect(() => {
  //   if (connectionState === ConnectionState.Disconnected) {
  //     onConnect();
  //   }
  // }, [connectionState, onConnect]);

  return (
    <Box sx={{ p: 3 }}>
      {/* Fixed height container to prevent layout shifts */}
      <Box sx={{
        position: "relative",
        height: 120,
        mb: 3,
        width: "100%",
      }}>
        {/* Absolute positioned content to prevent shifts */}
        <Box sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
        }}>
          {isDisconnected ? (
            <Button 
              color="primary" 
              variant="outlined" 
              onClick={onConnect}
              sx={{ py: 1.5, minWidth: '180px' }}
            >
              Connect
            </Button>
          ) : (
            <CustomVoiceControls />
          )}
        </Box>
      </Box>

      {!currentMealPlan ? (
        <Box>
          <Box sx={{
            p: 3,
            display: "flex", 
            flexWrap: "wrap",
            gap: 2,
            justifyContent: "center",
            maxWidth: 600,
            mx: "auto"
          }}>
            {/* Primary action button */}
            <Button 
              variant="contained" 
              color="primary"
              onClick={onOpenMealPlanInput}
              startIcon={<Box component="span" className="iconify" sx={{ display: 'inline-block', width: 16, height: 16, backgroundSize: 'contain', backgroundImage: 'url("https://api.iconify.design/mdi:food-fork-drink.svg")', backgroundRepeat: 'no-repeat' }}/>}
            >
              Create Meal Plan
            </Button>
            
            <Button 
              variant="outlined" 
              onClick={onOpenSavedMealPlans}
              startIcon={<Box component="span" className="iconify" sx={{ display: 'inline-block', width: 16, height: 16, backgroundSize: 'contain', backgroundImage: 'url("https://api.iconify.design/mdi:content-save-outline.svg")', backgroundRepeat: 'no-repeat' }}/>}
            >
              Saved Meal Plans
            </Button>
            
            <Button 
              variant="outlined" 
              onClick={onOpenIngredientList}
              startIcon={<Box component="span" className="iconify" sx={{ display: 'inline-block', width: 16, height: 16, backgroundSize: 'contain', backgroundImage: 'url("https://api.iconify.design/mdi:food-apple-outline.svg")', backgroundRepeat: 'no-repeat' }}/>}
              disabled={!currentMealPlan}
            >
              Weekly Ingredients
            </Button>
            
            <Button 
              variant="outlined" 
              onClick={onOpenShoppingList}
              startIcon={<Box component="span" className="iconify" sx={{ display: 'inline-block', width: 16, height: 16, backgroundSize: 'contain', backgroundImage: 'url("https://api.iconify.design/mdi:cart-outline.svg")', backgroundRepeat: 'no-repeat' }}/>}
              disabled={!currentMealPlan}
            >
              Shopping List
            </Button>
            
            <Button 
              variant="outlined" 
              onClick={onOpenNutritionInfo}
              startIcon={<Box component="span" className="iconify" sx={{ display: 'inline-block', width: 16, height: 16, backgroundSize: 'contain', backgroundImage: 'url("https://api.iconify.design/mdi:nutrition.svg")', backgroundRepeat: 'no-repeat' }}/>}
              disabled={!currentMealPlan}
            >
              Nutritional Analysis
            </Button>
          </Box>
        </Box>
      ) : (
        <>
          <Box sx={{
            p: 3,
            display: "flex", 
            flexWrap: "wrap",
            gap: 2,
            justifyContent: "center",
            maxWidth: 600,
            mx: "auto"
          }}>
            {/* Primary action button */}
            <Button 
              variant="contained" 
              color="secondary"
              onClick={() => setCurrentMealPlan(null)}
              startIcon={<Box component="span" className="iconify" sx={{ display: 'inline-block', width: 16, height: 16, backgroundSize: 'contain', backgroundImage: 'url("https://api.iconify.design/mdi:refresh.svg")', backgroundRepeat: 'no-repeat' }}/>}
            >
              Create New Plan
            </Button>
            
            <Button 
              variant="outlined" 
              onClick={onOpenIngredientList}
              startIcon={<Box component="span" className="iconify" sx={{ display: 'inline-block', width: 16, height: 16, backgroundSize: 'contain', backgroundImage: 'url("https://api.iconify.design/mdi:food-apple-outline.svg")', backgroundRepeat: 'no-repeat' }}/>}
            >
              Weekly Ingredients
            </Button>
            
            <Button 
              variant="outlined" 
              onClick={onOpenShoppingList}
              startIcon={<Box component="span" className="iconify" sx={{ display: 'inline-block', width: 16, height: 16, backgroundSize: 'contain', backgroundImage: 'url("https://api.iconify.design/mdi:cart-outline.svg")', backgroundRepeat: 'no-repeat' }}/>}
            >
              Shopping List
            </Button>
            
            <Button 
              variant="outlined" 
              onClick={onOpenNutritionInfo}
              startIcon={<Box component="span" className="iconify" sx={{ display: 'inline-block', width: 16, height: 16, backgroundSize: 'contain', backgroundImage: 'url("https://api.iconify.design/mdi:nutrition.svg")', backgroundRepeat: 'no-repeat' }}/>}
            >
              Nutritional Analysis
            </Button>
            
            <Button 
              variant="outlined" 
              onClick={onOpenSavedMealPlans}
              startIcon={<Box component="span" className="iconify" sx={{ display: 'inline-block', width: 16, height: 16, backgroundSize: 'contain', backgroundImage: 'url("https://api.iconify.design/mdi:content-save-outline.svg")', backgroundRepeat: 'no-repeat' }}/>}
            >
              Saved Meal Plans
            </Button>
          </Box>
          
          <MealPlanWeeklyView 
            mealPlan={currentMealPlan} 
          />
        </>
      )}
    </Box>
  );
}

// Meal planning modal components
interface MealSheetProps {
  isOpen: boolean;
  onClose: () => void;
  mealPlan?: any;
}

function MealIngredientList({ isOpen, onClose, mealPlan }: MealSheetProps) {
  const theme = useTheme();

  return (
    <Sheet isOpen={isOpen} onClose={() => onClose()} tweenConfig={{ ease: 'easeOut', duration: 0.4 }}>
      <Sheet.Backdrop>
        <Sheet.Container style={{backgroundColor: `${theme.palette.background.default}`}}>
          <Sheet.Header/>
          <Sheet.Content>
            <Sheet.Scroller draggableAt="top">
              <Box sx={{ p: 3 }}>
                <Box sx={{ typography: 'h5', mb: 3 }}>Weekly Ingredients</Box>
                {mealPlan ? (
                  <Box sx={{ typography: 'body1' }}>
                    Here you would display a complete list of ingredients for the meal plan.
                  </Box>
                ) : (
                  <Box sx={{ typography: 'body1', color: 'text.secondary' }}>
                    No meal plan has been created yet.
                  </Box>
                )}
              </Box>
            </Sheet.Scroller>
          </Sheet.Content>
        </Sheet.Container>
      </Sheet.Backdrop>
    </Sheet>
  );
}

function MealShoppingList({ isOpen, onClose, mealPlan }: MealSheetProps) {
  const theme = useTheme();

  return (
    <Sheet isOpen={isOpen} onClose={() => onClose()} tweenConfig={{ ease: 'easeOut', duration: 0.4 }}>
      <Sheet.Backdrop>
        <Sheet.Container style={{backgroundColor: `${theme.palette.background.default}`}}>
          <Sheet.Header/>
          <Sheet.Content>
            <Sheet.Scroller draggableAt="top">
              <Box sx={{ p: 3 }}>
                <Box sx={{ typography: 'h5', mb: 3 }}>Shopping List</Box>
                {mealPlan ? (
                  <Box sx={{ typography: 'body1' }}>
                    Here you would display a consolidated shopping list for the week.
                  </Box>
                ) : (
                  <Box sx={{ typography: 'body1', color: 'text.secondary' }}>
                    No meal plan has been created yet.
                  </Box>
                )}
              </Box>
            </Sheet.Scroller>
          </Sheet.Content>
        </Sheet.Container>
      </Sheet.Backdrop>
    </Sheet>
  );
}

function MealNutritionInfo({ isOpen, onClose, mealPlan }: MealSheetProps) {
  const theme = useTheme();

  return (
    <Sheet isOpen={isOpen} onClose={() => onClose()} tweenConfig={{ ease: 'easeOut', duration: 0.4 }}>
      <Sheet.Backdrop>
        <Sheet.Container style={{backgroundColor: `${theme.palette.background.default}`}}>
          <Sheet.Header/>
          <Sheet.Content>
            <Sheet.Scroller draggableAt="top">
              <Box sx={{ p: 3 }}>
                <Box sx={{ typography: 'h5', mb: 3 }}>Nutritional Analysis</Box>
                {mealPlan ? (
                  <Box sx={{ typography: 'body1' }}>
                    Here you would display nutrition information for the meal plan.
                  </Box>
                ) : (
                  <Box sx={{ typography: 'body1', color: 'text.secondary' }}>
                    No meal plan has been created yet.
                  </Box>
                )}
              </Box>
            </Sheet.Scroller>
          </Sheet.Content>
        </Sheet.Container>
      </Sheet.Backdrop>
    </Sheet>
  );
}

function SavedMealPlans({ isOpen, onClose }: Omit<MealSheetProps, 'mealPlan'>) {
  const theme = useTheme();

  return (
    <Sheet isOpen={isOpen} onClose={() => onClose()} tweenConfig={{ ease: 'easeOut', duration: 0.4 }}>
      <Sheet.Backdrop>
        <Sheet.Container style={{backgroundColor: `${theme.palette.background.default}`}}>
          <Sheet.Header/>
          <Sheet.Content>
            <Sheet.Scroller draggableAt="top">
              <Box sx={{ p: 3 }}>
                <Box sx={{ typography: 'h5', mb: 3 }}>Saved Meal Plans</Box>
                <Box sx={{ typography: 'body1' }}>
                  Here you would display the user's saved meal plans.
                </Box>
              </Box>
            </Sheet.Scroller>
          </Sheet.Content>
        </Sheet.Container>
      </Sheet.Backdrop>
    </Sheet>
  );
}

// Add the new MealPlanInputSheet component
interface MealPlanInputSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (input: { description: string; imageUrl?: string; videoUrl?: string; imageFiles?: File[] }) => void;
  loading: boolean;
}

function MealPlanInputSheet({ isOpen, onClose, onSubmit, loading }: MealPlanInputSheetProps) {
  const theme = useTheme();

  return (
    <Sheet isOpen={isOpen} onClose={() => onClose()} tweenConfig={{ ease: 'easeOut', duration: 0.4 }}>
      <Sheet.Backdrop>
        <Sheet.Container style={{backgroundColor: `${theme.palette.background.default}`}}>
          <Sheet.Header/>
          <Sheet.Content>
            <Sheet.Scroller draggableAt="top">
              <Box sx={{ p: 3 }}>
                <Box sx={{ typography: 'h5', mb: 3 }}>Create Meal Plan</Box>
                <MealPlanInput onSubmit={onSubmit} loading={loading} />
              </Box>
            </Sheet.Scroller>
          </Sheet.Content>
        </Sheet.Container>
      </Sheet.Backdrop>
    </Sheet>
  );
} 