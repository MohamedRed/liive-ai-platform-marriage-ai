import type {IChatMessage, IChatParticipant, IChatConversation} from 'src/types/chat';

import {SSE} from "sse.js";
import {useMemo} from 'react';
import useSWR, {mutate} from 'swr';

import {keyBy} from 'src/utils/helper';
import axios, {fetcher, endpoints, postGetConversation} from 'src/utils/axios';

import {uuidv4} from "../utils/uuidv4";

// ----------------------------------------------------------------------

const enableServer = true;

const CHART_ENDPOINT = endpoints.chat;

const swrOptions = {
  revalidateIfStale: false,
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
};

// ----------------------------------------------------------------------

type ContactsData = {
  contacts: IChatParticipant[];
};

export function useGetContacts() {
  const url = [CHART_ENDPOINT, {params: {endpoint: 'contacts'}}];

  const {data, isLoading, error, isValidating} = useSWR<ContactsData>(url, fetcher, swrOptions);

  const memoizedValue = useMemo(
    () => ({
      contacts: data?.contacts || [],
      contactsLoading: isLoading,
      contactsError: error,
      contactsValidating: isValidating,
      contactsEmpty: !isLoading && !data?.contacts.length,
    }),
    [data?.contacts, error, isLoading, isValidating]
  );

  return memoizedValue;
}

// ----------------------------------------------------------------------

type ConversationsData = {
  conversations: IChatConversation[];
};

export function useGetConversations() {
  const url = [CHART_ENDPOINT, {params: {endpoint: 'conversations'}}];

  const {data, isLoading, error, isValidating} = useSWR<ConversationsData>(
    url,
    fetcher,
    swrOptions
  );

  const memoizedValue = useMemo(() => {
    const byId = data?.conversations.length ? keyBy(data.conversations, 'id') : {};
    const allIds = Object.keys(byId);

    return {
      conversations: {byId, allIds},
      conversationsLoading: isLoading,
      conversationsError: error,
      conversationsValidating: isValidating,
      conversationsEmpty: !isLoading && !allIds.length,
    };
  }, [data?.conversations, error, isLoading, isValidating]);

  return memoizedValue;
}

// ----------------------------------------------------------------------

type ConversationData = {
  conversation: IChatConversation;
};

export function useGetConversation(conversationId: string) {
  const url = conversationId
    ? [CHART_ENDPOINT, {params: {conversationId, endpoint: 'conversation'}}]
    : '';

  const {data, isLoading, error, isValidating} = useSWR<ConversationData>(
    url,
    fetcher,
    swrOptions
  );

  const memoizedValue = useMemo(
    () => ({
      conversation: data?.conversation,
      conversationLoading: isLoading,
      conversationError: error,
      conversationValidating: isValidating,
    }),
    [data?.conversation, error, isLoading, isValidating]
  );

  return memoizedValue;
}

// ----------------------------------------------------------------------

type OpenaiConversationData = {
  result: IChatConversation;
};

export function useGetOpenaiConversation(userID: string | undefined) {
  const url = "https://us-central1-marriage-ai-289c6.cloudfunctions.net/getConversation";

  const config = {
    data: {userID}
  }

  const {data, isLoading, error, isValidating} = useSWR<OpenaiConversationData>(
    userID ? [url, config] : null,
    postGetConversation,
    swrOptions
  );

  const memoizedValue = useMemo(
    () => ({
      conversation: data?.result,
      conversationLoading: isLoading,
      conversationError: error,
      conversationValidating: isValidating,
    }),
    [data?.result, error, isLoading, isValidating]
  );

  return memoizedValue;
}

// ----------------------------------------------------------------------

export async function converseWithAssistant(userID: string, messageData: IChatMessage):
  Promise<ReadableStreamDefaultReader<string> | undefined> {
  const getConversationUrl = "https://us-central1-marriage-ai-289c6.cloudfunctions.net/getConversation";
  const converseWithAssistantUrl = "https://us-central1-marriage-ai-289c6.cloudfunctions.net/converseWithAssistant";
  const config = {
    data: {userID}
  }

  /**
   * Work in local
   */
  mutate(
    [getConversationUrl, config],
    (currentData) => {
      console.log(currentData)
      const currentConversation: IChatConversation = currentData.result;

      const result = {
        ...currentConversation,
        messages: [...currentConversation.messages, messageData],
      };

      return {...currentData, result};
    },
    false
  );

  const userMessage = messageData.body

  const response = await fetch("google.com", {
    method: 'POST',
    headers: {
      'Content-Type': 'text/event-stream'
    },
    body: JSON.stringify({'userID': userID, 'userMessage': userMessage})
  })

  const source = new SSE(converseWithAssistantUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify({userID, userMessage})
  })

  source.onmessage = function (event) {
    console.log(event)
  }

  source.stream();
  /* const responseMessageData: IChatMessage = {
    id: "marriage-counselor",
    body: "",
    senderId: "marriage-counselor",
    contentType: "text",
    createdAt: (new Date()).toString(),
    attachments: [],
  }

  mutate(
    [getConversationUrl, config],
    (currentData) => {
      console.log(currentData)
      const currentConversation: IChatConversation = currentData.result;

      const result = {
        ...currentConversation,
        messages: [...currentConversation.messages, responseMessageData],
      };

      return {...currentData, result};
    },
    false
  ); */

  const reader = response.body?.pipeThrough(new TextDecoderStream()).getReader()
  return Promise.resolve(reader)

  /* while (true) {
    // eslint-disable-next-line no-await-in-loop
    const {value, done} = await reader!.read();
    if (done) break;
    const noSpacing = [",", ".", "!", '"', ";"].includes(value?.charAt(0))
    if (value) responseMessageData.body = responseMessageData.body.concat(noSpacing ? "" : " ", value)
  } */
}

