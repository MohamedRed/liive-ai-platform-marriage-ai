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
import {AnimateLogo1, AnimateLogo2} from "src/components/animate";
import { Sheet } from "react-modal-sheet";

// ----------------------------------------------------------------------

// Create a context for device switching
interface RidesharingRoomContextType {
  onSwitchDevice?: (deviceId: string, label?: string) => void;
}

const RidesharingRoomContext = React.createContext<RidesharingRoomContextType>({});

export interface LikekitTokenResponse {
  accessToken: string,
  url: string
}

export function RidesharingCustomView() {
  const functions = useFunctions();
  const theme = useTheme();

  // Sheet states
  const [openDriverTrip, setOpenDriverTrip] = useState(false);
  const [openPassengerTrip, setOpenPassengerTrip] = useState(false);
  const [openTripsMap, setOpenTripsMap] = useState(false);
  const [openNotifications, setOpenNotifications] = useState(false);
  const [openTripHistory, setOpenTripHistory] = useState(false);
  const [openSettings, setOpenSettings] = useState(false);

  // Livekit states
  const [hasJoinedRoom, setHasJoinedRoom] = useState(false);
  const [livekitToken, setLivekitToken] = useState<string | null>(null);
  const [livekitUrl, setLivekitUrl] = useState<string | null>(null);

  // Device preferences state
  const [preferredDeviceId, setPreferredDeviceId] = useState<string>("");

  // Active trip state
  const [activeTripAsDriver, setActiveTripAsDriver] = useState<any>(null);
  const [activeTripAsPassenger, setActiveTripAsPassenger] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Function to switch audio device
  const switchAudioDevice = useCallback((deviceId: string, label?: string) => {
    console.log(`Switching to device: ${label || deviceId}`);
    setPreferredDeviceId(deviceId);
    // Save the preference to local storage
    if (typeof window !== 'undefined') {
      localStorage.setItem('preferredAudioDeviceId', deviceId);
    }
  }, []);

  // Get token for Livekit
  const getLikekitToken = useCallback(async () => {
    try {
      const remoteLivekitToken = httpsCallable(functions, 'livekitToken');
      const {
        accessToken,
        url
      } = await firstValueFrom(remoteLivekitToken({})) as LikekitTokenResponse;
      setLivekitToken(accessToken);
      setLivekitUrl(url);
    } catch (error) {
      console.error("Error getting Livekit token:", error);
      setError("Failed to connect to voice service");
    }
  }, [functions]);

  // Load preferred device from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedDeviceId = localStorage.getItem('preferredAudioDeviceId');
      if (savedDeviceId) {
        setPreferredDeviceId(savedDeviceId);
      }
    }
  }, []);

  // Fetch Livekit token on component mount
  useEffect(() => {
    getLikekitToken();
  }, [getLikekitToken]);

  // Connect to room handler
  const handleConnect = useCallback(() => {
    if (!livekitToken || !livekitUrl) {
      getLikekitToken();
    }
    setHasJoinedRoom(true);
  }, [getLikekitToken, livekitToken, livekitUrl]);

  // Driver trip creation handler
  const handleCreateDriverTrip = async (tripData: any) => {
    setLoading(true);
    setError(null);
    try {
      const createDriverTrip = httpsCallable(functions, 'ridesharing-createDriverTrip');
      const result = await firstValueFrom(createDriverTrip(tripData));
      setActiveTripAsDriver(result);
      setLoading(false);
    } catch (error) {
      console.error("Error creating driver trip:", error);
      setError("Failed to create driver trip");
      setLoading(false);
    }
  };

  // Passenger trip request handler
  const handleRequestPassengerTrip = async (tripData: any) => {
    setLoading(true);
    setError(null);
    try {
      const requestPassengerTrip = httpsCallable(functions, 'ridesharing-requestPassengerTrip');
      const result = await firstValueFrom(requestPassengerTrip(tripData));
      setActiveTripAsPassenger(result);
      setLoading(false);
    } catch (error) {
      console.error("Error requesting passenger trip:", error);
      setError("Failed to request passenger trip");
      setLoading(false);
    }
  };
  
  // Create context value for device switching - MOVED BEFORE THE CONDITIONAL RETURN
  const contextValue = useMemo(() => ({
    onSwitchDevice: switchAudioDevice
  }), [switchAudioDevice]);

  return (
    <DashboardContent
      maxWidth={false}
      sx={{display: 'flex', flex: '1 1 auto', flexDirection: 'column', padding: 0}}
      id="root"
    >
      <RidesharingRoomContext.Provider value={contextValue}>
        <LiveKitRoom
          token={livekitToken || undefined}
          serverUrl={livekitUrl || undefined}
          connect={hasJoinedRoom}
          options={{
            audioCaptureDefaults: {
              deviceId: preferredDeviceId,
            },
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
            <RidesharingVoiceAssistant/>
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
                  <RidesharingRoomContent 
                    onConnect={handleConnect}
                    onOpenDriverTrip={() => setOpenDriverTrip(true)}
                    onOpenPassengerTrip={() => setOpenPassengerTrip(true)}
                    onOpenTripsMap={() => setOpenTripsMap(true)}
                    onOpenNotifications={() => setOpenNotifications(true)}
                    onOpenTripHistory={() => setOpenTripHistory(true)}
                    onOpenSettings={() => setOpenSettings(true)}
                    onCreateDriverTrip={handleCreateDriverTrip}
                    onRequestPassengerTrip={handleRequestPassengerTrip}
                    loading={loading}
                    error={error}
                    activeTripAsDriver={activeTripAsDriver}
                    activeTripAsPassenger={activeTripAsPassenger}
                    setActiveTripAsDriver={setActiveTripAsDriver}
                    setActiveTripAsPassenger={setActiveTripAsPassenger}
                    onSwitchDevice={switchAudioDevice}
                    preferredDeviceId={preferredDeviceId}
                  />
                </>
              ),
            }}
          />
        </LiveKitRoom>
      </RidesharingRoomContext.Provider>
      
      {/* Sheet components */}
      <Box sx={{ width: '50%', maxWidth: { sm: 600 }, mx: 'auto'}}>
        <DriverTripSheet 
          isOpen={openDriverTrip} 
          onClose={() => setOpenDriverTrip(false)} 
          onSubmit={handleCreateDriverTrip} 
          loading={loading}
          activeTripAsDriver={activeTripAsDriver}
        />
        <PassengerTripSheet 
          isOpen={openPassengerTrip} 
          onClose={() => setOpenPassengerTrip(false)} 
          onSubmit={handleRequestPassengerTrip} 
          loading={loading}
          activeTripAsPassenger={activeTripAsPassenger}
        />
        <TripsMapSheet 
          isOpen={openTripsMap} 
          onClose={() => setOpenTripsMap(false)} 
          activeTripAsDriver={activeTripAsDriver}
          activeTripAsPassenger={activeTripAsPassenger}
        />
        <NotificationsSheet 
          isOpen={openNotifications} 
          onClose={() => setOpenNotifications(false)} 
        />
        <TripHistorySheet 
          isOpen={openTripHistory} 
          onClose={() => setOpenTripHistory(false)} 
        />
        <SettingsSheet 
          isOpen={openSettings} 
          onClose={() => setOpenSettings(false)} 
        />
      </Box>
    </DashboardContent>
  );
}

