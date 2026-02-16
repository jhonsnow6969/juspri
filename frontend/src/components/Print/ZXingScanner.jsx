import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { Loader2 } from 'lucide-react'

export default function ZXingScanner({ active, onScan, onError }) {
  const videoRef = useRef(null)
  const readerRef = useRef(null)
  const streamRef = useRef(null)

  const [permissionAsked, setPermissionAsked] = useState(false)
  const [cameraLoading, setCameraLoading] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState(null)

  useEffect(() => {
    if (!active || !permissionAsked) return

    let cancelled = false
    setCameraLoading(true)
    setCameraError(null)

    async function startCamera() {
      try {
        // 1️⃣ Explicitly request camera
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        })

        if (cancelled) return

        streamRef.current = stream
        const video = videoRef.current
        video.srcObject = stream

        // 2️⃣ Force play
        await video.play()

        if (cancelled) return

        setCameraReady(true)
        setCameraLoading(false)

        // 3️⃣ Start ZXing on already-playing video
        const reader = new BrowserMultiFormatReader()
        readerRef.current = reader

        reader.decodeFromVideoElement(video, (result, err) => {
          if (result) {
            onScan?.([{ rawValue: result.getText() }])
          }
        })
      } catch (err) {
        console.error('Camera error:', err)
        setCameraError(err)
        setCameraLoading(false)
        onError?.(err)
      }
    }

    startCamera()

    return () => {
      cancelled = true

      readerRef.current?.reset()
      readerRef.current = null

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
    }
  }, [active, permissionAsked, onScan, onError])

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
          <p className="text-xs text-muted-foreground">
            Allow camera access or try another device
          </p>
        </div>
      </div>
    )
  }

  // Camera Feed
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
