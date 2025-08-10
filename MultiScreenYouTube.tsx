import { useState, useRef, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Play, Pause, Square, Repeat, Volume2, VolumeX } from 'lucide-react'

interface YouTubePlayer {
  playVideo: () => void
  pauseVideo: () => void
  stopVideo: () => void
  setLoop: (loop: boolean) => void
  mute: () => void
  unMute: () => void
  getPlayerState: () => number
}

export default function MultiScreenYouTube() {
  const [videoUrl, setVideoUrl] = useState('')
  const [screenCount, setScreenCount] = useState(4)
  const [videoId, setVideoId] = useState('')
  const [isGenerated, setIsGenerated] = useState(false)
  const [isLooping, setIsLooping] = useState(false)
  const [playersReady, setPlayersReady] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [autoPlaying, setAutoPlaying] = useState(false)
  const [loadingStatus, setLoadingStatus] = useState('')
  const playersRef = useRef<YouTubePlayer[]>([])
  const containerRef = useRef<HTMLDivElement>(null)
  const apiLoadedRef = useRef(false)

  const extractVideoId = (url: string) => {
    const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)
    return match ? match[1] : ''
  }

  const handleGenerate = () => {
    const id = extractVideoId(videoUrl)
    if (id) {
      setVideoId(id)
      setIsGenerated(true)
      setPlayersReady(false)
      setAutoPlaying(false)
      setLoadingStatus('Initializing players...')
      playersRef.current = []
    }
  }

  const loadYouTubeAPI = () => {
    if (window.YT && window.YT.Player) {
      apiLoadedRef.current = true
      return Promise.resolve()
    }

    if (document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      return new Promise((resolve) => {
        if (window.YT && window.YT.Player) {
          apiLoadedRef.current = true
          resolve()
        } else {
          window.onYouTubeIframeAPIReady = () => {
            apiLoadedRef.current = true
            resolve()
          }
        }
      })
    }

    return new Promise((resolve) => {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      tag.async = true
      tag.defer = true
      
      window.onYouTubeIframeAPIReady = () => {
        apiLoadedRef.current = true
        console.log('YouTube API loaded')
        resolve()
      }
      
      // Add timeout fallback
      setTimeout(() => {
        if (!apiLoadedRef.current) {
          console.warn('YouTube API load timeout, trying to proceed anyway')
          apiLoadedRef.current = true
          resolve()
        }
      }, 10000)
      
      const firstScriptTag = document.getElementsByTagName('script')[0]
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag)
    })
  }

  useEffect(() => {
    loadYouTubeAPI()
  }, [])

  useEffect(() => {
    if (isGenerated && videoId) {
      // Ensure API is loaded before initializing players
      if (apiLoadedRef.current) {
        // Small delay to ensure DOM is ready
        setTimeout(() => {
          initializePlayers()
        }, 100)
      } else {
        // Wait for API to load
        loadYouTubeAPI().then(() => {
          setTimeout(() => {
            initializePlayers()
          }, 100)
        })
      }
    }
  }, [isGenerated, videoId, screenCount])

  const initializePlayers = async () => {
    console.log('initializePlayers called', { 
      hasYT: !!window.YT, 
      hasPlayer: !!(window.YT && window.YT.Player), 
      videoId, 
      apiLoaded: apiLoadedRef.current 
    })
    
    if (!window.YT || !window.YT.Player || !videoId) {
      setLoadingStatus('YouTube API not ready')
      console.error('YouTube API not ready:', { hasYT: !!window.YT, hasPlayer: !!(window.YT && window.YT.Player), videoId })
      return
    }
    
    setLoadingStatus('Creating players...')
    playersRef.current = []
    
    // Wait for API to be fully ready
    if (!apiLoadedRef.current) {
      console.log('Waiting for API to be ready...')
      await loadYouTubeAPI()
    }
    
    const containers = containerRef.current?.querySelectorAll('.youtube-container')
    console.log('Found containers:', containers?.length)
    
    if (!containers || containers.length === 0) {
      setLoadingStatus('No containers found')
      console.error('No containers found')
      return
    }

    let loadedCount = 0
    const totalPlayers = containers.length
    
    setLoadingStatus(`Creating ${totalPlayers} players...`)
    
    containers.forEach((container, index) => {
      try {
        console.log(`Creating player ${index} for container:`, container)
        // Clear any existing content
        container.innerHTML = ''
        
        const player = new window.YT.Player(container as HTMLElement, {
          height: '100%',
          width: '100%',
          videoId: videoId,
          playerVars: {
            autoplay: 0,
            controls: 1,
            modestbranding: 1,
            rel: 0,
            mute: isMuted ? 1 : 0,
            enablejsapi: 1,
            origin: window.location.origin,
            loop: isLooping ? 1 : 0,
            playlist: isLooping ? videoId : undefined
          },
          events: {
            onReady: (event) => {
              console.log(`Player ${index + 1} ready`)
              playersRef.current[index] = event.target
              
              if (isMuted) {
                event.target.mute()
              } else {
                event.target.unMute()
              }
              
              loadedCount++
              setLoadingStatus(`Player ${loadedCount}/${totalPlayers} ready`)
              
              if (loadedCount === totalPlayers) {
                setPlayersReady(true)
                setLoadingStatus('All players ready!')
              }
            },
            onStateChange: (event) => {
              if (isLooping && event.data === 0) {
                event.target.playVideo()
              }
            },
            onError: (event) => {
              console.error(`YouTube player ${index} error:`, event.data)
              loadedCount++
              setLoadingStatus(`Player ${loadedCount}/${totalPlayers} ready (with errors)`)
              
              if (loadedCount >= totalPlayers) {
                setPlayersReady(true)
                setLoadingStatus('All players ready!')
              }
            }
          }
        })
      } catch (error) {
        console.error(`Error creating player ${index}:`, error)
        loadedCount++
        setLoadingStatus(`Player ${loadedCount}/${totalPlayers} ready (with errors)`)
        
        if (loadedCount >= totalPlayers) {
          setPlayersReady(true)
          setLoadingStatus('All players ready!')
        }
      }
    })
    
    // Fallback timeout
    setTimeout(() => {
      if (loadedCount > 0 && !playersReady) {
        setPlayersReady(true)
        setLoadingStatus('Players ready by timeout')
        console.log('Players ready by timeout')
      }
    }, 5000)
  }

  const playAll = () => {
    if (!playersReady) return
    
    setAutoPlaying(true)
    
    playersRef.current.forEach((player, index) => {
      if (player && typeof player.playVideo === 'function') {
        try {
          player.playVideo()
        } catch (error) {
          console.error(`Error playing video ${index}:`, error)
        }
      }
    })
  }

  const pauseAll = () => {
    if (!playersReady) return
    
    setAutoPlaying(false)
    
    playersRef.current.forEach((player, index) => {
      if (player && typeof player.pauseVideo === 'function') {
        try {
          player.pauseVideo()
        } catch (error) {
          console.error(`Error pausing video ${index}:`, error)
        }
      }
    })
  }

  const stopAll = () => {
    if (!playersReady) return
    
    setAutoPlaying(false)
    
    playersRef.current.forEach((player, index) => {
      if (player && typeof player.stopVideo === 'function') {
        try {
          player.stopVideo()
        } catch (error) {
          console.error(`Error stopping video ${index}:`, error)
        }
      }
    })
  }

  const toggleMute = () => {
    if (!playersReady) return
    
    const newMutedState = !isMuted
    setIsMuted(newMutedState)
    
    playersRef.current.forEach(player => {
      if (player) {
        if (newMutedState) {
          player.mute()
        } else {
          player.unMute()
        }
      }
    })
  }

  const toggleLoop = () => {
    const newLoopState = !isLooping
    setIsLooping(newLoopState)
    
    // If players are ready, apply loop setting
    if (playersReady) {
      playersRef.current.forEach(player => {
        if (player && typeof player.setLoop === 'function') {
          try {
            player.setLoop(newLoopState)
          } catch (error) {
            console.error('Error setting loop:', error)
          }
        }
      })
    }
  }

  const getGridCols = () => {
    if (screenCount <= 4) return 'grid-cols-2'
    if (screenCount <= 9) return 'grid-cols-3'
    if (screenCount <= 16) return 'grid-cols-4'
    return 'grid-cols-5'
  }

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-8 bg-gradient-to-r from-red-500 to-red-600 bg-clip-text text-transparent">
          Multi-Screen YouTube Grid
        </h1>

        {!isGenerated ? (
          <Card className="bg-gray-900 border-red-500/50 max-w-md mx-auto">
            <CardHeader>
              <CardTitle className="text-red-400">Setup Your Video Grid</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="video-url" className="text-red-400">YouTube URL</Label>
                <Input
                  id="video-url"
                  type="url"
                  placeholder="https://youtube.com/watch?v=..."
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  className="bg-gray-800 border-red-500/50 text-white placeholder-gray-500"
                />
              </div>
              
              <div>
                <Label htmlFor="screen-count" className="text-red-400">Number of Screens</Label>
                <Select value={String(screenCount)} onValueChange={(value) => setScreenCount(Number(value))}>
                  <SelectTrigger className="bg-gray-800 border-red-500/50 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-red-500/50">
                    {[2, 3, 4, 6, 8, 9, 12, 16, 20].map(num => (
                      <SelectItem key={num} value={String(num)} className="text-white hover:bg-red-500/20">
                        {num} Screens
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button 
                onClick={handleGenerate}
                className="w-full bg-red-600 hover:bg-red-700 text-white"
                disabled={!videoUrl.trim()}
              >
                Generate Screens
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <div className="text-center">
              {loadingStatus && (
                <p className="text-yellow-400 mb-4">
                  {loadingStatus}
                </p>
              )}
              {autoPlaying && (
                <p className="text-green-400 mb-4">
                  ✅ All videos are playing in sync!
                </p>
              )}
              {!autoPlaying && playersReady && (
                <p className="text-blue-400 mb-4">
                  🎬 Videos ready - Click "Play All" to start all together!
                </p>
              )}
            </div>
            
            <div className="flex justify-center gap-4 flex-wrap">
              <Button 
                onClick={playAll}
                disabled={!playersReady}
                className="bg-green-600 hover:bg-green-700 text-white gap-2 disabled:opacity-50"
              >
                <Play size={16} /> Play All
              </Button>
              <Button 
                onClick={pauseAll}
                disabled={!playersReady}
                className="bg-yellow-600 hover:bg-yellow-700 text-white gap-2 disabled:opacity-50"
              >
                <Pause size={16} /> Pause All
              </Button>
              <Button 
                onClick={stopAll}
                disabled={!playersReady}
                className="bg-red-600 hover:bg-red-700 text-white gap-2 disabled:opacity-50"
              >
                <Square size={16} /> Stop All
              </Button>
              <Button 
                onClick={toggleMute}
                disabled={!playersReady}
                className="bg-blue-600 hover:bg-blue-700 text-white gap-2 disabled:opacity-50"
              >
                {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />} 
                {isMuted ? 'Unmute' : 'Mute'}
              </Button>
              <Button 
                onClick={toggleLoop}
                disabled={!playersReady}
                className={`${isLooping ? 'bg-purple-600' : 'bg-gray-700'} hover:bg-purple-700 text-white gap-2 disabled:opacity-50`}
              >
                <Repeat size={16} /> Loop: {isLooping ? 'ON' : 'OFF'}
              </Button>
              <Button 
                onClick={() => {
                  setIsGenerated(false)
                  setPlayersReady(false)
                  setAutoPlaying(false)
                  setLoadingStatus('')
                }}
                variant="outline"
                className="border-red-500 text-red-500 hover:bg-red-500/10"
              >
                Reset
              </Button>
            </div>

            {!playersReady && (
              <div className="text-center">
                <p className="text-red-400 mt-2">Loading players... Please wait</p>
              </div>
            )}

            <div 
              ref={containerRef}
              className={`grid ${getGridCols()} gap-2 md:gap-4 transition-all duration-500`}
            >
              {Array.from({ length: screenCount }, (_, i) => (
                <div key={i} className="aspect-video bg-gray-900 rounded-lg overflow-hidden border border-red-500/30 relative">
                  <div 
                    className="youtube-container w-full h-full" 
                    data-index={i}
                    style={{ minHeight: '200px' }}
                  />
                </div>
              ))}
            </div>

            {playersReady && (
              <div className="text-center text-sm text-gray-400">
                <p>🎬 Showing {screenCount} synchronized YouTube players</p>
                <p>Use controls above to manage all videos at once</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

declare global {
  interface Window {
    YT: any
    onYouTubeIframeAPIReady: () => void
  }
}