import React, { useState, useEffect, useRef } from 'react';
import { 
  Box, 
  Button, 
  Container, 
  Divider, 
  FormControl,
  IconButton, 
  InputAdornment, 
  InputLabel,
  MenuItem,
  Paper, 
  Select,
  SelectChangeEvent,
  Snackbar, 
  Stack, 
  Tab, 
  Tabs, 
  TextField, 
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Grid,
  List,
  ListItem,
  ListItemText,
  Alert
} from '@mui/material';
import { TabPanel as MuiLabTabPanel } from '@mui/lab';
import ClearIcon from '@mui/icons-material/Clear';
import ArrowCircleRightIcon from '@mui/icons-material/ArrowCircleRight';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useSettingsContext } from 'src/components/settings';
import { useAuthContext } from 'src/auth/hooks';

// Icons
import SmartphoneIcon from '@mui/icons-material/Smartphone';
import WifiIcon from '@mui/icons-material/Wifi';
import SignalCellularAltIcon from '@mui/icons-material/SignalCellularAlt';
import BatteryFullIcon from '@mui/icons-material/BatteryFull';

// Define the interface for Claude Code response
interface ClaudeCodeResponse {
  success: boolean;
  result?: string;
  error?: string;
  jobId?: number;
  message?: string;
}

// Define interface for job status
interface JobStatus {
  id: number;
  command: string;
  status: 'running' | 'completed' | 'failed';
  startTime: string;
  endTime?: string;
  result?: string;
  error?: string;
  success?: boolean;
}

// Define interface for job response
interface JobStatusResponse {
  success: boolean;
  job: JobStatus;
  error?: string;
}

// Add interface for app
interface App {
  name: string;
  status: 'running' | 'hibernated' | 'stopped' | 'provisioning' | 'failed';
  url?: string;
  createdAt?: string;
  error?: string;
}

