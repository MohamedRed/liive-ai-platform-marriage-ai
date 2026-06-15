import { useState, useCallback, useRef, Fragment } from 'react';
import { 
  Card, 
  Box, 
  Stack, 
  TextField, 
  Typography, 
  Button, 
  Divider, 
  IconButton,
  CardContent,
  CardHeader,
  Grid,
  InputAdornment,
  CardActions,
  Avatar,
  ImageList,
  ImageListItem,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Fade,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  Alert
} from '@mui/material';
import { TransitionGroup, CSSTransition } from 'react-transition-group';
import { Iconify } from 'src/components/iconify';
import { LoadingButton } from '@mui/lab';

// ----------------------------------------------------------------------

interface MealPlanInputProps {
  onSubmit: (data: { description: string; videoUrls?: string[]; imageFiles?: File[] }) => void;
  loading: boolean;
}

// Add a type for position tracking
interface PositionMap {
  [key: string]: DOMRect;
}

// ----------------------------------------------------------------------

export function MealPlanInput({ onSubmit, loading }: MealPlanInputProps) {
  const [description, setDescription] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoUrls, setVideoUrls] = useState<Array<{url: string; id: string}>>([]);
  const [uploadedImages, setUploadedImages] = useState<Array<{file: File; id: string}>>([]);
  const [previewImages, setPreviewImages] = useState<Array<{url: string; id: string}>>([]);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [embedError, setEmbedError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  // Add a reference object to track grid item positions
  const gridItemsRef = useRef<{[key: string]: HTMLDivElement | null}>({});

  // Add position tracking function
  const trackItemPositions = useCallback(() => {
    const positions: PositionMap = {};
    
    // Record current positions of all items
    Object.keys(gridItemsRef.current).forEach(id => {
      const element = gridItemsRef.current[id];
      if (element) {
        positions[id] = element.getBoundingClientRect();
      }
    });
    
    return positions;
  }, []);
  
  const handleSubmit = useCallback(() => {
    if (!description) return;
    
    onSubmit({
      description,
      videoUrls: videoUrls.length > 0 ? videoUrls.map(v => v.url) : undefined,
      imageFiles: uploadedImages.length > 0 ? uploadedImages.map(i => i.file) : undefined,
    });
  }, [description, videoUrls, uploadedImages, onSubmit]);

  const handleAddVideo = useCallback(() => {
    if (!videoUrl.trim()) return;
    
    // Simple validation to ensure it's a URL
    try {
      // Add protocol if missing
      let urlToAdd = videoUrl;
      if (!urlToAdd.startsWith('http://') && !urlToAdd.startsWith('https://')) {
        urlToAdd = 'https://' + urlToAdd;
      }
      
      // Try to parse it as a URL to validate
      new URL(urlToAdd);
      
      // Add a unique ID to the video URL
      setVideoUrls(prev => [...prev, { url: urlToAdd, id: `video-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` }]);
      setVideoUrl('');
    } catch (error) {
      // Invalid URL format
      console.error('Invalid URL format');
      // In a real app, you'd show an error message to the user
    }
  }, [videoUrl]);

  const handleVideoKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddVideo();
    }
  }, [handleAddVideo]);

  // Update the removeVideo function to include animation
  const removeVideo = useCallback((id: string) => {
    // Store current positions
    const startPositions = trackItemPositions();
    
    // Remove the item
    setVideoUrls(prev => prev.filter(item => item.id !== id));
    
    // After DOM update, animate remaining items
    setTimeout(() => {
      // Get new positions
      const endPositions = trackItemPositions();
      
      // Animate each item from its old position to new position
      Object.keys(endPositions).forEach(itemId => {
        const element = gridItemsRef.current[itemId];
        if (!element || !startPositions[itemId]) return;
        
        const startPos = startPositions[itemId];
        const endPos = endPositions[itemId];
        
        // Calculate the difference in position
        const deltaX = startPos.left - endPos.left;
        const deltaY = startPos.top - endPos.top;
        
        // Only animate if it actually needs to move
        if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
          // Apply subtle transform without dramatic effects
          element.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
          element.style.transition = 'none';
          
          // Force reflow
          element.offsetHeight;
          
          // Now animate to final position with a subtle effect
          element.style.transform = '';
          element.style.transition = 'transform 0.5s ease-out';
          element.style.backgroundColor = 'rgba(0, 0, 0, 0.02)';
          
          // Clear subtle effects after animation
          setTimeout(() => {
            element.style.backgroundColor = '';
          }, 500);
        }
      });
    }, 10);
  }, [trackItemPositions]);

  const handleImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    
    // Process each file and create previews
    Array.from(files).forEach(file => {
      const fileId = `image-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      // Add the file with a unique ID
      setUploadedImages(prevImages => [...prevImages, { file, id: fileId }]);
      
      // Create a preview URL for the image
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setPreviewImages(prevPreviews => [
            ...prevPreviews, 
            { url: e.target!.result as string, id: fileId }
          ]);
        }
      };
      reader.readAsDataURL(file);
    });
    
    // Reset the file input to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleClickUpload = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, []);

  // Update the removeImage function to include animation
  const removeImage = useCallback((id: string) => {
    // Store current positions
    const startPositions = trackItemPositions();
    
    // Remove the item
    setUploadedImages(prevImages => prevImages.filter(item => item.id !== id));
    setPreviewImages(prevPreviews => prevPreviews.filter(item => item.id !== id));
    
    // After DOM update, animate remaining items
    setTimeout(() => {
      // Get new positions
      const endPositions = trackItemPositions();
      
      // Animate each item from its old position to new position
      Object.keys(endPositions).forEach(itemId => {
        const element = gridItemsRef.current[itemId];
        if (!element || !startPositions[itemId]) return;
        
        const startPos = startPositions[itemId];
        const endPos = endPositions[itemId];
        
        // Calculate the difference in position
        const deltaX = startPos.left - endPos.left;
        const deltaY = startPos.top - endPos.top;
        
        // Only animate if it actually needs to move
        if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
          // Apply subtle transform without dramatic effects
          element.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
          element.style.transition = 'none';
          
          // Force reflow
          element.offsetHeight;
          
          // Now animate to final position with a subtle effect
          element.style.transform = '';
          element.style.transition = 'transform 0.5s ease-out';
          element.style.backgroundColor = 'rgba(0, 0, 0, 0.02)';
          
          // Clear subtle effects after animation
          setTimeout(() => {
            element.style.backgroundColor = '';
          }, 500);
        }
      });
    }, 10); 
  }, [trackItemPositions]);

  const clearAllUploadedImages = useCallback(() => {
    setUploadedImages([]);
    setPreviewImages([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const clearAllVideos = useCallback(() => {
    setVideoUrls([]);
  }, []);

  // Extract YouTube ID from URL for thumbnails
  const getYouTubeID = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  // Get video thumbnail
  const getVideoThumbnail = (urlObj: {url: string; id: string}) => {
    const youtubeID = getYouTubeID(urlObj.url);
    if (youtubeID) {
      return `https://img.youtube.com/vi/${youtubeID}/mqdefault.jpg`;
    }
    return null;
  };

  // Handle playing a video
  const handlePlayVideo = useCallback((url: string) => {
    setSelectedVideo(url);
    setVideoDialogOpen(true);
    // Reset error state when opening a new video
    setEmbedError(false);
  }, []);

  // Close video dialog
  const handleCloseVideoDialog = useCallback(() => {
    setVideoDialogOpen(false);
    // Wait for dialog transition to complete before clearing the video
    setTimeout(() => {
      setSelectedVideo(null);
      setEmbedError(false);
    }, 300);
  }, []);

  // Handle iframe load errors
  const handleIframeError = useCallback(() => {
    setEmbedError(true);
  }, []);

  // Get embed URL from video URL
  const getEmbedUrl = (url: string) => {
    const youtubeID = getYouTubeID(url);
    if (youtubeID) {
      // Add additional parameters to improve embedding:
      // - origin: security parameter required by some browsers
      // - rel=0: prevents showing related videos from other channels
      // - modestbranding=1: reduces YouTube branding
      return `https://www.youtube.com/embed/${youtubeID}?autoplay=1&rel=0&modestbranding=1&origin=${window.location.origin}`;
    }
    return url;
  };

  // Determine if URL is embeddable
  const isEmbeddable = (url: string) => {
    const domain = new URL(url).hostname.replace('www.', '');
    return domain.includes('youtube') || domain.includes('youtu.be');
  };

  // Handle opening in new tab
  const handleOpenInNewTab = useCallback((url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  return (
    <Card>
      <CardHeader 
        title="What would you like to eat this week?" 
        subheader="Describe your preferences, dietary restrictions, or cuisine types" 
      />
      
      <CardContent>
        <Stack spacing={3}>
          {/* Text input */}
          <TextField
            fullWidth
            multiline
            rows={4}
            placeholder="e.g., I want healthy meals with vegetables, chicken, and Mediterranean flavors. I'm allergic to nuts."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Iconify icon="mdi:text" width={24} />
                </InputAdornment>
              ),
            }}
          />
          
          {/* Optional inputs with divider */}
          <Divider>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Optional Inspiration
            </Typography>
          </Divider>
          
          {/* Image upload section */}
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2">
                Add food images ({uploadedImages.length} selected)
              </Typography>
              
              {uploadedImages.length > 0 && (
                <Button 
                  size="small" 
                  color="error" 
                  onClick={clearAllUploadedImages}
                  startIcon={<Iconify icon="mdi:delete" />}
                >
                  Clear all
                </Button>
              )}
            </Box>
            
            {/* Image upload button */}
            <Box 
              sx={{ 
                border: '1px dashed', 
                borderColor: 'divider',
                borderRadius: 1,
                p: 3,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 100,
                cursor: 'pointer',
                mb: 2,
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                  borderColor: 'primary.main',
                  bgcolor: 'background.neutral'
                }
              }}
              onClick={handleClickUpload}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={handleImageUpload}
              />
              
              <Iconify 
                icon="mdi:cloud-upload" 
                width={40} 
                height={40} 
                sx={{ mb: 1, color: 'text.secondary' }} 
              />
              <Typography variant="body2" color="text.secondary" align="center">
                Drag & drop or click to upload food images
              </Typography>
              <Typography variant="caption" color="text.secondary" align="center" sx={{ mt: 0.5 }}>
                You can select multiple files
              </Typography>
            </Box>
            
            {/* Preview of uploaded images */}
            {previewImages.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Preview ({previewImages.length})
                </Typography>
                <Box 
                  sx={{ 
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: 'repeat(2, 1fr)',
                      sm: 'repeat(3, 1fr)',
                      md: 'repeat(4, 1fr)'
                    },
                    gap: 1,
                    position: 'relative'
                  }}
                >
                  {previewImages.map((img) => (
                    <Box 
                      key={img.id}
                      ref={(el: HTMLDivElement | null) => {
                        gridItemsRef.current[img.id] = el;
                      }}
                      sx={{
                        position: 'relative',
                        borderRadius: 1,
                        overflow: 'hidden',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        bgcolor: 'background.paper',
                        aspectRatio: '1/1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'box-shadow 0.3s ease-in-out, transform 0.3s ease-in-out',
                        '&:hover': {
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                          transform: 'translateY(-4px)',
                        },
                      }}
                    >
                      <img
                        src={img.url}
                        alt={`Uploaded image ${img.id}`}
                        style={{ 
                          maxWidth: '100%',
                          maxHeight: '100%',
                          objectFit: 'contain',
                          padding: '8px',
                        }}
                      />
                      <IconButton
                        size="small"
                        sx={{
                          position: 'absolute',
                          top: 4,
                          right: 4,
                          bgcolor: 'background.paper',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                          transition: 'all 0.3s ease-in-out',
                          '&:hover': {
                            bgcolor: 'error.main',
                            color: 'common.white'
                          }
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeImage(img.id);
                        }}
                      >
                        <Iconify icon="mdi:close" width={16} />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
          </Box>
          
          {/* Video URL input */}
          <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2">
                Add cooking videos ({videoUrls.length} added)
              </Typography>
              
              {videoUrls.length > 0 && (
                <Button 
                  size="small" 
                  color="error" 
                  onClick={clearAllVideos}
                  startIcon={<Iconify icon="mdi:delete" />}
                >
                  Clear all
                </Button>
              )}
            </Box>
            
            <Box sx={{ display: 'flex', mb: 2 }}>
              <TextField
                fullWidth
                placeholder="Video URL (e.g., YouTube)"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                onKeyPress={handleVideoKeyPress}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Iconify icon="mdi:video" width={24} />
                    </InputAdornment>
                  ),
                }}
                sx={{ mr: 1 }}
              />
              <Button 
                variant="contained" 
                onClick={handleAddVideo}
                disabled={!videoUrl.trim()}
                sx={{ minWidth: '100px' }}
              >
                Add
              </Button>
            </Box>
            
            {/* Video URL list */}
            {videoUrls.length > 0 && (
              <Box 
                sx={{ 
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: 'repeat(1, 1fr)',
                    sm: 'repeat(2, 1fr)',
                    md: 'repeat(3, 1fr)'
                  },
                  gap: 1.5,
                  mt: 1,
                  mb: 2,
                  position: 'relative'
                }}
              >
                {videoUrls.map((videoItem) => {
                  const thumbnail = getVideoThumbnail(videoItem);
                  const domain = new URL(videoItem.url).hostname.replace('www.', '');
                  const isYoutube = domain.includes('youtube') || domain.includes('youtu.be');
                  
                  return (
                    <Box
                      key={videoItem.id}
                      ref={(el: HTMLDivElement | null) => {
                        gridItemsRef.current[videoItem.id] = el;
                      }}
                      sx={{
                        borderRadius: 1,
                        overflow: 'hidden',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        bgcolor: 'background.paper',
                        border: '1px solid',
                        borderColor: 'divider',
                        height: '100%',
                        transition: 'box-shadow 0.3s ease-in-out, transform 0.3s ease-in-out',
                        '&:hover': {
                          boxShadow: '0 6px 12px rgba(0,0,0,0.15)',
                          transform: 'translateY(-4px)',
                        },
                      }}
                    >
                      {/* Thumbnail with play button */}
                      <Box sx={{ position: 'relative' }}>
                        <Box 
                          sx={{
                            width: '100%',
                            height: 0,
                            paddingTop: '56.25%', // 16:9 aspect ratio
                            bgcolor: 'grey.200',
                            position: 'relative',
                            backgroundImage: thumbnail ? `url(${thumbnail})` : 'none',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                          }}
                        >
                          {!thumbnail && (
                            <Box
                              sx={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <Iconify icon="mdi:video" width={40} height={40} sx={{ color: 'text.disabled' }} />
                            </Box>
                          )}
                          
                          {/* Play button overlay */}
                          <Box
                            sx={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              '&:hover': {
                                '& .play-button': {
                                  opacity: 1,
                                  transform: 'scale(1.1)',
                                  bgcolor: 'error.main',
                                }
                              }
                            }}
                            onClick={() => handlePlayVideo(videoItem.url)}
                          >
                            <Box
                              className="play-button"
                              sx={{
                                width: 48,
                                height: 48,
                                borderRadius: '50%',
                                bgcolor: 'error.dark',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                opacity: 0.9,
                                transition: 'all 0.3s ease-in-out',
                              }}
                            >
                              <Iconify 
                                icon="mdi:play" 
                                width={24} 
                                height={24} 
                                sx={{ 
                                  color: 'common.white',
                                  ml: '3px' // Optical centering for play icon
                                }} 
                              />
                            </Box>
                          </Box>
                          
                          {/* Remove button */}
                          <IconButton
                            size="small"
                            sx={{
                              position: 'absolute',
                              top: 4,
                              right: 4,
                              bgcolor: 'rgba(0,0,0,0.5)',
                              color: 'common.white',
                              '&:hover': { 
                                bgcolor: 'error.main', 
                              },
                              width: 28,
                              height: 28,
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              removeVideo(videoItem.id);
                            }}
                          >
                            <Iconify icon="mdi:close" width={16} />
                          </IconButton>
                        </Box>
                        
                        {/* Video details */}
                        <Box sx={{ p: 1.5 }}>
                          <Typography
                            variant="subtitle2"
                            sx={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              lineHeight: 1.2,
                              minHeight: '2.4em',
                              mb: 0.5
                            }}
                          >
                            {videoItem.url.length > 60 ? `${videoItem.url.substring(0, 60)}...` : videoItem.url}
                          </Typography>
                          
                          <Chip 
                            label={isYoutube ? 'YouTube' : domain.split('.')[0]} 
                            size="small" 
                            color={isYoutube ? 'error' : 'default'} 
                            sx={{ height: 20 }}
                          />
                        </Box>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>
        </Stack>
      </CardContent>
      
      <CardActions sx={{ 
        padding: (theme) => theme.spacing(0, 3, 3),
        justifyContent: 'flex-end'
      }}>
        <LoadingButton 
          variant="contained" 
          onClick={handleSubmit} 
          loading={loading}
          disabled={!description}
          startIcon={<Iconify icon="mdi:chef-hat" />}
          size="large"
        >
          Generate Meal Plan
        </LoadingButton>
      </CardActions>

      {/* Video Player Dialog */}
      <Dialog
        open={videoDialogOpen}
        onClose={handleCloseVideoDialog}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            overflow: 'hidden', // Removes extra padding/scrollbars
          }
        }}
      >
        <DialogTitle sx={{ 
          m: 0, 
          p: 1.5,
          display: 'flex', 
          justifyContent: 'flex-end',
          bgcolor: 'background.paper',
          borderBottom: '1px solid',
          borderColor: 'divider'
        }}>
          <IconButton
            onClick={handleCloseVideoDialog}
            size="small"
            aria-label="close"
          >
            <Iconify icon="mdi:close" width={20} />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: embedError ? 3 : 0 }}>
          {selectedVideo && (
            isEmbeddable(selectedVideo) && !embedError ? (
              <Box sx={{ position: 'relative', width: '100%', height: 0, paddingTop: '56.25%' }}>
                <iframe
                  ref={iframeRef}
                  src={getEmbedUrl(selectedVideo)}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    border: 'none',
                  }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  title="Video Player"
                  onError={handleIframeError}
                />
              </Box>
            ) : (
              <Box sx={{ textAlign: 'center', p: 4 }}>
                {embedError && (
                  <Alert 
                    severity="info" 
                    sx={{ mb: 3 }}
                    action={
                      <Button 
                        color="inherit" 
                        size="small" 
                        onClick={() => setEmbedError(false)}
                      >
                        Try Again
                      </Button>
                    }
                  >
                    This video cannot be embedded directly. The creator may have disabled embedding.
                  </Alert>
                )}
                
                <Typography variant="body1" gutterBottom>
                  You can watch this video directly on {selectedVideo ? new URL(selectedVideo).hostname.replace('www.', '') : ''}
                </Typography>
                
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => selectedVideo && handleOpenInNewTab(selectedVideo)}
                  startIcon={<Iconify icon="mdi:open-in-new" />}
                  sx={{ mt: 2 }}
                >
                  Open Video
                </Button>
              </Box>
            )
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
} 