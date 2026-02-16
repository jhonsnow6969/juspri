import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { Loader2 } from 'lucide-react'

export default function ZXingScanner({ active, onScan, onError }) {
  const videoRef = useRef(null)
  const controlsRef = useRef(null)
  
  const [permissionAsked, setPermissionAsked] = useState(false)
  const [cameraLoading, setCameraLoading] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState(null)

  useEffect(() => {
    // Only run if active, permission asked, and we have the video element mounted
    if (!active || !permissionAsked || !videoRef.current) return

    setCameraLoading(true)
    const reader = new BrowserMultiFormatReader()

    reader
      .decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result, err) => {
          if (result) {
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

    return () => {
      if (controlsRef.current) {
        controlsRef.current.stop()
        controlsRef.current = null
      }
    }
  }, [active, permissionAsked, onScan, onError])

  // 1. Initial State: Ask for permission
  if (!permissionAsked) {
    return (
      <div className="aspect-square bg-muted/10 flex items-center justify-center rounded-xl">
        <button
          onClick={() => setPermissionAsked(true)}
          className="px-6 py-3 rounded-xl bg-white text-black hover:bg-neutral-200 font-medium transition-all hover:scale-105 shadow-lg"
        >
          📷 Enable Camera
        </button>
      </div>
    )
  }

  // 2. Camera State: Always render the video, use overlays for Loading/Error
  return (
    <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-muted/10 border border-border">
      
      {/* Loading Overlay */}
      {cameraLoading && !cameraError && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/40 backdrop-blur-sm">
          <Loader2 className="w-8 h-8 animate-spin text-white" />
          <p className="text-sm text-white font-medium">Starting camera...</p>
        </div>
      )}

      {/* Error Overlay */}
      {cameraError && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-red-950/80 p-6 text-center backdrop-blur-sm">
          <div>
            <p className="text-sm text-red-400 font-bold mb-2">Camera Error</p>
            <p className="text-xs text-red-200">Please check camera permissions in your browser settings.</p>
          </div>
        </div>
      )}

      {/* Video Feed (Always in DOM so the ref works) */}
      <video
        ref={videoRef}
        className={`w-full h-full object-cover transition-opacity duration-700 ease-in-out ${
          cameraReady && !cameraError ? 'opacity-100' : 'opacity-0'
        }`}
        muted
        playsInline
      />
    </div>
  )
}