import { useState, useEffect, useCallback } from 'react';
import { 
  Box, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  Typography, 
  IconButton, 
  Stack,
  Paper,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

interface VoiceAssistantProps {
  open: boolean;
  onClose: () => void;
}

const StyledPulse = styled('div')(({ theme }) => ({
  position: 'relative',
  width: 80,
  height: 80,
  borderRadius: '50%',
  backgroundColor: theme.palette.primary.main,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  '&::after': {
    content: '""',
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    backgroundColor: theme.palette.primary.main,
    opacity: 0.6,
    animation: 'pulse 1.5s infinite',
  },
  '@keyframes pulse': {
    '0%': {
      transform: 'scale(1)',
      opacity: 0.6,
    },
    '70%': {
      transform: 'scale(1.5)',
      opacity: 0,
    },
    '100%': {
      transform: 'scale(1.5)',
      opacity: 0,
    },
  },
}));

const VOICE_COMMANDS = [
  { command: 'Next step', description: 'Move to the next cooking step', icon: 'mdi:arrow-right' },
  { command: 'Previous step', description: 'Go back to the previous step', icon: 'mdi:arrow-left' },
  { command: 'Repeat', description: 'Repeat the current step instructions', icon: 'mdi:replay' },
  { command: 'Pause video', description: 'Pause the cooking video', icon: 'mdi:pause' },
  { command: 'Play video', description: 'Resume the cooking video', icon: 'mdi:play' },
  { command: 'How much', description: 'Ask about ingredient quantities', icon: 'mdi:scale' },
  { command: 'Timer', description: 'Set a cooking timer', icon: 'mdi:timer' },
  { command: 'Ingredients', description: 'List all ingredients', icon: 'mdi:food-apple' },
  { command: 'Close', description: 'Close the voice assistant', icon: 'mdi:close' },
];

export function VoiceAssistant({ open, onClose }: VoiceAssistantProps) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');

  // Simulate voice recognition
  useEffect(() => {
    if (open) {
      setListening(true);
      setResponse('Hi there! I\'m your cooking assistant. How can I help you?');
    } else {
      setListening(false);
      setTranscript('');
      setResponse('');
    }
  }, [open]);

  // Simulate processing voice commands
  const processVoiceCommand = useCallback((command: string) => {
    const lowerCommand = command.toLowerCase();
    
    if (lowerCommand.includes('next step')) {
      setResponse('Moving to the next step.');
      // Here we would trigger the next step function
    } else if (lowerCommand.includes('previous') || lowerCommand.includes('back')) {
      setResponse('Going back to the previous step.');
      // Here we would trigger the previous step function
    } else if (lowerCommand.includes('repeat')) {
      setResponse('Repeating the current step.');
      // Here we would trigger the repeat function
    } else if (lowerCommand.includes('pause')) {
      setResponse('Pausing the video.');
      // Here we would trigger the pause function
    } else if (lowerCommand.includes('play') || lowerCommand.includes('resume')) {
      setResponse('Playing the video.');
      // Here we would trigger the play function
    } else if (lowerCommand.includes('close') || lowerCommand.includes('exit')) {
      setResponse('Closing voice assistant.');
      setTimeout(onClose, 1000);
    } else {
      setResponse('I didn\'t understand that command. Please try again.');
    }
  }, [onClose]);

  // Simulate receiving voice input
  const handleMockVoiceInput = useCallback((mockCommand: string) => {
    setTranscript(mockCommand);
    processVoiceCommand(mockCommand);
  }, [processVoiceCommand]);

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          boxShadow: (theme) => theme.shadows[24],
        },
      }}
    >
      <DialogTitle>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">Voice Assistant</Typography>
          <IconButton onClick={onClose} edge="end">
            <Iconify icon="mdi:close" />
          </IconButton>
        </Stack>
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
          <StyledPulse>
            <Iconify icon="mdi:microphone" width={40} height={40} sx={{ color: 'white', zIndex: 1 }} />
          </StyledPulse>
          
          <Typography variant="subtitle1" sx={{ mt: 2, fontWeight: 'bold' }}>
            {listening ? 'Listening...' : 'Voice Assistant'}
          </Typography>
          
          {transcript && (
            <Paper 
              sx={{ 
                p: 2, 
                mt: 2, 
                width: '100%', 
                bgcolor: 'background.neutral',
                borderRadius: 2,
              }}
            >
              <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                "{transcript}"
              </Typography>
            </Paper>
          )}
          
          {response && (
            <Paper 
              sx={{ 
                p: 2, 
                mt: 2, 
                width: '100%', 
                bgcolor: 'primary.lighter',
                borderRadius: 2,
                border: (theme) => `1px solid ${theme.palette.primary.light}`,
              }}
            >
              <Typography variant="body1" color="primary.darker">
                {response}
              </Typography>
            </Paper>
          )}
        </Box>
        
        <Divider sx={{ my: 3 }} />
        
        <Typography variant="subtitle1" gutterBottom>
          Available Voice Commands
        </Typography>
        
        <List dense>
          {VOICE_COMMANDS.map((cmd, index) => (
            <ListItem 
              key={index} 
              button 
              onClick={() => handleMockVoiceInput(cmd.command)}
              sx={{ 
                borderRadius: 1,
                '&:hover': {
                  bgcolor: 'background.neutral',
                },
              }}
            >
              <ListItemIcon>
                <Iconify icon={cmd.icon} width={24} height={24} />
              </ListItemIcon>
              <ListItemText 
                primary={cmd.command} 
                secondary={cmd.description} 
              />
            </ListItem>
          ))}
        </List>
      </DialogContent>
    </Dialog>
  );
} 