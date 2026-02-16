import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { Loader2 } from 'lucide-react'

export default function ZXingScanner({ active, onScan, onError }) {
  const videoRef = useRef(null)
  const readerRef = useRef(null)
  const controlsRef = useRef(null)

  const [permissionAsked, setPermissionAsked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!active || !permissionAsked) return
    if (!videoRef.current) return

    let cancelled = false
    setLoading(true)
    setError(null)

    // Create reader ONCE
    if (!readerRef.current) {
      readerRef.current = new BrowserMultiFormatReader()
    }

    readerRef.current
      .decodeFromVideoDevice(
        undefined, // auto camera
        videoRef.current,
        (result, err) => {
          if (result) {
            onScan?.([{ rawValue: result.getText() }])
          }
        }
      )
      .then((controls) => {
        if (cancelled) return
        controlsRef.current = controls
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('ZXing camera error:', err)
        setError(err)
        setLoading(false)
        onError?.(err)
      })

    return () => {
      cancelled = true
      if (controlsRef.current) {
        controlsRef.current.stop()
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
          className="px-6 py-3 rounded-xl bg-white text-black hover:bg-neutral-200 font-medium transition"
        >
          📷 Enable Camera
        </button>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="aspect-square bg-muted/10 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin" />
        <p className="text-xs text-muted-foreground">Starting camera…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="aspect-square bg-red-500/10 flex items-center justify-center p-4 text-center">
        <p className="text-xs text-red-500">
          Camera not available.<br />
          Check permissions or device.
        </p>
      </div>
    )
  }

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      className="w-full aspect-square object-cover rounded-xl"
    />
  )
}
