import type {SSE} from "sse.js";

import {useState, useEffect, useCallback} from "react";
import {StartAudio, RoomAudioRenderer, useLocalParticipant, VoiceAssistantControlBar, useConnectionState} from "@livekit/components-react";
import {ConnectionState} from "livekit-client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";

import {useAuthContext} from "../../auth/hooks";
import {useRouter, useSearchParams} from "../../routes/hooks";
import {converseWithAssistant2} from "../../actions/assistant";

import type {IChatMessage, IChatParticipant, IChatConversation} from "../../types/chat";

type Props = {
  onOpenVerification: () => void
  onOpenMatchMaking: () => void
  onOpenMyProfile: () => void
  onOpenChatVideo: () => void
  onOpenCreateProfile: () => void
  onOpenUpdateProfile: () => void
  onOpenWaliCreateView: () => void
  onOpenUserStatistics: () => void
  onOpenUserSettings: () => void
  onConnect: () => void
};

export function LivekitRoomContent({onOpenVerification, onOpenMatchMaking, onOpenMyProfile, onOpenChatVideo,
                                     onOpenCreateProfile, onOpenUpdateProfile, onOpenWaliCreateView, 
                                     onOpenUserStatistics, onOpenUserSettings, onConnect}: Props) {

  const {user} = useAuthContext();
  const router = useRouter();
  /* const {
    conversation,
    conversationError,
    conversationLoading,
    conversationValidating
  } = useGetOpenaiConversation(user?.id)
  const participants: IChatParticipant[] = conversation
    ? conversation.participants
    : []; */
  const searchParams = useSearchParams();
  const selectedConversationId = searchParams.get('id') || '';
  const [newResponseStream, setNewResponseStream] = useState<ReadableStreamDefaultReader<string> | undefined>(undefined);
  const [newResponseEventSource, setNewResponseEventSource] = useState<SSE | undefined>(undefined);
  // @ts-ignore
  const [newConversation, setNewConversation] = useState<IChatConversation>(null);
  const [recipients, setRecipients] = useState<IChatParticipant[]>([]);
  const [isInputDisabled, setIsInputDisabled] = useState<boolean>(false)
  const {localParticipant} = useLocalParticipant()
  const connectionState = useConnectionState();
  const isDisconnected = connectionState === ConnectionState.Disconnected;

  const registerRPCMethods = useCallback(async () => {
    localParticipant.registerRpcMethod(
      'verify_identity',
      async (data) => {
        console.log(`Received verification identity request from ${data.callerIdentity}: ${data.payload}`);
        onOpenVerification()
        return `Hello, ${data.callerIdentity}!`;
      }
    );
    localParticipant.registerRpcMethod(
      'create_profile',
      async (data) => {
        console.log(`Received creation profile request from ${data.callerIdentity}: ${data.payload}`);
        onOpenCreateProfile()
        return `Hello, ${data.callerIdentity}!`;
      }
    );
    localParticipant.registerRpcMethod(
      'update_profile',
      async (data) => {
        console.log(`Received update profile request from ${data.callerIdentity}: ${data.payload}`);
        onOpenUpdateProfile()
        return `Hello, ${data.callerIdentity}!`;
      }
    );
    localParticipant.registerRpcMethod(
      'start_chat',
      async (data) => {
        console.log(`Received starting chat request from ${data.callerIdentity}: ${data.payload}`);
        onOpenUpdateProfile()
        return `Hello, ${data.callerIdentity}!`;
      }
    );
    localParticipant.registerRpcMethod(
      'start_video_conference',
      async (data) => {
        console.log(`Received starting video conference request from ${data.callerIdentity}: ${data.payload}`);
        onOpenUpdateProfile()
        return `Hello, ${data.callerIdentity}!`;
      }
    );
    localParticipant.registerRpcMethod(
      'show_profile_question',
      async (data) => {
        const { section, questionId } = JSON.parse(data.payload);
        onOpenUpdateProfile();
        // Emit event to scroll to section/question
        window.dispatchEvent(new CustomEvent('scrollToQuestion', { 
          detail: { section, questionId } 
        }));
        return 'Profile opened';
      }
    );
    localParticipant.registerRpcMethod(
      'show_matches',
      async (data) => {
        onOpenMatchMaking();
        return 'Matches opened';
      }
    );
    localParticipant.registerRpcMethod(
      'manage_wali',
      async (data) => {
        const { action } = JSON.parse(data.payload);
        if (action === 'create') {
          onOpenWaliCreateView();
        }
        return 'Wali management opened';
      }
    );
  }, [localParticipant, onOpenCreateProfile, onOpenUpdateProfile, onOpenVerification, onOpenMatchMaking, onOpenWaliCreateView])

  useEffect(() => {
    if (localParticipant) registerRPCMethods()
  }, [registerRPCMethods, localParticipant])

  const handleAddRecipients = useCallback((selected: IChatParticipant[]) => {
    setRecipients(selected);
  }, []);

  const handleNewResponseStreamCompleted = useCallback(async () => {
    // newConversation.messages.push(newMessage)
    // setNewConversation(newConversation)
    setNewResponseStream(undefined)
  }, [])

  const handleNewResponseEventSourceCompleted = useCallback(async () => {
    // newConversation.messages.push(newMessage)
    // setNewConversation(newConversation)
    setNewResponseEventSource(undefined)
  }, [])

  const handleConverseWithAssistant = useCallback(async (messageData: IChatMessage) => {
    setIsInputDisabled(true)
    // const streamReader = await converseWithAssistant(user!.id, messageData)
    const eventSource = await converseWithAssistant2(user!.id, messageData)
    // setNewResponseStream(streamReader)
    setNewResponseEventSource(eventSource)
    setIsInputDisabled(false)
  }, [user])

  /* useEffect(() => {
    if (conversationError || !selectedConversationId) {
      // router.push(paths.dashboard.chat);
    }
    if (conversation) setNewConversation(conversation)
  }, [conversationError, router, selectedConversationId, conversation]); */

  return (
    <>

      {/* <Button color="inherit" variant="outlined" onClick={onOpenVerification}>
        ID verification
      </Button>
      <Button color="inherit" variant="outlined" onClick={onOpenMatchMaking}>
        Match making
      </Button>
      <Button color="inherit" variant="outlined" onClick={onOpenMyProfile}>
        My profile
      </Button>
      <Button color="inherit" variant="outlined" onClick={onOpenChatVideo}>
        Chat / Video
      </Button> */}

      <Box sx={{display: "flex", flexDirection: "column", justifyContent: "center", pt: 3}}>
        {isDisconnected ? (
          <Box sx={{display: "flex", justifyContent: "center"}}>
            <Button color="primary" variant="outlined" onClick={onConnect}>
              Connect
            </Button>
          </Box>
        ) : (
          <>
            <VoiceAssistantControlBar/>
            <RoomAudioRenderer/>
            <StartAudio label="Click to allow audio playback"/>
          </>
        )}
      </Box>

      <Box sx={{
        p: 3, 
        display: "flex", 
        flexWrap: "wrap",  // Allow wrapping
        gap: 2,  // Add uniform gap between buttons
        justifyContent: "center",  // Center buttons
        maxWidth: 600,  // Limit max width to force wrapping
        mx: "auto"  // Center the box
      }}>
        <Button color="inherit" variant="outlined" onClick={onOpenMyProfile}>
          My profile
        </Button>
        <Button color="inherit" variant="outlined" onClick={onOpenMatchMaking}>
          Match making
        </Button>
        <Button color="inherit" variant="outlined" onClick={onOpenWaliCreateView}>
          Create Wali
        </Button>
        <Button color="inherit" variant="outlined" onClick={onOpenUserStatistics}>
          Statistics
        </Button>
        <Button color="inherit" variant="outlined" onClick={onOpenUserSettings}>
          Settings
        </Button>
      </Box>

      {/* <ChatMessageList
        messages={newConversation?.messages ?? []}
        newResponseStream={newResponseStream}
        newResponseEventSource={newResponseEventSource}
        participants={participants}
        loading={conversationLoading}
        onNewResponseStreamCompleted={handleNewResponseStreamCompleted}
        onNewResponseEventSourceCompleted={handleNewResponseEventSourceCompleted}
      /> */}
      {/* <ChatMessageInput
        recipients={recipients}
        onAddRecipients={handleAddRecipients}
        selectedConversationId={selectedConversationId}
        disabled={isInputDisabled}
        onSend={handleConverseWithAssistant}
      /> */}
    </>
  )
}
