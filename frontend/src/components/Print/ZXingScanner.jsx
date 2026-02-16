import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { Loader2 } from 'lucide-react'

export default function ZXingScanner({ active, onScan, onError }) {
  const videoRef = useRef(null)
  const controlsRef = useRef(null)
  const readerRef = useRef(null)
  const scannedRef = useRef(false)

  const [permissionAsked, setPermissionAsked] = useState(false)
  const [cameraLoading, setCameraLoading] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState(null)

  useEffect(() => {
    if (!active || !permissionAsked) return
    if (!videoRef.current) return

    setCameraLoading(true)
    setCameraError(null)
    scannedRef.current = false

    const reader = new BrowserMultiFormatReader()
    readerRef.current = reader

    reader
      .decodeFromVideoDevice(
        { facingMode: 'environment' }, // 👈 important
        videoRef.current,
        (result, err) => {
          if (result && !scannedRef.current) {
            scannedRef.current = true

            const text = result.getText()
            console.log('🔍 QR scanned:', text)

            onScan?.([{ rawValue: text }])
          }

          if (err && err.name !== 'NotFoundException') {
            console.warn('ZXing scan error:', err)
          }
        }
      )
      .then((controls) => {
        controlsRef.current = controls
        setCameraLoading(false)
        setCameraReady(true)
      })
      .catch((err) => {
        console.error('Camera start error:', err)
        setCameraError(err)
        setCameraLoading(false)
        onError?.(err)
      })

    return () => {
      scannedRef.current = false

      if (controlsRef.current) {
        controlsRef.current.stop() // ✅ correct cleanup
        controlsRef.current = null
      }
    }
  }, [active, permissionAsked, onScan, onError])

  // ---- UI STATES ----

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

  if (cameraLoading) {
    return (
      <div className="aspect-square bg-muted/10 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
        <p className="text-sm text-muted-foreground">Starting camera…</p>
      </div>
    )
  }

  if (cameraError) {
    return (
      <div className="aspect-square bg-red-500/10 flex items-center justify-center p-6 text-center">
        <div>
          <p className="text-sm text-red-500 mb-2">Camera error</p>
          <p className="text-xs text-muted-foreground">
            Allow camera permissions or use manual entry
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative aspect-square overflow-hidden rounded-xl bg-black">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`absolute inset-0 w-full h-full object-cover transition-opacity ${
          cameraReady ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {cameraReady && (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center pointer-events-none">
          <div className="bg-black/70 backdrop-blur-sm px-4 py-2 rounded-full text-xs text-white">
            Position QR code in frame
          </div>
        </div>
      )}
    </div>
  )
}
