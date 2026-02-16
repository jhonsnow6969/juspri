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
    if (!active || !permissionAsked) return

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
  }, [active, permissionAsked])

  // Enable Camera Button
  if (!permissionAsked) {
    return (
      <div className="aspect-square bg-muted/10 flex items-center justify-center">
        <button
          onClick={() => setPermissionAsked(true)}
          className="px-6 py-3 rounded-xl bg-white text-black hover:bg-neutral-200 font-medium transition-all hover:scale-105"
        >
          📷 Enable Camera
        </button>
      </div>
    )
  }

  // Loading State
  if (cameraLoading) {
    return (
      <div className="aspect-square bg-muted/10 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
        <p className="text-sm text-muted-foreground">Starting camera...</p>
      </div>
    )
  }

  // Error State
  if (cameraError) {
    return (
      <div className="aspect-square bg-red-500/10 flex items-center justify-center p-6 text-center">
        <div>
          <p className="text-sm text-red-500 mb-2">Camera error</p>
          <p className="text-xs text-muted-foreground">Check permissions or device</p>
        </div>
      </div>
    )
  }

  // Camera Feed with Smooth Fade-in
  return (
    <video
      ref={videoRef}
      className={`w-full aspect-square object-cover rounded-xl transition-opacity duration-500 ${
        cameraReady ? 'opacity-100' : 'opacity-0'
      }`}
      muted
      playsInline
    />
  )
}