function RidesharingVoiceAssistant() {
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
      <BarVisualizer state={state} barCount={7} trackRef={audioTrack} style={{height: "100px"}}/>
    </>
  );
}

interface RidesharingRoomContentProps {
  onConnect: () => void;
  onOpenDriverTrip: () => void;
  onOpenPassengerTrip: () => void;
  onOpenTripsMap: () => void;
  onOpenNotifications: () => void;
  onOpenTripHistory: () => void;
  onOpenSettings: () => void;
  onCreateDriverTrip: (tripData: any) => void;
  onRequestPassengerTrip: (tripData: any) => void;
  loading: boolean;
  error: string | null;
  activeTripAsDriver: any;
  activeTripAsPassenger: any;
  setActiveTripAsDriver: (trip: any) => void;
  setActiveTripAsPassenger: (trip: any) => void;
  onSwitchDevice: (deviceId: string, label?: string) => void;
  preferredDeviceId: string;
}

function RidesharingRoomContent({
  onConnect,
  onOpenDriverTrip,
  onOpenPassengerTrip,
  onOpenTripsMap,
  onOpenNotifications,
  onOpenTripHistory,
  onOpenSettings,
  onCreateDriverTrip,
  onRequestPassengerTrip,
  loading,
  error,
  activeTripAsDriver,
  activeTripAsPassenger,
  setActiveTripAsDriver,
  setActiveTripAsPassenger,
  onSwitchDevice,
  preferredDeviceId
}: RidesharingRoomContentProps) {
  const theme = useTheme();
  const connectionState = useConnectionState();
  const isDisconnected = connectionState === ConnectionState.Disconnected;

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
          {/* Driver Trip Button */}
          <Button 
            variant={activeTripAsDriver ? "outlined" : "contained"} 
            color="primary"
            onClick={onOpenDriverTrip}
            startIcon={<Box component="span" className="iconify" sx={{ display: 'inline-block', width: 16, height: 16, backgroundSize: 'contain', backgroundImage: 'url("https://api.iconify.design/mdi:car.svg")', backgroundRepeat: 'no-repeat' }}/>}
          >
            {activeTripAsDriver ? "View Driver Trip" : "Start Driver Trip"}
          </Button>
          
          {/* Passenger Trip Button */}
          <Button 
            variant={activeTripAsPassenger ? "outlined" : "contained"}
            color="secondary"
            onClick={onOpenPassengerTrip}
            startIcon={<Box component="span" className="iconify" sx={{ display: 'inline-block', width: 16, height: 16, backgroundSize: 'contain', backgroundImage: 'url("https://api.iconify.design/mdi:account.svg")', backgroundRepeat: 'no-repeat' }}/>}
          >
            {activeTripAsPassenger ? "View Passenger Trip" : "Request Ride"}
          </Button>
          
          {/* Map Button */}
          <Button 
            variant="outlined" 
            onClick={onOpenTripsMap}
            startIcon={<Box component="span" className="iconify" sx={{ display: 'inline-block', width: 16, height: 16, backgroundSize: 'contain', backgroundImage: 'url("https://api.iconify.design/mdi:map.svg")', backgroundRepeat: 'no-repeat' }}/>}
          >
            Open Map
          </Button>
          
          {/* Notifications Button */}
          <Button 
            variant="outlined" 
            onClick={onOpenNotifications}
            startIcon={<Box component="span" className="iconify" sx={{ display: 'inline-block', width: 16, height: 16, backgroundSize: 'contain', backgroundImage: 'url("https://api.iconify.design/mdi:bell-outline.svg")', backgroundRepeat: 'no-repeat' }}/>}
          >
            Notifications
          </Button>
          
          {/* Trip History Button */}
          <Button 
            variant="outlined" 
            onClick={onOpenTripHistory}
            startIcon={<Box component="span" className="iconify" sx={{ display: 'inline-block', width: 16, height: 16, backgroundSize: 'contain', backgroundImage: 'url("https://api.iconify.design/mdi:history.svg")', backgroundRepeat: 'no-repeat' }}/>}
          >
            Trip History
          </Button>
          
          {/* Settings Button */}
          <Button 
            variant="outlined" 
            onClick={onOpenSettings}
            startIcon={<Box component="span" className="iconify" sx={{ display: 'inline-block', width: 16, height: 16, backgroundSize: 'contain', backgroundImage: 'url("https://api.iconify.design/mdi:cog-outline.svg")', backgroundRepeat: 'no-repeat' }}/>}
          >
            Settings
          </Button>
        </Box>
      </Box>

      {/* Active Trip Status */}
      {(activeTripAsDriver || activeTripAsPassenger) && (
        <Box sx={{ mt: 3, p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: 1 }}>
          <Box sx={{ typography: 'h6', mb: 2 }}>Active Trip</Box>
          {activeTripAsDriver && (
            <Box sx={{ mb: 2 }}>
              <Box sx={{ typography: 'subtitle1' }}>Driver Trip</Box>
              <Box sx={{ typography: 'body2' }}>
                Destination: {activeTripAsDriver.destination?.address || "Not specified"}
              </Box>
            </Box>
          )}
          {activeTripAsPassenger && (
            <Box>
              <Box sx={{ typography: 'subtitle1' }}>Passenger Trip</Box>
              <Box sx={{ typography: 'body2' }}>
                Destination: {activeTripAsPassenger.destination?.address || "Not specified"}
              </Box>
            </Box>
          )}
        </Box>
      )}

      {/* Error display */}
      {error && (
        <Box sx={{ mt: 2, color: 'error.main', typography: 'body2', textAlign: 'center' }}>
          {error}
        </Box>
      )}
    </Box>
  );
}

