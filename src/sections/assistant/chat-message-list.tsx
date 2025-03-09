import type {SSE} from "sse.js";
import type {IChatMessage, IChatParticipant} from 'src/types/chat';

// eslint-disable-next-line import/no-extraneous-dependencies
import {isEqual} from "lodash";
import {useRef, useState, useEffect, useCallback} from "react";

import Box from "@mui/material/Box";
import LinearProgress from '@mui/material/LinearProgress';

import {Scrollbar} from 'src/components/scrollbar';
import {Lightbox, useLightBox} from 'src/components/lightbox';

import {uuidv4} from "../../utils/uuidv4";
import {useAgent} from "../../hooks/use-agent";
import {useAuthContext} from "../../auth/hooks";
import {updateLastMessage} from "../../actions/assistant";
import {ChatTranscriptItem} from "./chat-transcript-item";
import {useMessagesScroll} from './hooks/use-messages-scroll';

// ----------------------------------------------------------------------

type Props = {
  loading: boolean;
  messages: IChatMessage[];
  participants: IChatParticipant[];
  newResponseStream: ReadableStreamDefaultReader<string> | undefined
  newResponseEventSource: SSE | undefined
  onNewResponseStreamCompleted: () => void;
  onNewResponseEventSourceCompleted: () => void;
};

export function ChatMessageList({
                                  messages = [],
                                  participants,
                                  loading,
                                  newResponseStream,
                                  newResponseEventSource,
                                  onNewResponseStreamCompleted,
                                  onNewResponseEventSourceCompleted
                                }: Props) {

  const [isReadingStream, setIsReadingStream] = useState<boolean>(false)

  const [isReadingEventSource, setIsReadingEventSource] = useState<boolean>(false)

  const [listMessages, setListMessages] = useState<IChatMessage[]>(messages)

  const [listTranscripts, setListTranscripts] = useState<IChatMessage[]>([])

  const {messagesEndRef} = useMessagesScroll(listMessages);

  const {user} = useAuthContext()

  const messagesRef = useRef<IChatMessage[]>();

  const slides = messages
    .filter((message) => message.contentType === 'image')
    .map((message) => ({src: message.body}));

  const lightbox = useLightBox(slides);

  const handleNewResponse = useCallback(async () => {
    setIsReadingStream(true)
    messages.push(
      {
        id: uuidv4(),
        senderId: "marriage-counselor",
        body: "",
        createdAt: (new Date()).toString(),
        contentType: "text",
        attachments: []
      }
    )
    let message = ""
    while (true) {
      // eslint-disable-next-line no-await-in-loop
      const {value, done} = await newResponseStream!.read();
      if (done) break;
      if (value) {
        console.log(value)
        const noSpacing = [",", ".", "!", '"', ";"].includes(value?.charAt(0))
        message = message.concat(noSpacing ? "" : " ", value)
        messages[messages.length - 1].body = messages[messages.length - 1].body.concat(noSpacing ? "" : " ", value)
      }
    }
    onNewResponseStreamCompleted()
    setTimeout(() => {
      setIsReadingStream(false)
    }, 5000)

    // resetNewResponseMessage()
  }, [messages, newResponseStream, onNewResponseStreamCompleted])

  const handleNewResponseEventSource = useCallback(async () => {
    setIsReadingEventSource(true)
    newResponseEventSource!.onmessage = (event) => {
      const value = event.data
      const noSpacing = [",", ".", "!", '"', ";"].includes(value?.charAt(0))
      const separator = noSpacing ? "" : " "
      updateLastMessage(user!.id, messages[messages.length - 1].body + separator + value)
      setListMessages([...messages])
    }
    newResponseEventSource!.onabort = () => {
      onNewResponseEventSourceCompleted()
      setIsReadingEventSource(false)
    }
    newResponseEventSource!.stream()
    // resetNewResponseMessage()
  }, [messages, newResponseEventSource, onNewResponseEventSourceCompleted, user])

  const {displayTranscriptions} = useAgent();

  const convertDisplayTranscription = useCallback(() => {
    const convertedTranscripts = displayTranscriptions.map((transcription) => (
      {
        id: transcription.segment.id,
        senderId: transcription.participant?.sid,
        body: transcription.segment.text,
        createdAt: transcription.segment.startTime.toString(),
        contentType: "text",
        attachments: [],
        fromAgent: transcription.participant?.isAgent
      } as IChatMessage))
    setListTranscripts(convertedTranscripts)
  }, [displayTranscriptions])

  useEffect(() => {
    convertDisplayTranscription()
  }, [convertDisplayTranscription, displayTranscriptions])

  useEffect(() => {
    // if (newResponseStream) handleNewResponse()
    if (newResponseEventSource) handleNewResponseEventSource()
  }, [handleNewResponseEventSource, newResponseEventSource])

  useEffect(() => {
    if (!isEqual(messagesRef.current, messages)) {
      console.log('Object prop `data` has changed:', messages);
      messagesRef.current = messages; // Update the reference
      setListMessages([...messages])
    }
  }, [messages]);

  if (loading) {
    return (
      <Box
        sx={{
          px: 5,
          width: 1,
          flexGrow: 1,
          minHeight: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <LinearProgress color="inherit" sx={{width: 1, maxWidth: 360}}/>
      </Box>
    );
  }

  return (
    <>
      {/* <Scrollbar ref={messagesEndRef} sx={{px: 3, pt: 5, pb: 3, flex: '1 1 auto'}}>
        {listMessages.map((message, index) =>
          <ChatMessageItem
            key={message.id}
            message={message}
            participants={participants}
            onOpenLightbox={() => lightbox.onOpen(message.body)}
          />)}
      </Scrollbar> */}

      <Scrollbar ref={messagesEndRef} sx={{px: 3, pt: 5, pb: 3, flex: '1 1 auto'}}>
        {listTranscripts.map(
          (message) =>
            message.body.trim() !== "" && (
              <ChatTranscriptItem
                key={message.id}
                message={message}
                participants={participants}
                onOpenLightbox={() => lightbox.onOpen(message.body)}
              />
            ),
        )}
      </Scrollbar>

      <Lightbox
        slides={slides}
        open={lightbox.open}
        close={lightbox.onClose}
        index={lightbox.selected}
      />
    </>
  );
}