export function BuilderAIView() {
  const { user } = useAuthContext();
  const settings = useSettingsContext();
  
  // State variables
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState<Array<{ command: string; response: ClaudeCodeResponse }>>([]);
  const [loading, setLoading] = useState(false);
  const [currentTab, setCurrentTab] = useState(0);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [serviceUrl, setServiceUrl] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'info'
  });
  // Add new state for current job
  const [currentJob, setCurrentJob] = useState<{ jobId: number; pollInterval?: NodeJS.Timeout } | null>(null);
  // Add state for job execution time
  const [jobRuntime, setJobRuntime] = useState<number>(0);
  const [jobCommand, setJobCommand] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<number | null>(null);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null);

  // New state for multi-tenancy
  const [userApps, setUserApps] = useState<App[]>([]);
  const [currentApp, setCurrentApp] = useState<string | null>(null);
  const [loadingApps, setLoadingApps] = useState(false);
  const [appDialogOpen, setAppDialogOpen] = useState(false);
  const [newAppName, setNewAppName] = useState('');
  const [creatingApp, setCreatingApp] = useState(false);
  const [userManagementApiUrl, setUserManagementApiUrl] = useState(() => {
    return localStorage.getItem('userManagementApiUrl') || 'https://user-management-service-65sz33xica-uc.a.run.app';
  });
  const outputRef = useRef<HTMLDivElement>(null);

  // Common commands
  const commonCommands = [
    { label: 'Analyze Code', value: 'analyze', description: 'Analyze code structure and quality' },
    { label: 'Fix Bugs', value: 'fix', description: 'Identify and fix bugs in code' },
    { label: 'Add Feature', value: 'add-feature', description: 'Add a new feature' },
    { label: 'Generate Tests', value: 'generate-tests', description: 'Generate test cases' },
    { label: 'Refactor', value: 'refactor', description: 'Improve code structure' },
  ];

  // Load service URL from localStorage or environment
  useEffect(() => {
    const savedUrl = localStorage.getItem('claudeCodeServiceUrl');
    if (savedUrl) {
      setServiceUrl(savedUrl);
    } else {
      // If no saved URL, you might want to prompt the user to provide one
      // or use an environment variable
      const envUrl = "";
      if (envUrl) {
        setServiceUrl(envUrl);
      }
    }
  }, []);

  // Load user's apps on component mount
  useEffect(() => {
    if (user) {
      loadUserApps();
    }
  }, [user]);

  // Function to load user's apps
  const loadUserApps = async () => {
    if (!user) return;
    
    try {
      setLoadingApps(true);
      const token = await user.getIdToken();
      
      const response = await fetch(`${userManagementApiUrl}/api/users/${user.uid}/apps`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to load apps');
      }
      
      const apps = await response.json();
      setUserApps(apps);
      
      // Select first running app by default if none selected
      if (apps.length > 0 && !currentApp) {
        const runningApp = apps.find((app: App) => app.status === 'running');
        if (runningApp) {
          setCurrentApp(runningApp.name);
        } else if (apps[0]) {
          setCurrentApp(apps[0].name);
        }
      }
    } catch (error) {
      console.error('Error loading apps:', error);
      setSnackbar({
        open: true,
        message: 'Failed to load your apps. Please try again.',
        severity: 'error'
      });
    } finally {
      setLoadingApps(false);
    }
  };

  // Function to create a new app
  const handleCreateApp = async () => {
    if (!user || !newAppName.trim()) return;
    
    try {
      setCreatingApp(true);
      const token = await user.getIdToken();
      
      const response = await fetch(`${userManagementApiUrl}/api/users/${user.uid}/apps`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newAppName,
          type: 'marriage-ai'
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create app');
      }
      
      const newApp = await response.json();
      setUserApps(prev => [...prev, newApp]);
      setCurrentApp(newApp.name);
      setNewAppName('');
      setAppDialogOpen(false);
      
      setSnackbar({
        open: true,
        message: `App "${newApp.name}" created successfully.`,
        severity: 'success'
      });
    } catch (error) {
      console.error('Error creating app:', error);
      setSnackbar({
        open: true,
        message: `Error creating app: ${error.message}`,
        severity: 'error'
      });
    } finally {
      setCreatingApp(false);
    }
  };

  // Function to hibernate an app
  const handleHibernateApp = async (appName: string) => {
    if (!user) return;
    
    try {
      const token = await user.getIdToken();
      
      const response = await fetch(`${userManagementApiUrl}/api/users/${user.uid}/apps/${appName}/hibernate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to hibernate app');
      }
      
      await loadUserApps();
      
      setSnackbar({
        open: true,
        message: `App "${appName}" hibernated.`,
        severity: 'success'
      });
    } catch (error) {
      console.error('Error hibernating app:', error);
      setSnackbar({
        open: true,
        message: `Error hibernating app: ${error.message}`,
        severity: 'error'
      });
    }
  };

  // Function to wake up an app
  const handleWakeApp = async (appName: string) => {
    if (!user) return;
    
    try {
      const token = await user.getIdToken();
      
      const response = await fetch(`${userManagementApiUrl}/api/users/${user.uid}/apps/${appName}/wake`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to wake app');
      }
      
      await loadUserApps();
      
      setSnackbar({
        open: true,
        message: `App "${appName}" is waking up.`,
        severity: 'success'
      });
    } catch (error) {
      console.error('Error waking app:', error);
      setSnackbar({
        open: true,
        message: `Error waking app: ${error.message}`,
        severity: 'error'
      });
    }
  };

  // Function to delete an app
  const handleDeleteApp = async (appName: string) => {
    if (!user || !window.confirm(`Are you sure you want to delete ${appName}?`)) return;
    
    try {
      const token = await user.getIdToken();
      
      const response = await fetch(`${userManagementApiUrl}/api/users/${user.uid}/apps/${appName}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete app');
      }
      
      if (currentApp === appName) {
        setCurrentApp(null);
      }
      
      await loadUserApps();
      
      setSnackbar({
        open: true,
        message: `App "${appName}" deleted.`,
        severity: 'success'
      });
    } catch (error) {
      console.error('Error deleting app:', error);
      setSnackbar({
        open: true,
        message: `Error deleting app: ${error.message}`,
        severity: 'error'
      });
    }
  };

  // Handle app selection change
  const handleAppChange = (event: SelectChangeEvent<string>) => {
    setCurrentApp(event.target.value);
  };

  // Scroll to bottom of output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [previewContent]);

  // Service URL handling
  const handleServiceUrlChange = (url: string) => {
    setServiceUrl(url);
    localStorage.setItem('claudeCodeServiceUrl', url);
  };

  // User Management API URL handling
  const handleUserManagementApiUrlChange = (url: string) => {
    setUserManagementApiUrl(url);
    localStorage.setItem('userManagementApiUrl', url);
  };

  // Job polling for asynchronous commands
  const startPolling = (jobId: string) => {
    // Clear any existing interval
    if (pollInterval) {
      clearInterval(pollInterval);
    }
    
    const interval = setInterval(async () => {
      if (!user) return;
      
      try {
        const token = await user.getIdToken();
        const response = await fetch(`${serviceUrl}/job-status/${jobId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          console.error('Error checking job status');
          return;
        }
        
        const statusData = await response.json();
        
        if (statusData.success && statusData.job) {
          // Update output with latest data
          const { job } = statusData;
          
          if (job.output) {
            setPreviewContent(job.output);
          }
          
          if (job.error) {
            setSnackbar({
              open: true,
              message: `Error: ${job.error}`,
              severity: 'error'
            });
          }
          
          // Handle job completion
          if (job.status === 'completed' || job.status === 'failed') {
            clearInterval(interval);
            setPollInterval(null);
            setCurrentJobId(null);
            setLoading(false);
            
            // Update history
            setHistory(prev => [
              ...prev,
              {
                command: job.command,
                response: {
                  success: job.status === 'completed',
                  result: job.output,
                  error: job.error
                }
              }
            ]);
            
            // Clear countdown timer
            if (timerInterval) {
              clearInterval(timerInterval);
              setTimerInterval(null);
            }
            setElapsedTime(0);
          }
        }
      } catch (error) {
        console.error('Error polling job status:', error);
      }
    }, 2000); // Poll every 2 seconds
    
    setPollInterval(interval);
  };

  // Run command
  const executeCommand = async () => {
    if (!user) {
      setSnackbar({
        open: true,
        message: 'You must be logged in to execute commands',
        severity: 'error'
      });
      return;
    }
    
    if (!currentApp) {
      setSnackbar({
        open: true,
        message: 'Please select an app first',
        severity: 'error'
      });
      return;
    }
    
    try {
      setLoading(true);
      setPreviewContent('');
      setSnackbar({
        open: true,
        message: 'Command submitted. Waiting for results...',
        severity: 'info'
      });
      
      const token = await user.getIdToken();
      const response = await fetch(`${serviceUrl}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          command,
          appName: currentApp
        })
      });
      
      const data = await response.json();
      
      if (data.success && data.jobId) {
        // Handle asynchronous execution
        setCurrentJobId(data.jobId);
        setJobCommand(command);
        startPolling(data.jobId.toString());
        startTimer();
      } else {
        // Handle immediate failure
        setLoading(false);
        setSnackbar({
          open: true,
          message: data.error || 'Failed to execute command',
          severity: 'error'
        });
        
        setHistory(prev => [
          ...prev,
          {
            command,
            response: {
              success: false,
              error: data.error || 'Failed to execute command'
            }
          }
        ]);
      }
    } catch (error) {
      setLoading(false);
      setSnackbar({
        open: true,
        message: `Error: ${error.message}`,
        severity: 'error'
      });
      
      setHistory(prev => [
        ...prev,
        {
          command,
          response: {
            success: false,
            error: `Error: ${error.message}`
          }
        }
      ]);
    }
  };

  // Original interval timer
  const startTimer = () => {
    if (timerInterval) {
      clearInterval(timerInterval);
    }
    setElapsedTime(0);
    
    const interval = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);
    
    setTimerInterval(interval);
  };

  // Cancel a running command
  const handleCancelCommand = async () => {
    if (!currentJobId || !user) return;
    
    // Clear polling interval
    if (pollInterval) {
      clearInterval(pollInterval);
      setPollInterval(null);
    }
    
    // Clear countdown timer
    if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }
    
    setCurrentJobId(null);
    setLoading(false);
    setElapsedTime(0);
    setPreviewContent(prev => `${prev}\n\nCommand execution cancelled by user.`);
    
    try {
      // If there's a cancel endpoint, call it
      const token = await user.getIdToken();
      await fetch(`${serviceUrl}/cancel-job/${currentJobId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }).catch(e => console.error('Error cancelling job:', e));
    } catch (error) {
      console.error('Error cancelling command:', error);
    }
  };

  // Handle form submission (original with modifications)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!command.trim()) return;
    
    if (loading) {
      setSnackbar({
        open: true,
        message: 'A command is already running. Please wait or cancel it.',
        severity: 'info'
      });
      return;
    }
    
    if (!currentApp) {
      setSnackbar({
        open: true,
        message: 'Please select an app first',
        severity: 'error'
      });
      return;
    }
    
    await executeCommand();
  };

  // Handle common commands
  const handleCommonCommandClick = (cmdPrefix: string) => {
    setCommand(prev => {
      if (prev && !prev.endsWith(' ')) {
        return `${prev} ${cmdPrefix}`;
      }
      return `${prev}${cmdPrefix}`;
    });
  };

  // Copy to clipboard
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => {
        setSnackbar({
          open: true,
          message: 'Copied to clipboard!',
          severity: 'success'
        });
      },
      () => {
        setSnackbar({
          open: true,
          message: 'Failed to copy!',
          severity: 'error'
        });
      }
    );
  };

  // Tab handling
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  // Snackbar closing
  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  // Format time
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Clear history
  const handleClearHistory = () => {
    setHistory([]);
  };

  // Render the app selector and management UI
  const renderAppSelector = () => (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Typography variant="h6" gutterBottom>
        App Selection
      </Typography>
      
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
        <FormControl fullWidth>
          <InputLabel id="app-selector-label">Current App</InputLabel>
          <Select
            labelId="app-selector-label"
            value={currentApp || ''}
            onChange={handleAppChange}
            disabled={loadingApps || userApps.length === 0}
          >
            {userApps.map((app: App) => (
              <MenuItem key={app.name} value={app.name}>
                {app.name} ({app.status})
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setAppDialogOpen(true)}
        >
          New App
        </Button>
      </Stack>
      
      {currentApp && (
        <Box sx={{ mt: 1 }}>
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            {userApps.find(app => app.name === currentApp)?.status === 'running' ? (
              <Button
                size="small"
                startIcon={<PauseIcon />}
                onClick={() => handleHibernateApp(currentApp)}
                color="warning"
              >
                Hibernate
              </Button>
            ) : (
              <Button
                size="small"
                startIcon={<PlayArrowIcon />}
                onClick={() => handleWakeApp(currentApp)}
                color="success"
              >
                Wake Up
              </Button>
            )}
            
            <Button
              size="small"
              startIcon={<DeleteIcon />}
              onClick={() => handleDeleteApp(currentApp)}
              color="error"
            >
              Delete
            </Button>
          </Stack>
        </Box>
      )}
      
      {/* Create App Dialog */}
      <Dialog open={appDialogOpen} onClose={() => setAppDialogOpen(false)}>
        <DialogTitle>Create New App</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="App Name"
            fullWidth
            value={newAppName}
            onChange={(e) => setNewAppName(e.target.value)}
            disabled={creatingApp}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAppDialogOpen(false)} disabled={creatingApp}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreateApp} 
            disabled={!newAppName.trim() || creatingApp}
            variant="contained"
          >
            {creatingApp ? <CircularProgress size={24} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );

  // Command input rendering (modified original)
  const renderCommandInput = () => {
    const selectedApp = userApps.find(app => app.name === currentApp);
    const isAppNotRunning = selectedApp && selectedApp.status !== 'running';
    
    return (
      <Box component="form" onSubmit={handleSubmit} sx={{ mb: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Enter Claude Code command:
        </Typography>
        
        <TextField
          fullWidth
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="Enter a command..."
          disabled={loading || !currentApp || isAppNotRunning}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                {command && (
                  <IconButton onClick={() => setCommand('')} edge="end">
                    <ClearIcon />
                  </IconButton>
                )}
              </InputAdornment>
            ),
          }}
          multiline
          sx={{ mb: 1 }}
        />
        
        <Stack direction="row" spacing={1} justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => handleCommonCommandClick('ls -la')}
              disabled={loading || !currentApp || isAppNotRunning}
            >
              ls -la
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={() => handleCommonCommandClick('git status')}
              disabled={loading || !currentApp || isAppNotRunning}
            >
              git status
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={() => handleCommonCommandClick('yarn dev')}
              disabled={loading || !currentApp || isAppNotRunning}
            >
              yarn dev
            </Button>
          </Stack>
          
          <Stack direction="row" spacing={1}>
            {loading ? (
              <>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Running... {formatTime(elapsedTime)}
                </Typography>
                <Button
                  variant="contained"
                  color="error"
                  onClick={handleCancelCommand}
                  startIcon={<ClearIcon />}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                type="submit"
                variant="contained"
                endIcon={<ArrowCircleRightIcon />}
                disabled={!command.trim() || !currentApp || isAppNotRunning}
              >
                Execute
              </Button>
            )}
          </Stack>
        </Stack>
        
        {isAppNotRunning && (
          <Typography variant="body2" color="error" sx={{ mt: 1 }}>
            App is not running. Wake it up to execute commands.
          </Typography>
        )}
      </Box>
    );
  };

  // Render command history item
  const renderHistoryItem = (item: { command: string; response: ClaudeCodeResponse }, index: number) => {
    return (
      <Paper key={index} sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Typography variant="subtitle1" fontFamily="monospace">
            $ {item.command}
          </Typography>
          <IconButton onClick={() => handleCopy(item.command)} size="small">
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </Stack>
        
        <Divider sx={{ mb: 1 }} />
        
        {item.response.success ? (
          <Box
            sx={{
              p: 2, 
              borderRadius: 1, 
              bgcolor: 'success.lighter', 
              color: 'success.main',
              mb: 2
            }}
          >
            Command executed successfully
          </Box>
        ) : (
          <Box
            sx={{ 
              p: 2, 
              borderRadius: 1, 
              bgcolor: 'error.lighter', 
              color: 'error.main',
              mb: 2
            }}
          >
            {item.response.error || 'Unknown error'}
          </Box>
        )}
      </Paper>
    );
  };

  // Main render
  return (
    <Box sx={{ my: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Builder AI
      </Typography>
      <Typography variant="subtitle1" gutterBottom>
        Create and customize your own AI applications using Claude Code
      </Typography>

      {/* Service URL Configuration */}
      <Paper elevation={2} sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          Claude Code Service URL
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <TextField
            fullWidth
            size="small"
            placeholder="https://claude-code-service-xxx.run.app"
            value={serviceUrl || ''}
            onChange={(e) => handleServiceUrlChange(e.target.value)}
            sx={{ mr: 2 }}
          />
          <Button 
            variant="outlined" 
            startIcon={<RefreshIcon />}
            onClick={() => {
              // Test connection
              if (!serviceUrl) {
                setSnackbar({
                  open: true,
                  message: 'Please enter a service URL first',
                  severity: 'error'
                });
                return;
              }
              
              fetch(`${serviceUrl}/version`)
                .then(response => response.json())
                .then(data => {
                  setSnackbar({
                    open: true,
                    message: data.success ? 'Connection successful' : `Connection failed: ${data.error || 'Unknown error'}`,
                    severity: data.success ? 'success' : 'error'
                  });
                })
                .catch(error => {
                  setSnackbar({
                    open: true,
                    message: `Connection failed: ${error.message}`,
                    severity: 'error'
                  });
                });
            }}
          >
            Test
          </Button>
        </Box>
      </Paper>

      <Grid container spacing={3}>
        {/* Command Input and Common Commands */}
        <Grid item xs={12} md={3}>
          <Paper elevation={3} sx={{ p: 3, height: '600px', overflow: 'auto' }}>
            <Typography variant="h6" gutterBottom>
              Command Input
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            {renderAppSelector()}
            
            {renderCommandInput()}
            
            <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
              Common Commands
            </Typography>
            <List dense>
              {commonCommands.map((cmd) => (
                <ListItem 
                  key={cmd.value} 
                  button
                  onClick={() => handleCommonCommandClick(cmd.value)}
                  disabled={loading}
                >
                  <ListItemText 
                    primary={cmd.label} 
                    secondary={cmd.description}
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>
        
        {/* Command History Section */}
        <Grid item xs={12} md={5}>
          <Paper elevation={3} sx={{ p: 2, height: '600px' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="subtitle1">
                Command History
              </Typography>
              <Button 
                size="small" 
                onClick={handleClearHistory}
                disabled={history.length === 0}
              >
                Clear History
              </Button>
            </Box>
            
            <Box sx={{ height: 'calc(100% - 40px)', overflow: 'auto' }}>
              {history.length === 0 ? (
                <Box sx={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center',
                  height: '100%',
                  color: 'text.secondary'
                }}>
                  <Typography variant="body2">
                    No commands executed yet. Use the command input to get started.
                  </Typography>
                </Box>
              ) : (
                <List>
                  {[...history].reverse().map((item, index) => renderHistoryItem(item, index))}
                </List>
              )}
            </Box>
          </Paper>
        </Grid>
        
        {/* Mobile Preview Section */}
        <Grid item xs={12} md={4}>
          <Paper elevation={3} sx={{ p: 2, height: '600px' }}>
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="subtitle1">
                Mobile Preview
              </Typography>
              <Button 
                size="small" 
                startIcon={<RefreshIcon />}
                onClick={async () => {
                  try {
                    await executeCommand();
                    setLoading(false);
                  } catch (error) {
                    console.error('Error refreshing preview:', error);
                    setLoading(false);
                    setSnackbar({
                      open: true,
                      message: 'Error refreshing preview',
                      severity: 'error'
                    });
                  }
                }}
              >
                Refresh Preview
              </Button>
            </Box>
            
            {/* Mobile Phone Preview Container */}
            <Box sx={{ 
              display: 'flex',
              justifyContent: 'center', 
              alignItems: 'center',
              height: 'calc(100% - 40px)' 
            }}>
              <Box sx={{ 
                width: '240px',
                height: '420px',
                borderRadius: '24px',
                border: '10px solid #333',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0px 0px 15px rgba(0,0,0,0.2)',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: '#fff'
              }}>
                {/* Mobile Status Bar */}
                <Box sx={{ 
                  height: '24px', 
                  backgroundColor: '#f5f5f5', 
                  borderBottom: '1px solid #ddd',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  px: 1,
                  fontSize: '10px'
                }}>
                  <Box sx={{ fontSize: '10px', fontWeight: 'bold' }}>
                    12:30
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <SignalCellularAltIcon sx={{ fontSize: 12, mr: 0.5 }} />
                    <WifiIcon sx={{ fontSize: 12, mr: 0.5 }} />
                    <BatteryFullIcon sx={{ fontSize: 12 }} />
                  </Box>
                </Box>
                
                {/* Mobile Content Area */}
                <Box sx={{ 
                  flexGrow: 1,
                  overflow: 'auto',
                  backgroundColor: '#fff',
                  p: 1
                }}>
                  {loading ? (
                    <Box sx={{ 
                      display: 'flex', 
                      justifyContent: 'center', 
                      alignItems: 'center',
                      height: '100%'
                    }}>
                      <CircularProgress size={24} />
                    </Box>
                  ) : previewContent ? (
                    <Box component="pre" sx={{ 
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'monospace',
                      margin: 0,
                      fontSize: '10px'
                    }}>
                      {previewContent}
                    </Box>
                  ) : (
                    <Box sx={{ 
                      display: 'flex', 
                      flexDirection: 'column',
                      justifyContent: 'center', 
                      alignItems: 'center',
                      height: '100%',
                      color: 'text.secondary'
                    }}>
                      <SmartphoneIcon sx={{ fontSize: 32, mb: 1 }} />
                      <Typography variant="caption" align="center">
                        No preview available. Execute a command that modifies code to see a preview.
                      </Typography>
                    </Box>
                  )}
                </Box>
                
                {/* Home Button/Bar */}
                <Box sx={{ 
                  height: '20px',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderTop: '1px solid #ddd',
                  backgroundColor: '#f5f5f5'
                }}>
                  <Box sx={{ 
                    width: '40px', 
                    height: '4px', 
                    backgroundColor: '#ddd', 
                    borderRadius: '2px' 
                  }} />
                </Box>
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>
      
      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default BuilderAIView; 