// Advanced version of CustomVoiceControls with device management
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
  const parentContext = useContext(RidesharingRoomContext);
  
  // Handle device selection through parent context
  const selectDevice = useCallback((device: MediaDeviceInfo) => {
    console.log('Selecting device:', device.label || device.deviceId);
    setSelectedDevice(device);
    setIsMenuOpen(false);
    
    // Use the parent's switchAudioDevice function
    if (parentContext && parentContext.onSwitchDevice) {
      console.log('Calling parent context switchAudioDevice with deviceId:', device.deviceId, 'and label:', device.label);
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

// Ridesharing modal components
interface TripSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (tripData: any) => void;
  loading: boolean;
  activeTripAsDriver?: any;
  activeTripAsPassenger?: any;
}

function DriverTripSheet({ isOpen, onClose, onSubmit, loading, activeTripAsDriver }: TripSheetProps) {
  const theme = useTheme();
  const [destination, setDestination] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      destination: {
        address: destination,
      },
      timestamp: new Date().toISOString(),
    });
  };

  return (
    <Sheet isOpen={isOpen} onClose={() => onClose()} tweenConfig={{ ease: 'easeOut', duration: 0.4 }}>
      <Sheet.Backdrop>
        <Sheet.Container style={{backgroundColor: `${theme.palette.background.default}`}}>
          <Sheet.Header/>
          <Sheet.Content>
            <Sheet.Scroller draggableAt="top">
              <Box sx={{ p: 3 }}>
                <Box sx={{ typography: 'h5', mb: 3 }}>
                  {activeTripAsDriver ? "Active Driver Trip" : "Start Driver Trip"}
                </Box>
                
                {activeTripAsDriver ? (
                  <Box>
                    <Box sx={{ typography: 'subtitle1', mb: 1 }}>Destination</Box>
                    <Box sx={{ typography: 'body1', mb: 2 }}>
                      {activeTripAsDriver.destination?.address || "Not specified"}
                    </Box>
                    
                    <Box sx={{ typography: 'subtitle1', mb: 1 }}>Started At</Box>
                    <Box sx={{ typography: 'body1', mb: 2 }}>
                      {new Date(activeTripAsDriver.timestamp).toLocaleString()}
                    </Box>
                    
                    <Button 
                      variant="contained" 
                      color="error" 
                      fullWidth
                      sx={{ mt: 2 }}
                      onClick={() => {
                        // Handle end trip logic
                        onClose();
                      }}
                    >
                      End Trip
                    </Button>
                  </Box>
                ) : (
                  <form onSubmit={handleSubmit}>
                    <Box sx={{ mb: 3 }}>
                      <Box sx={{ typography: 'subtitle1', mb: 1 }}>Where are you going?</Box>
                      <Box
                        component="input"
                        sx={{
                          width: '100%',
                          p: 1.5,
                          borderRadius: 1,
                          border: `1px solid ${theme.palette.divider}`,
                          typography: 'body1',
                        }}
                        placeholder="Enter destination address"
                        value={destination}
                        onChange={(e) => setDestination(e.target.value)}
                        required
                      />
                    </Box>
                    
                    <Button 
                      type="submit" 
                      variant="contained" 
                      fullWidth
                      disabled={loading}
                    >
                      {loading ? "Starting Trip..." : "Start Trip"}
                    </Button>
                  </form>
                )}
              </Box>
            </Sheet.Scroller>
          </Sheet.Content>
        </Sheet.Container>
      </Sheet.Backdrop>
    </Sheet>
  );
}

