// eslint-disable-next-line import/no-extraneous-dependencies
import "@livekit/components-styles";
import {firstValueFrom} from "rxjs";
import {useFunctions} from "reactfire";
import {httpsCallable} from "rxfire/functions";
import {createGlobalStyle} from 'styled-components';
// eslint-disable-next-line import/no-extraneous-dependencies
import {useState, useEffect, useCallback} from 'react';
// eslint-disable-next-line import/no-extraneous-dependencies
import {LiveKitRoom, BarVisualizer, useVoiceAssistant, useConnectionState} from "@livekit/components-react";
import { ConnectionState, Room } from "livekit-client";

import Box from '@mui/material/Box';
import {useTheme} from "@mui/material/styles";

import {DashboardContent} from 'src/layouts/dashboard';

import {Layout} from '../layout';
import {ChatVideo} from "../chat-video";
import {MatchMaking} from "../match-making";
import {UserProfile} from "../user-profile";
import {WaliCreateView} from "../wali-create-view";
import {AgentProvider} from "../../../hooks/use-agent";
import {LivekitRoomContent} from "../livekit-room-content";
import {VerificationIdentity} from "../verification-identity";
import {AnimateLogo1, AnimateLogo2} from "../../../components/animate";
import { MatchSummaryWidget } from '../match-summary-widget';
import { EcommerceWidgetSummary } from "src/sections/overview/e-commerce/ecommerce-widget-summary";
import { UserStatistics } from '../user-statistics';
import { UserSettings } from '../user-settings';

// ----------------------------------------------------------------------

export interface LikekitTokenResponse {
  accessToken: string,
  url: string
}

