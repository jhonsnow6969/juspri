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

    setCameraLoading(true)

    // OPTIMIZATION 1: Yield to the main thread.
    // Gives the browser 50ms to paint the "Loading" UI before blocking the CPU with hardware access.
    const initTimer = setTimeout(() => {
      const reader = new BrowserMultiFormatReader()

      reader
        .decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result, err) => {
            if (result) {
              // Add a tiny vibration on mobile to confirm scan (if supported)
              if (window.navigator && window.navigator.vibrate) {
                window.navigator.vibrate(50);
              }
              onScan?.([{ rawValue: result.getText() }])
            }
          }
        )
        .then((controls) => {
          controlsRef.current = controls
          setCameraLoading(false)
          setCameraReady(true)
        })
        .catch((err) => {
          console.error(err)
          setCameraError(err)
          setCameraLoading(false)
          onError?.(err)
        })
    }, 50)

    return () => {
      clearTimeout(initTimer)
      if (controlsRef.current) {
        controlsRef.current.stop()
        controlsRef.current = null
      }
    }
  }, [active, permissionAsked, onScan, onError])

  // 1. Initial State
  if (!permissionAsked) {
    return (
      <div className="aspect-square bg-muted/10 flex items-center justify-center rounded-xl">
        <button
          onClick={() => setPermissionAsked(true)}
          className="px-6 py-3 rounded-xl bg-white text-black hover:bg-neutral-200 font-medium transition-all hover:scale-105 shadow-lg flex items-center gap-2"
        >
          <Camera className="w-5 h-5" /> Enable Camera
        </button>
      </div>
    )
  }

  // 2. Camera State with GPU-accelerated video
  return (
    <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-black/90 border border-border">
      
      {/* Loading Overlay */}
      {cameraLoading && !cameraError && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-white" />
          <p className="text-sm text-white/80 font-medium">Starting camera...</p>
        </div>
      )}

      {/* Error Overlay */}
      {cameraError && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-red-950/90 p-6 text-center">
          <div>
            <p className="text-sm text-red-400 font-bold mb-2">Camera Error</p>
            <p className="text-xs text-red-200/70">Please check camera permissions in your browser settings.</p>
          </div>
        </div>
      )}

      {/* Video Feed 
          OPTIMIZATION 2: transform-gpu and will-change-opacity push the fade-in animation to the hardware layer
      */}
      <video
        ref={videoRef}
        className={`w-full h-full object-cover transform-gpu will-change-[opacity] transition-opacity duration-700 ease-out ${
          cameraReady && !cameraError ? 'opacity-100' : 'opacity-0'
        }`}
        muted
        playsInline
      />
      
      {/* Optional: Add a scanning guide/overlay here if you want it to look like a viewfinder */}
      {cameraReady && !cameraError && (
         <div className="absolute inset-0 border-[40px] border-black/20 pointer-events-none rounded-xl" />
      )}
    </div>
  )
}