import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { Loader2 } from 'lucide-react'

export default function ZXingScanner({ active, onScan, onError }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const controlsRef = useRef(null)
  const [permissionAsked, setPermissionAsked] = useState(false)
  const [cameraLoading, setCameraLoading] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState(null)
  const [detectionBox, setDetectionBox] = useState(null)

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
            // Get QR code position
            const points = result.getResultPoints()
            if (points && points.length >= 2) {
              // Calculate bounding box
              const xs = points.map(p => p.getX())
              const ys = points.map(p => p.getY())
              const box = {
                x: Math.min(...xs),
                y: Math.min(...ys),
                width: Math.max(...xs) - Math.min(...xs),
                height: Math.max(...ys) - Math.min(...ys)
              }
              setDetectionBox(box)
              
              // Flash detection
              setTimeout(() => setDetectionBox(null), 500)
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

    return () => {
      if (controlsRef.current) {
        controlsRef.current.stop()
        controlsRef.current = null
      }
    }
  }, [active, permissionAsked])

  // Draw detection box overlay
  useEffect(() => {
    if (!detectionBox || !canvasRef.current || !videoRef.current) return

    const canvas = canvasRef.current
    const video = videoRef.current
    const ctx = canvas.getContext('2d')

    // Match canvas size to video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw green box
    ctx.strokeStyle = '#10b981'
    ctx.lineWidth = 4
    ctx.strokeRect(
      detectionBox.x,
      detectionBox.y,
      detectionBox.width,
      detectionBox.height
    )

    // Draw corners for extra style
    const cornerLength = 20
    ctx.strokeStyle = '#10b981'
    ctx.lineWidth = 6
    
    // Top-left
    ctx.beginPath()
    ctx.moveTo(detectionBox.x, detectionBox.y + cornerLength)
    ctx.lineTo(detectionBox.x, detectionBox.y)
    ctx.lineTo(detectionBox.x + cornerLength, detectionBox.y)
    ctx.stroke()
    
    // Top-right
    ctx.beginPath()
    ctx.moveTo(detectionBox.x + detectionBox.width - cornerLength, detectionBox.y)
    ctx.lineTo(detectionBox.x + detectionBox.width, detectionBox.y)
    ctx.lineTo(detectionBox.x + detectionBox.width, detectionBox.y + cornerLength)
    ctx.stroke()
    
    // Bottom-left
    ctx.beginPath()
    ctx.moveTo(detectionBox.x, detectionBox.y + detectionBox.height - cornerLength)
    ctx.lineTo(detectionBox.x, detectionBox.y + detectionBox.height)
    ctx.lineTo(detectionBox.x + cornerLength, detectionBox.y + detectionBox.height)
    ctx.stroke()
    
    // Bottom-right
    ctx.beginPath()
    ctx.moveTo(detectionBox.x + detectionBox.width - cornerLength, detectionBox.y + detectionBox.height)
    ctx.lineTo(detectionBox.x + detectionBox.width, detectionBox.y + detectionBox.height)
    ctx.lineTo(detectionBox.x + detectionBox.width, detectionBox.y + detectionBox.height - cornerLength)
    ctx.stroke()
  }, [detectionBox])

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

  // Camera Feed with Detection Overlay
  return (
    <div className="relative aspect-square">
      <video
        ref={videoRef}
        className={`w-full h-full object-cover rounded-xl transition-opacity duration-500 ${
          cameraReady ? 'opacity-100' : 'opacity-0'
        }`}
        muted
        playsInline
      />
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
        style={{ imageRendering: 'crisp-edges' }}
      />
      
      {/* Scanning Hint */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-center">
        <div className="bg-black/70 backdrop-blur-sm px-4 py-2 rounded-full text-xs text-white">
          Position QR code in frame
        </div>
      </div>
    </div>
  )
}