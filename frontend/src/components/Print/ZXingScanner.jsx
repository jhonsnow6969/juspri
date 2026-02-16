import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'

export default function ZXingScanner({ active, onScan, onError }) {
  const videoRef = useRef(null)
  const controlsRef = useRef(null)
  const [permissionAsked, setPermissionAsked] = useState(false)
  const [cameraError, setCameraError] = useState(null)

  useEffect(() => {
    if (!active || !permissionAsked) return

    const reader = new BrowserMultiFormatReader()

    reader
      .decodeFromVideoDevice(
        undefined, // auto-pick camera
        videoRef.current,
        (result, err) => {
            if (result) {
              onScan?.([{ rawValue: result.getText() }])  // ✅ Correct format
            }
          }
      )
      .then((controls) => {
        controlsRef.current = controls
      })
      .catch((err) => {
        console.error(err)
        setCameraError(err)
        onError?.(err)
      })

    return () => {
      if (controlsRef.current) {
        controlsRef.current.stop()
        controlsRef.current = null
      }
    }
  }, [active, permissionAsked])

  // 🔹 Camera permission button (IMPORTANT UX)
  if (!permissionAsked) {
    return (
      <button
        onClick={() => setPermissionAsked(true)}
        className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium"
      >
        Enable Camera
      </button>
    )
  }

  if (cameraError) {
    return (
      <div className="text-sm text-red-500">
        Camera error. Check permissions or device.
      </div>
    )
  }

  return (
    <video
      ref={videoRef}
      className="w-full rounded-xl border border-border"
      muted
      playsInline
    />
  )
}
