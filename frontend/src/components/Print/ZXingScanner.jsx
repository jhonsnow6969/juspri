import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { Loader2, Camera } from 'lucide-react'

export default function ZXingScanner({ active, onScan, onError }) {
  const videoRef = useRef(null)
  const controlsRef = useRef(null)
  
  const [permissionAsked, setPermissionAsked] = useState(false)
  const [cameraLoading, setCameraLoading] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState(null)

  useEffect(() => {
    if (!active || !permissionAsked || !videoRef.current) return

    let isMounted = true // Tracks if component unmounts during initialization
    setCameraLoading(true)

    const initTimer = setTimeout(() => {
      const reader = new BrowserMultiFormatReader()

      reader
        .decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result, err) => {
            if (result && isMounted) {
              if (window.navigator && window.navigator.vibrate) {
                window.navigator.vibrate(50)
              }
              onScan?.([{ rawValue: result.getText() }])
            }
          }
        )
        .then((controls) => {
          // RACE CONDITION FIX: If the user navigated away while the camera was starting, 
          // kill the camera immediately as soon as it resolves.
          if (!isMounted) {
            controls.stop()
            return
          }
          
          controlsRef.current = controls
          setCameraLoading(false)
          setCameraReady(true)
        })
        .catch((err) => {
          if (!isMounted) return
          console.error(err)
          setCameraError(err)
          setCameraLoading(false)
          onError?.(err)
        })
    }, 50)

    // CLEANUP FUNCTION
    return () => {
      isMounted = false
      clearTimeout(initTimer)
      
      // 1. Stop ZXing controls if they exist
      if (controlsRef.current) {
        controlsRef.current.stop()
        controlsRef.current = null
      }

      // 2. THE ULTIMATE KILL SWITCH
      // iOS Safari and some Android browsers hold onto the hardware stream 
      // strictly. We must manually rip the tracks out of the video element.
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject
        const tracks = stream.getTracks()
        tracks.forEach(track => track.stop())
        videoRef.current.srcObject = null
      }
    }
  }, [active, permissionAsked, onScan, onError])

  // 1. Initial State
  if (!permissionAsked) {
    return (
      <div className="aspect-square w-full bg-muted/10 flex items-center justify-center rounded-xl border border-border">
        <button
          onClick={() => setPermissionAsked(true)}
          className="px-6 py-3 rounded-xl bg-white text-black hover:bg-neutral-200 font-medium transition-all hover:scale-105 shadow-lg flex items-center gap-2"
        >
          <Camera className="w-5 h-5" /> Enable Camera
        </button>
      </div>
    )
  }

  // 2. Camera State
  return (
    <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-black/90 border border-border">
      
      {/* Loading Overlay */}
      {cameraLoading && !cameraError && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/60 backdrop-blur-sm">
          <Loader2 className="w-8 h-8 animate-spin text-white" />
          <p className="text-sm text-white/80 font-medium">Starting camera...</p>
        </div>
      )}

      {/* Error Overlay */}
      {cameraError && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-red-950/90 p-6 text-center">
          <div>
            <p className="text-sm text-red-400 font-bold mb-2">Camera Error</p>
            <p className="text-xs text-red-200/70">Please check camera permissions in your browser settings.</p>
          </div>
        </div>
      )}

      {/* Video Feed */}
      <video
        ref={videoRef}
        className={`absolute inset-0 w-full h-full object-cover transform-gpu will-change-[opacity] transition-opacity duration-700 ease-out ${
          cameraReady && !cameraError ? 'opacity-100' : 'opacity-0'
        }`}
        muted
        playsInline
      />
      
      {/* VIEWFINDER OVERLAY */}
      {cameraReady && !cameraError && (
        <div className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center">
          {/* This creates the dark background with a transparent hole in the middle */}
          <div className="relative w-[70%] h-[70%] rounded-xl shadow-[0_0_0_4000px_rgba(0,0,0,0.5)]">
            
            {/* Corner Reticles */}
            <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-xl" />
            <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-xl" />
            <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-xl" />
            <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-xl" />
            
            {/* Optional: Add a subtle pulsing red line to look like a laser scanner */}
            <div className="absolute top-1/2 left-4 right-4 h-[1px] bg-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.8)] animate-pulse" />
            
          </div>
        </div>
      )}
    </div>
  )
}