function PassengerTripSheet({ isOpen, onClose, onSubmit, loading, activeTripAsPassenger }: TripSheetProps) {
  const theme = useTheme();
  const [destination, setDestination] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      destination: {
        address: destination,
      },
      timestamp: new Date().toISOString(),
    });
  };

  return (
    <Sheet isOpen={isOpen} onClose={() => onClose()} tweenConfig={{ ease: 'easeOut', duration: 0.4 }}>
      <Sheet.Backdrop>
        <Sheet.Container style={{backgroundColor: `${theme.palette.background.default}`}}>
          <Sheet.Header/>
          <Sheet.Content>
            <Sheet.Scroller draggableAt="top">
              <Box sx={{ p: 3 }}>
                <Box sx={{ typography: 'h5', mb: 3 }}>
                  {activeTripAsPassenger ? "Active Passenger Trip" : "Request a Ride"}
                </Box>
                
                {activeTripAsPassenger ? (
                  <Box>
                    <Box sx={{ typography: 'subtitle1', mb: 1 }}>Destination</Box>
                    <Box sx={{ typography: 'body1', mb: 2 }}>
                      {activeTripAsPassenger.destination?.address || "Not specified"}
                    </Box>
                    
                    <Box sx={{ typography: 'subtitle1', mb: 1 }}>Requested At</Box>
                    <Box sx={{ typography: 'body1', mb: 2 }}>
                      {new Date(activeTripAsPassenger.timestamp).toLocaleString()}
                    </Box>
                    
                    <Button 
                      variant="contained" 
                      color="error" 
                      fullWidth
                      sx={{ mt: 2 }}
                      onClick={() => {
                        // Handle cancel ride logic
                        onClose();
                      }}
                    >
                      Cancel Ride
                    </Button>
                  </Box>
                ) : (
                  <form onSubmit={handleSubmit}>
                    <Box sx={{ mb: 3 }}>
                      <Box sx={{ typography: 'subtitle1', mb: 1 }}>Where do you want to go?</Box>
                      <Box
                        component="input"
                        sx={{
                          width: '100%',
                          p: 1.5,
                          borderRadius: 1,
                          border: `1px solid ${theme.palette.divider}`,
                          typography: 'body1',
                        }}
                        placeholder="Enter destination address"
                        value={destination}
                        onChange={(e) => setDestination(e.target.value)}
                        required
                      />
                    </Box>
                    
                    <Button 
                      type="submit" 
                      variant="contained" 
                      fullWidth
                      disabled={loading}
                    >
                      {loading ? "Finding a ride..." : "Request Ride"}
                    </Button>
                  </form>
                )}
              </Box>
            </Sheet.Scroller>
          </Sheet.Content>
        </Sheet.Container>
      </Sheet.Backdrop>
    </Sheet>
  );
}