export function AssistantView() {

  const functions = useFunctions();

  const [openVerificationModal, setOpenVerificationModal] = useState(false);
  const [openMatchMakingModal, setOpenMatchMakingModal] = useState(false);
  const [openMyProfileModal, setOpenMyProfileModal] = useState(false);
  const [openChatVideoModal, setOpenChatVideoModal] = useState(false);
  const [openCreateProfile, setOpenCreateProfile] = useState(false);
  const [openUpdateProfile, setOpenUpdateProfile] = useState(false);
  const [openWaliCreateView, setOpenWaliCreateView] = useState(false);
  const [openUserStatistics, setOpenUserStatistics] = useState(false);
  const [openUserSettings, setOpenUserSettings] = useState(false);
  const [isUserIdentityVerified, setIsUserIdentityVerified] = useState(false);
  const [livekitToken, setLivekitToken] = useState<string>('');
  const [livekitUrl, setLivekitUrl] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const [room] = useState(() => new Room());

  const getLikekitToken = useCallback(async () => {
    const remoteLivekitToken = httpsCallable(functions, 'livekitToken');
    const {
      accessToken,
      url
    } = await firstValueFrom(remoteLivekitToken({})) as LikekitTokenResponse;
    setLivekitToken(accessToken)
    setLivekitUrl(url)
  }, [functions])

  const handleOpenVerification = useCallback(() => {
    setOpenVerificationModal(true)
  }, [])

  const handleCloseVerification = useCallback(() => {
    setOpenVerificationModal(false)
  }, [])

  const handleOpenMatchMaking = useCallback(() => {
    setOpenMatchMakingModal(true)
  }, [])

  const handleCloseMatchMaking = useCallback(() => {
    setOpenMatchMakingModal(false)
  }, [])

  const handleOpenChatVideo = useCallback(() => {
    setOpenChatVideoModal(true)
  }, [])

  const handleCloseChatVideo = useCallback(() => {
    setOpenChatVideoModal(false)
  }, [])

  const handleOpenMyProfile = useCallback(() => {
    setOpenMyProfileModal(true)
  }, [])

  const handleOpenWaliCreateView = useCallback(() => {
    setOpenWaliCreateView(true)
  }, [])

  const handleCloseMyProfile = useCallback(() => {
    setOpenMyProfileModal(false)
  }, [])

  const handleOpenCreateProfile = useCallback(() => {
    setOpenCreateProfile(true)
  }, [])

  const handleCloseCreateProfile = useCallback(() => {
    setOpenCreateProfile(false)
  }, [])

  const handleOpenUpdateProfile = useCallback(() => {
    setOpenUpdateProfile(true)
  }, [])

  const handleCloseUpdateProfile = useCallback(() => {
    setOpenUpdateProfile(false)
  }, [])

  const handleCloseWaliCreateView = useCallback(() => {
    setOpenWaliCreateView(false)
  }, [])

  const handleOpenUserStatistics = useCallback(() => {
    setOpenUserStatistics(true)
  }, [])

  const handleCloseUserStatistics = useCallback(() => {
    setOpenUserStatistics(false)
  }, [])

  const handleOpenUserSettings = useCallback(() => {
    setOpenUserSettings(true)
  }, [])

  const handleCloseUserSettings = useCallback(() => {
    setOpenUserSettings(false)
  }, [])

  const handleConnect = useCallback(() => {
    setIsConnected(true);
  }, []);

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

  return (
    <DashboardContent
      maxWidth={false}
      sx={{display: 'flex', flex: '1 1 auto', flexDirection: 'column', padding: 0}}
      id="root"
    >
      <LiveKitRoom
        room={room}
        serverUrl={livekitUrl}
        token={livekitToken}
        connect={isConnected}
        audio
        style={{display: "contents"}}
      >
        <AgentProvider>
          <Box sx={{
            m: 3, 
            display: 'flex', 
            flexDirection: 'column', 
            justifyContent: 'center', 
            alignItems: 'center',
            gap: 3
          }}>
            <SimpleVoiceAssistant/>
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
                  <LivekitRoomContent 
                    onOpenVerification={handleOpenVerification}
                    onOpenMatchMaking={handleOpenMatchMaking}
                    onOpenMyProfile={handleOpenMyProfile}
                    onOpenChatVideo={handleOpenChatVideo}
                    onOpenCreateProfile={handleOpenCreateProfile}
                    onOpenUpdateProfile={handleOpenUpdateProfile}
                    onOpenWaliCreateView={handleOpenWaliCreateView}
                    onOpenUserStatistics={handleOpenUserStatistics}
                    onOpenUserSettings={handleOpenUserSettings}
                    onConnect={handleConnect}
                  />
                  <Box sx={{ 
                    px: 3, 
                    mt: 4, 
                    mb: 3,
                    visibility: openMyProfileModal ? 'hidden' : 'visible',
                    opacity: openMyProfileModal ? 0 : 1,
                    transition: 'opacity 0.2s ease-out'
                  }}>
                    <MatchSummaryWidget/>
                  </Box>
                </>
              ),
            }}
          />
        </AgentProvider>
      </LiveKitRoom>
      <Box sx={{ width: '50%', maxWidth: { sm: 600 }, mx: 'auto'}}>
        <ChatVideo isOpen={openChatVideoModal} onClose={handleCloseChatVideo}/>
        <VerificationIdentity isOpen={openVerificationModal} onClose={handleCloseVerification}/>
        <MatchMaking isOpen={openMatchMakingModal} onClose={handleCloseMatchMaking}/>
        <UserProfile isOpen={openMyProfileModal} onClose={handleCloseMyProfile}/>
        <UserProfile isOpen={openCreateProfile} onClose={handleCloseCreateProfile}/>
        <UserProfile isOpen={openUpdateProfile} onClose={handleCloseUpdateProfile}/>
        <WaliCreateView isOpen={openWaliCreateView} onClose={handleCloseWaliCreateView}/>
        <UserStatistics isOpen={openUserStatistics} onClose={handleCloseUserStatistics}/>
        <UserSettings isOpen={openUserSettings} onClose={handleCloseUserSettings}/>
      </Box>
    </DashboardContent>
  );
}

function SimpleVoiceAssistant() {
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