export function updateLastMessage(userID: string, message: string) {
  const getConversationUrl = "https://us-central1-marriage-ai-289c6.cloudfunctions.net/getConversation";
  const config = {
    data: {userID}
  }
  mutate(
    [getConversationUrl, config],
    (currentData) => {
      console.log(currentData)
      const currentConversation: IChatConversation = currentData.result;

      currentConversation.messages[currentConversation.messages.length - 1].body = message

      return {...currentData};
    },
    false
  );
}

export async function converseWithAssistant2(userID: string, messageData: IChatMessage):
  Promise<SSE | undefined> {
  const getConversationUrl = "https://us-central1-marriage-ai-289c6.cloudfunctions.net/getConversation";
  const converseWithAssistantUrl = "https://us-central1-marriage-ai-289c6.cloudfunctions.net/converseWithAssistant";
  const config = {
    data: {userID}
  }

  /**
   * Work in local
   */
  mutate(
    [getConversationUrl, config],
    (currentData) => {
      const currentConversation: IChatConversation = currentData.result;

      const result = {
        ...currentConversation,
        messages: [...currentConversation.messages, messageData],
      };

      return {...currentData, result};
    },
    false
  );

  const message =
    {
      id: uuidv4(),
      senderId: "marriage-counselor",
      body: "",
      createdAt: (new Date()).toString(),
      contentType: "text",
      attachments: []
    }

  mutate(
    [getConversationUrl, config],
    (currentData) => {
      console.log(currentData)
      const currentConversation: IChatConversation = currentData.result;

      const result = {
        ...currentConversation,
        messages: [...currentConversation.messages, message],
      };

      return {...currentData, result};
    },
    false
  );

  const userMessage = messageData.body

  const source = new SSE(converseWithAssistantUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify({userID, userMessage})
  })

  return source
}

// ----------------------------------------------------------------------

export async function sendMessage(conversationId: string, messageData: IChatMessage) {
  const conversationsUrl = [CHART_ENDPOINT, {params: {endpoint: 'conversations'}}];

  const conversationUrl = [
    CHART_ENDPOINT,
    {params: {conversationId, endpoint: 'conversation'}},
  ];

  /**
   * Work on server
   */
  if (enableServer) {
    const data = {conversationId, messageData};
    await axios.put(CHART_ENDPOINT, data);
  }

  /**
   * Work in local
   */
  mutate(
    conversationUrl,
    (currentData) => {
      const currentConversation: IChatConversation = currentData.conversation;

      const conversation = {
        ...currentConversation,
        messages: [...currentConversation.messages, messageData],
      };

      return {...currentData, conversation};
    },
    false
  );

  mutate(
    conversationsUrl,
    (currentData) => {
      const currentConversations: IChatConversation[] = currentData.conversations;

      const conversations: IChatConversation[] = currentConversations.map(
        (conversation: IChatConversation) =>
          conversation.id === conversationId
            ? {...conversation, messages: [...conversation.messages, messageData]}
            : conversation
      );

      return {...currentData, conversations};
    },
    false
  );
}

// ----------------------------------------------------------------------

export async function createConversation(conversationData: IChatConversation) {
  const url = [CHART_ENDPOINT, {params: {endpoint: 'conversations'}}];

  /**
   * Work on server
   */
  const data = {conversationData};
  const res = await axios.post(CHART_ENDPOINT, data);

  /**
   * Work in local
   */
  mutate(
    url,
    (currentData) => {
      const currentConversations: IChatConversation[] = currentData.conversations;

      const conversations: IChatConversation[] = [...currentConversations, conversationData];

      return {...currentData, conversations};
    },
    false
  );

  return res.data;
}

// ----------------------------------------------------------------------

export async function clickConversation(conversationId: string) {
  /**
   * Work on server
   */
  if (enableServer) {
    await axios.get(CHART_ENDPOINT, {params: {conversationId, endpoint: 'mark-as-seen'}});
  }

  /**
   * Work in local
   */
  mutate(
    [CHART_ENDPOINT, {params: {endpoint: 'conversations'}}],
    (currentData) => {
      const currentConversations: IChatConversation[] = currentData.conversations;

      const conversations = currentConversations.map((conversation: IChatConversation) =>
        conversation.id === conversationId ? {...conversation, unreadCount: 0} : conversation
      );

      return {...currentData, conversations};
    },
    false
  );
}
