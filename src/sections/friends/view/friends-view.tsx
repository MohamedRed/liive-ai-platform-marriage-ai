import { useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Card from '@mui/material/Card';
import Tabs from '@mui/material/Tabs';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

import { useTabs } from 'src/hooks/use-tabs';
import { useMockedUser } from 'src/auth/hooks';
import { DashboardContent } from 'src/layouts/dashboard';
import type { IChatMessage, IChatParticipant, IChatConversations } from 'src/types/chat';
import { _userAbout, _userFeeds, _userFriends, _userGallery, _userFollowers } from 'src/_mock';

import { Iconify } from 'src/components/iconify';
import { EmptyContent } from 'src/components/empty-content';

import { Layout } from '../layout';
import { ChatNav } from '../chat/chat-nav';
import { ChatRoom } from '../chat/chat-room';
import { ChatMessageList } from '../chat/chat-message-list';
import { ChatMessageInput } from '../chat/chat-message-input';
import { ChatHeaderDetail } from '../chat/chat-header-detail';
import { ChatHeaderCompose } from '../chat/chat-header-compose';
import { useCollapseNav } from '../chat/hooks/use-collapse-nav';

import { ProfileHome } from '../profile/profile-home';
import { ProfileCover } from '../profile/profile-cover';
import { ProfileFriends } from '../profile/profile-friends';
import { ProfileGallery } from '../profile/profile-gallery';
import { ProfileFollowers } from '../profile/profile-followers';

// ----------------------------------------------------------------------

// Mock data for initial chat
const MOCK_MESSAGES: IChatMessage[] = [
  {
    id: '1',
    body: 'Hi there! 👋 Welcome to the Friends feature. Here you can chat with friends, get advice on building and maintaining friendships, and more.',
    senderId: 'friend-assistant',
    contentType: 'text',
    createdAt: new Date().toISOString(),
    attachments: [],
  },
  {
    id: '2',
    body: 'How can I help you with your friendships today?',
    senderId: 'friend-assistant',
    contentType: 'text',
    createdAt: new Date().toISOString(),
    attachments: [],
  },
];

const MOCK_PARTICIPANTS: IChatParticipant[] = [
  {
    id: 'friend-assistant',
    name: 'Friendship Assistant',
    role: 'assistant',
    email: 'assistant@liive.ai',
    address: '',
    avatarUrl: '/assets/avatars/avatar_25.jpg',
    phoneNumber: '',
    lastActivity: new Date().toISOString(),
    status: 'online',
  },
];

const MOCK_CONTACTS: IChatParticipant[] = Array.from({ length: 10 }, (_, index) => ({
  id: `${index}`,
  name: `Contact ${index}`,
  username: `user${index}`,
  avatarUrl: `/assets/avatars/avatar_${index + 1}.jpg`,
  status: (index % 3 === 0 ? 'online' : index % 3 === 1 ? 'offline' : 'busy') as 'online' | 'offline' | 'alway' | 'busy',
  role: 'friend',
  phoneNumber: '+1 000 000 0000',
  email: `user${index}@example.com`,
  address: '908 Jack Locks',
  lastActivity: new Date().toISOString(),
}));

const MOCK_CONVERSATIONS: IChatConversations = {
  byId: Object.fromEntries(
    Array.from({ length: 5 }, (_, index) => {
      const conversation = {
        id: `${index}`,
        type: index % 2 ? 'GROUP' : 'ONE_TO_ONE',
        unreadCount: index % 3,
        messages: [{
          id: `msg-${index}`,
          body: `This is a sample message ${index}`,
          contentType: 'text',
          attachments: [],
          createdAt: new Date().toISOString(),
          senderId: index % 2 ? 'friend-assistant' : `${index}`,
        }],
        participants: [
          {
            id: `${index}`,
            name: `Contact ${index}`,
            username: `user${index}`,
            avatarUrl: `/assets/avatars/avatar_${index + 1}.jpg`,
            status: 'online' as 'online' | 'offline' | 'alway' | 'busy',
            role: 'friend',
            phoneNumber: '+1 000 000 0000',
            email: `user${index}@example.com`,
            address: '908 Jack Locks',
            lastActivity: new Date().toISOString(),
          },
          {
            id: 'friend-assistant',
            name: 'Friendship Assistant',
            role: 'assistant',
            email: 'assistant@liive.ai',
            address: '',
            avatarUrl: '/assets/avatars/avatar_25.jpg',
            phoneNumber: '',
            lastActivity: new Date().toISOString(),
            status: 'online' as 'online' | 'offline' | 'alway' | 'busy',
          },
        ] as IChatParticipant[],
      };
      return [conversation.id, conversation];
    })
  ),
  allIds: Array.from({ length: 5 }, (_, index) => `${index}`),
};

// Profile tabs
const PROFILE_TABS = [
  { value: 'profile', label: 'Profile', icon: <Iconify icon="solar:user-id-bold" width={24} /> },
  { value: 'followers', label: 'Followers', icon: <Iconify icon="solar:heart-bold" width={24} /> },
  { value: 'friends', label: 'Friends', icon: <Iconify icon="solar:users-group-rounded-bold" width={24} /> },
  { value: 'gallery', label: 'Gallery', icon: <Iconify icon="solar:gallery-wide-bold" width={24} /> },
];

// Main tabs
const TABS = [
  { value: 'chat', label: 'Chat', icon: <Iconify icon="solar:chat-round-dots-bold" width={24} /> },
  { value: 'profile', label: 'Profile', icon: <Iconify icon="solar:user-id-bold" width={24} /> },
];

export function FriendsView() {
  const theme = useTheme();
  const { user } = useMockedUser();
  
  // Messages state
  const [messages, setMessages] = useState<IChatMessage[]>(MOCK_MESSAGES);
  const [participants, setParticipants] = useState<IChatParticipant[]>([
    ...MOCK_PARTICIPANTS,
    {
      id: `${user?.id}`,
      role: `${user?.role}`,
      email: `${user?.email}`,
      address: `${user?.address}`,
      name: `${user?.displayName}`,
      lastActivity: new Date().toISOString(),
      avatarUrl: `${user?.photoURL}`,
      phoneNumber: `${user?.phoneNumber}`,
      status: 'online',
    },
  ]);
  
  // Chat states
  const [contacts] = useState<IChatParticipant[]>(MOCK_CONTACTS);
  const [conversations] = useState<IChatConversations>(MOCK_CONVERSATIONS);
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [recipients, setRecipients] = useState<IChatParticipant[]>([]);
  
  // Navigation collapse
  const conversationsNav = useCollapseNav();
  const roomNav = useCollapseNav();
  
  // Main tabs
  const mainTabs = useTabs('chat');
  
  // Profile tabs
  const profileTabs = useTabs('profile');
  const [searchFriends, setSearchFriends] = useState('');
  
  // Get selected conversation
  const conversation = selectedConversationId ? conversations.byId[selectedConversationId] : null;
  
  // Handlers
  const handleSendMessage = (newMessage: IChatMessage) => {
    setMessages([...messages, newMessage]);
    
    // Simulate assistant response after a short delay
    setTimeout(() => {
      const assistantResponse: IChatMessage = {
        id: `msg-${Date.now()}`,
        body: "That's a great question about friendship! I'd be happy to help you with that.",
        senderId: 'friend-assistant',
        contentType: 'text',
        createdAt: new Date().toISOString(),
        attachments: [],
      };
      setMessages(prevMessages => [...prevMessages, assistantResponse]);
    }, 1000);
  };
  
  const handleAddRecipients = (newRecipients: IChatParticipant[]) => {
    setRecipients(newRecipients);
  };
  
  const handleSearchFriends = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchFriends(event.target.value);
  }, []);

  return (
    <DashboardContent
      maxWidth={false}
      sx={{ 
        display: 'flex', 
        flex: '1 1 auto', 
        flexDirection: 'column',
        py: { xs: 2, md: 3 },
      }}
    >
      <Typography variant="h4" sx={{ mb: { xs: 3, md: 5 } }}>
        Friends
      </Typography>
      
      <Box sx={{ mb: 3 }}>
        <Tabs value={mainTabs.value} onChange={mainTabs.onChange}>
          {TABS.map((tab) => (
            <Tab key={tab.value} value={tab.value} icon={tab.icon} label={tab.label} />
          ))}
        </Tabs>
      </Box>
      
      {mainTabs.value === 'chat' && (
        <Layout
          sx={{
            minHeight: 0,
            flex: '1 1 0',
            borderRadius: 2,
            position: 'relative',
            bgcolor: 'background.paper',
            boxShadow: (theme) => theme.customShadows.card,
          }}
          slots={{
            header: selectedConversationId ? (
              <ChatHeaderDetail
                collapseNav={roomNav}
                participants={conversation?.participants || []}
                loading={false}
              />
            ) : (
              <ChatHeaderCompose contacts={contacts} onAddRecipients={handleAddRecipients} />
            ),
            nav: (
              <ChatNav
                contacts={contacts}
                conversations={conversations}
                loading={false}
                selectedConversationId={selectedConversationId}
                collapseNav={conversationsNav}
              />
            ),
            main: (
              <>
                {selectedConversationId ? (
                  <ChatMessageList
                    messages={conversation?.messages || []}
                    participants={conversation?.participants || []}
                    loading={false}
                  />
                ) : (
                  <EmptyContent
                    imgUrl="/assets/icons/empty/ic-chat-active.svg"
                    title="Good morning!"
                    description="Talk to your friends or the Friendship Assistant..."
                  />
                )}

                <ChatMessageInput
                  recipients={recipients}
                  onAddRecipients={handleAddRecipients}
                  selectedConversationId={selectedConversationId}
                  disabled={!recipients.length && !selectedConversationId}
                  onSend={handleSendMessage}
                />
              </>
            ),
            details: selectedConversationId && (
              <ChatRoom
                collapseNav={roomNav}
                participants={conversation?.participants || []}
                loading={false}
                messages={conversation?.messages || []}
              />
            ),
          }}
        />
      )}
      
      {mainTabs.value === 'profile' && (
        <>
          <Card sx={{ mb: 3, height: 290 }}>
            <ProfileCover
              role={_userAbout.role}
              name={user?.displayName}
              avatarUrl={user?.photoURL}
              coverUrl={_userAbout.coverUrl}
            />

            <Box
              display="flex"
              justifyContent={{ xs: 'center', md: 'flex-end' }}
              sx={{
                width: 1,
                bottom: 0,
                zIndex: 9,
                px: { md: 3 },
                position: 'absolute',
                bgcolor: 'background.paper',
              }}
            >
              <Tabs value={profileTabs.value} onChange={profileTabs.onChange}>
                {PROFILE_TABS.map((tab) => (
                  <Tab key={tab.value} value={tab.value} icon={tab.icon} label={tab.label} />
                ))}
              </Tabs>
            </Box>
          </Card>

          {profileTabs.value === 'profile' && <ProfileHome info={_userAbout} posts={_userFeeds} />}

          {profileTabs.value === 'followers' && <ProfileFollowers followers={_userFollowers} />}

          {profileTabs.value === 'friends' && (
            <ProfileFriends
              friends={_userFriends}
              searchFriends={searchFriends}
              onSearchFriends={handleSearchFriends}
            />
          )}

          {profileTabs.value === 'gallery' && <ProfileGallery gallery={_userGallery} />}
        </>
      )}
    </DashboardContent>
  );
} 