function TripsMapSheet({ isOpen, onClose, activeTripAsDriver, activeTripAsPassenger }: Omit<TripSheetProps, 'onSubmit' | 'loading'>) {
  const theme = useTheme();

  return (
    <Sheet isOpen={isOpen} onClose={() => onClose()} tweenConfig={{ ease: 'easeOut', duration: 0.4 }}>
      <Sheet.Backdrop>
        <Sheet.Container style={{backgroundColor: `${theme.palette.background.default}`}}>
          <Sheet.Header/>
          <Sheet.Content>
            <Sheet.Scroller draggableAt="top">
              <Box sx={{ p: 3 }}>
                <Box sx={{ typography: 'h5', mb: 3 }}>Trip Map</Box>
                
                <Box sx={{ 
                  width: '100%', 
                  height: 300, 
                  backgroundColor: '#f5f5f5', 
                  borderRadius: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  typography: 'body1',
                  color: 'text.secondary',
                  mb: 3
                }}>
                  Map will be displayed here
                </Box>
                
                {(activeTripAsDriver || activeTripAsPassenger) && (
                  <Box sx={{ mt: 2 }}>
                    <Box sx={{ typography: 'subtitle1', mb: 1 }}>Active Trip</Box>
                    {activeTripAsDriver && (
                      <Box sx={{ typography: 'body2', mb: 1 }}>
                        Driver Trip to: {activeTripAsDriver.destination?.address}
                      </Box>
                    )}
                    {activeTripAsPassenger && (
                      <Box sx={{ typography: 'body2', mb: 1 }}>
                        Passenger Trip to: {activeTripAsPassenger.destination?.address}
                      </Box>
                    )}
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

function NotificationsSheet({ isOpen, onClose }: Omit<TripSheetProps, 'onSubmit' | 'loading' | 'activeTripAsDriver' | 'activeTripAsPassenger'>) {
  const theme = useTheme();

  return (
    <Sheet isOpen={isOpen} onClose={() => onClose()} tweenConfig={{ ease: 'easeOut', duration: 0.4 }}>
      <Sheet.Backdrop>
        <Sheet.Container style={{backgroundColor: `${theme.palette.background.default}`}}>
          <Sheet.Header/>
          <Sheet.Content>
            <Sheet.Scroller draggableAt="top">
              <Box sx={{ p: 3 }}>
                <Box sx={{ typography: 'h5', mb: 3 }}>Notifications</Box>
                
                <Box sx={{ typography: 'body1', color: 'text.secondary' }}>
                  You have no new notifications
                </Box>
              </Box>
            </Sheet.Scroller>
          </Sheet.Content>
        </Sheet.Container>
      </Sheet.Backdrop>
    </Sheet>
  );
}

function TripHistorySheet({ isOpen, onClose }: Omit<TripSheetProps, 'onSubmit' | 'loading' | 'activeTripAsDriver' | 'activeTripAsPassenger'>) {
  const theme = useTheme();

  return (
    <Sheet isOpen={isOpen} onClose={() => onClose()} tweenConfig={{ ease: 'easeOut', duration: 0.4 }}>
      <Sheet.Backdrop>
        <Sheet.Container style={{backgroundColor: `${theme.palette.background.default}`}}>
          <Sheet.Header/>
          <Sheet.Content>
            <Sheet.Scroller draggableAt="top">
              <Box sx={{ p: 3 }}>
                <Box sx={{ typography: 'h5', mb: 3 }}>Trip History</Box>
                
                <Box sx={{ typography: 'body1', color: 'text.secondary' }}>
                  Your trip history will be displayed here
                </Box>
              </Box>
            </Sheet.Scroller>
          </Sheet.Content>
        </Sheet.Container>
      </Sheet.Backdrop>
    </Sheet>
  );
}

function SettingsSheet({ isOpen, onClose }: Omit<TripSheetProps, 'onSubmit' | 'loading' | 'activeTripAsDriver' | 'activeTripAsPassenger'>) {
  const theme = useTheme();

  return (
    <Sheet isOpen={isOpen} onClose={() => onClose()} tweenConfig={{ ease: 'easeOut', duration: 0.4 }}>
      <Sheet.Backdrop>
        <Sheet.Container style={{backgroundColor: `${theme.palette.background.default}`}}>
          <Sheet.Header/>
          <Sheet.Content>
            <Sheet.Scroller draggableAt="top">
              <Box sx={{ p: 3 }}>
                <Box sx={{ typography: 'h5', mb: 3 }}>Settings</Box>
                
                <Box sx={{ typography: 'subtitle1', mb: 1 }}>Notifications</Box>
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  mb: 2,
                  p: 2,
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: 1
                }}>
                  <Box sx={{ typography: 'body1' }}>In-app notifications</Box>
                  <Box component="input" type="checkbox" defaultChecked />
                </Box>
                
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  mb: 2,
                  p: 2,
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: 1
                }}>
                  <Box sx={{ typography: 'body1' }}>SMS notifications</Box>
                  <Box component="input" type="checkbox" defaultChecked />
                </Box>
                
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  mb: 3,
                  p: 2,
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: 1
                }}>
                  <Box sx={{ typography: 'body1' }}>Voice call notifications</Box>
                  <Box component="input" type="checkbox" defaultChecked />
                </Box>
                
                <Box sx={{ typography: 'subtitle1', mb: 1 }}>Matching Preferences</Box>
                <Box sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  mb: 2,
                  p: 2,
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: 1
                }}>
                  <Box sx={{ typography: 'body1' }}>Same gender matching only</Box>
                  <Box component="input" type="checkbox" defaultChecked />
                </Box>
                
                <Box sx={{ typography: 'subtitle1', mb: 1 }}>Distance Settings</Box>
                <Box sx={{ 
                  mb: 3,
                  p: 2,
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: 1
                }}>
                  <Box sx={{ typography: 'body2', mb: 1 }}>Maximum pickup distance (meters)</Box>
                  <Box component="input" type="range" min="10" max="100" defaultValue="50" style={{ width: '100%' }} />
                  <Box sx={{ typography: 'body2', textAlign: 'center' }}>50 meters</Box>
                </Box>
                
                <Box sx={{ 
                  mb: 3,
                  p: 2,
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: 1
                }}>
                  <Box sx={{ typography: 'body2', mb: 1 }}>Maximum dropoff distance (meters)</Box>
                  <Box component="input" type="range" min="10" max="100" defaultValue="50" style={{ width: '100%' }} />
                  <Box sx={{ typography: 'body2', textAlign: 'center' }}>50 meters</Box>
                </Box>
                
                <Box sx={{ 
                  mb: 3,
                  p: 2,
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: 1
                }}>
                  <Box sx={{ typography: 'body2', mb: 1 }}>Maximum trip time extension (seconds)</Box>
                  <Box component="input" type="range" min="0" max="120" defaultValue="30" style={{ width: '100%' }} />
                  <Box sx={{ typography: 'body2', textAlign: 'center' }}>30 seconds</Box>
                </Box>
                
                <Button variant="contained" fullWidth>Save Settings</Button>
              </Box>
            </Sheet.Scroller>
          </Sheet.Content>
        </Sheet.Container>
      </Sheet.Backdrop>
    </Sheet>
  );
} 