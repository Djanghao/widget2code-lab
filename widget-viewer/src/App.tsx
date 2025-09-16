import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react"
import {
  FileCode2,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Loader2,
  UploadCloud,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Separator } from "@/components/ui/separator"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  entriesFromFileList,
  extractDataTransferFiles,
  type FileEntry,
} from "@/lib/file-loader"
import {
  parseExperiments,
  type ExperimentRecord,
} from "@/lib/experiment-parser"
import { cn } from "@/lib/utils"

interface ExperimentView extends Omit<ExperimentRecord, "imageFile"> {
  key: string
  imageUrl?: string
}

interface GroupedExperiment {
  run: string
  providers: Array<{
    provider: string
    sizes: Array<{
      size: string
      experiments: ExperimentView[]
    }>
  }>
}

type DatasetState = {
  experiments: ExperimentView[]
  runs: string[]
}

const initialState: DatasetState = { experiments: [], runs: [] }

function createKey(experiment: ExperimentRecord) {
  return `${experiment.run}/${experiment.provider}/${experiment.size}/${experiment.id}`
}

interface DimensionMeta {
  width: number
  height: number
  scale: number
  offsetX: number
  offsetY: number
}

interface DimensionOverlayProps {
  width?: number | null
  height?: number | null
  scale?: number
  offsetX?: number
  offsetY?: number
}

function DimensionOverlay({ width, height, scale = 1, offsetX = 0, offsetY = 0 }: DimensionOverlayProps) {
  if (!width && !height) {
    return null
  }
  const overlayRef = useRef<HTMLDivElement>(null)
  const [overlaySize, setOverlaySize] = useState<{ width: number; height: number } | null>(null)

  useEffect(() => {
    const element = overlayRef.current
    if (!element) {
      return
    }
    const update = () =>
      setOverlaySize({
        width: element.clientWidth,
        height: element.clientHeight,
      })
    update()
    const ResizeObserverConstructor = typeof ResizeObserver !== "undefined" ? ResizeObserver : null
    const observer = ResizeObserverConstructor ? new ResizeObserverConstructor(() => update()) : null
    observer?.observe(element)
    return () => observer?.disconnect()
  }, [])

  const roundedWidth = width ? Math.round(width) : null
  const roundedHeight = height ? Math.round(height) : null
  const scaledWidth = width ? width * scale : 0
  const scaledHeight = height ? height * scale : 0
  const gap = 22
  const maxX = overlaySize?.width ?? Number.POSITIVE_INFINITY
  const maxY = overlaySize?.height ?? Number.POSITIVE_INFINITY
  const desiredHorizontalLine = offsetY - gap >= 0 ? offsetY - gap : offsetY + scaledHeight + gap
  const horizontalLineY = clamp(desiredHorizontalLine, 18, maxY - 18)
  const horizontalAnchorY = horizontalLineY <= offsetY ? offsetY : offsetY + scaledHeight
  const widthLabelTop = horizontalLineY
  const desiredVerticalLine = offsetX + scaledWidth + gap
  const verticalLineX = clamp(desiredVerticalLine, 18, maxX - 18)
  const verticalAnchorX = offsetX + scaledWidth
  const heightLabelLeft = verticalLineX
  const arrowId = useId()
  const arrowColor = "rgba(71, 85, 105, 0.92)"
  const connectorColor = "rgba(148, 163, 184, 0.8)"

  return (
    <div ref={overlayRef} className="pointer-events-none absolute inset-0 z-20">
      <svg className="absolute inset-0" width="100%" height="100%" aria-hidden>
        <defs>
          <marker
            id={`${arrowId}-arrow`}
            markerWidth="8"
            markerHeight="8"
            refX="4"
            refY="4"
            orient="auto-start-reverse"
            markerUnits="strokeWidth"
          >
            <path d="M0,0 L8,4 L0,8 Z" fill={arrowColor} />
          </marker>
        </defs>
        {roundedWidth ? (
          <>
            <g stroke={connectorColor} strokeWidth="1.25" strokeDasharray="4 5">
              <line x1={offsetX} y1={horizontalAnchorY} x2={offsetX} y2={horizontalLineY} />
              <line
                x1={offsetX + scaledWidth}
                y1={horizontalAnchorY}
                x2={offsetX + scaledWidth}
                y2={horizontalLineY}
              />
            </g>
            <line
              x1={offsetX}
              y1={horizontalLineY}
              x2={offsetX + scaledWidth}
              y2={horizontalLineY}
              stroke={arrowColor}
              strokeWidth="2"
              strokeDasharray="6 6"
              markerStart={`url(#${arrowId}-arrow)`}
              markerEnd={`url(#${arrowId}-arrow)`}
            />
          </>
        ) : null}
        {roundedHeight ? (
          <>
            <g stroke={connectorColor} strokeWidth="1.25" strokeDasharray="4 5">
              <line x1={verticalAnchorX} y1={offsetY} x2={verticalLineX} y2={offsetY} />
              <line
                x1={verticalAnchorX}
                y1={offsetY + scaledHeight}
                x2={verticalLineX}
                y2={offsetY + scaledHeight}
              />
            </g>
            <line
              x1={verticalLineX}
              y1={offsetY}
              x2={verticalLineX}
              y2={offsetY + scaledHeight}
              stroke={arrowColor}
              strokeWidth="2"
              strokeDasharray="6 6"
              markerStart={`url(#${arrowId}-arrow)`}
              markerEnd={`url(#${arrowId}-arrow)`}
            />
          </>
        ) : null}
      </svg>
      {roundedWidth ? (
        <span
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-slate-600 shadow-sm backdrop-blur"
          style={{ left: offsetX + scaledWidth / 2, top: widthLabelTop }}
        >
          {roundedWidth}px
        </span>
      ) : null}
      {roundedHeight ? (
        <span
          className="absolute -translate-y-1/2 rotate-90 rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-slate-600 shadow-sm backdrop-blur"
          style={{ left: heightLabelLeft, top: offsetY + scaledHeight / 2 }}
        >
          {roundedHeight}px
        </span>
      ) : null}
    </div>
  )
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

interface PanZoomState {
  scale: number
  translateX: number
  translateY: number
}

interface PanZoomViewportProps {
  children: ReactNode
  className?: string
  backgroundStyle?: React.CSSProperties
  contentWidth?: number | null
  contentHeight?: number | null
  minScale?: number
  maxScale?: number
  onTransformChange?: (meta: DimensionMeta | null) => void
}

function PanZoomViewport({
  children,
  className,
  backgroundStyle,
  contentWidth,
  contentHeight,
  minScale = 0.2,
  maxScale = 4,
  onTransformChange,
}: PanZoomViewportProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<PanZoomState>({ scale: 1, translateX: 0, translateY: 0 })
  const pointerState = useRef<{
    id: number
    x: number
    y: number
  } | null>(null)

  const fitToContainer = useCallback(() => {
    const container = containerRef.current
    if (!container || !contentWidth || !contentHeight) {
      onTransformChange?.(null)
      return
    }
    const { clientWidth, clientHeight } = container
    if (!clientWidth || !clientHeight) {
      onTransformChange?.(null)
      return
    }
    const nextScale = Math.min(clientWidth / contentWidth, clientHeight / contentHeight, 1)
    const nextTranslateX = (clientWidth - contentWidth * nextScale) / 2
    const nextTranslateY = (clientHeight - contentHeight * nextScale) / 2
    const nextState: PanZoomState = {
      scale: nextScale,
      translateX: nextTranslateX,
      translateY: nextTranslateY,
    }
    setState(nextState)
    onTransformChange?.({
      width: contentWidth,
      height: contentHeight,
      scale: nextState.scale,
      offsetX: nextState.translateX,
      offsetY: nextState.translateY,
    })
  }, [contentWidth, contentHeight, onTransformChange])

  useEffect(() => {
    fitToContainer()
  }, [fitToContainer])

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }
    const ResizeObserverConstructor = typeof ResizeObserver !== "undefined" ? ResizeObserver : null
    if (!ResizeObserverConstructor) {
      return
    }
    const observer = new ResizeObserverConstructor(() => fitToContainer())
    observer.observe(container)
    return () => observer.disconnect()
  }, [fitToContainer])

  useEffect(() => {
    if (!contentWidth || !contentHeight) {
      onTransformChange?.(null)
      return
    }
    onTransformChange?.({
      width: contentWidth,
      height: contentHeight,
      scale: state.scale,
      offsetX: state.translateX,
      offsetY: state.translateY,
    })
  }, [contentWidth, contentHeight, onTransformChange, state.scale, state.translateX, state.translateY])

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    pointerState.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    }
  }, [])

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerState.current || pointerState.current.id !== event.pointerId) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    const dx = event.clientX - pointerState.current.x
    const dy = event.clientY - pointerState.current.y
    pointerState.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    }
    setState((prev) => {
      const next = {
        scale: prev.scale,
        translateX: prev.translateX + dx,
        translateY: prev.translateY + dy,
      }
      return next
    })
  }, [])

  const endPointerInteraction = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (pointerState.current?.id === event.pointerId) {
      pointerState.current = null
    }
    event.stopPropagation()
    event.currentTarget.releasePointerCapture(event.pointerId)
  }, [])

  const handleWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      const container = containerRef.current
      if (!container) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      const { clientX, clientY, deltaY } = event
      const rect = container.getBoundingClientRect()
      const focalX = clientX - rect.left
      const focalY = clientY - rect.top
      setState((prev) => {
        const zoomFactor = Math.exp(-deltaY / 500)
        const nextScale = clamp(prev.scale * zoomFactor, minScale, maxScale)
        if (nextScale === prev.scale) {
          return prev
        }
        const offsetX = (focalX - prev.translateX) / prev.scale
        const offsetY = (focalY - prev.translateY) / prev.scale
        const nextTranslateX = focalX - offsetX * nextScale
        const nextTranslateY = focalY - offsetY * nextScale
        return {
          scale: nextScale,
          translateX: nextTranslateX,
          translateY: nextTranslateY,
        }
      })
    },
    [maxScale, minScale]
  )

  const handleDoubleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault()
      event.stopPropagation()
      fitToContainer()
    },
    [fitToContainer]
  )

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative h-full w-full overflow-hidden select-none touch-none cursor-grab active:cursor-grabbing",
        className
      )}
      style={backgroundStyle}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endPointerInteraction}
      onPointerCancel={endPointerInteraction}
      onPointerLeave={endPointerInteraction}
      onWheel={handleWheel}
      onDoubleClick={handleDoubleClick}
    >
      <div
        className="absolute left-0 top-0"
        style={{
          transform: `translate(${state.translateX}px, ${state.translateY}px) scale(${state.scale})`,
          transformOrigin: "top left",
          width: contentWidth ?? undefined,
          height: contentHeight ?? undefined,
        }}
      >
        {children}
      </div>
    </div>
  )
}

interface HtmlPreviewProps {
  html: string
  title: string
  className?: string
}

function HtmlPreview({ html, title, className }: HtmlPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [contentSize, setContentSize] = useState<{ width: number; height: number } | null>(null)
  const [contentMeta, setContentMeta] = useState<DimensionMeta | null>(null)

  const updateContentSize = useCallback(() => {
    const iframe = iframeRef.current
    if (!iframe) {
      return
    }
    const doc = iframe.contentDocument
    if (!doc) {
      return
    }
    const body = doc.body
    const docElement = doc.documentElement
    if (!body || !docElement) {
      return
    }
    body.style.margin = "0"
    docElement.style.margin = "0"
    body.style.overflow = "hidden"
    docElement.style.overflow = "hidden"
    const width = Math.max(body.scrollWidth, docElement.scrollWidth, body.offsetWidth, docElement.offsetWidth)
    const height = Math.max(body.scrollHeight, docElement.scrollHeight, body.offsetHeight, docElement.offsetHeight)
    if (!width || !height) {
      return
    }
    iframe.style.width = `${width}px`
    iframe.style.height = `${height}px`
    iframe.style.transform = "none"
    iframe.style.left = "0px"
    iframe.style.top = "0px"
    setContentSize((prev) => {
      if (prev?.width === width && prev?.height === height) {
        return prev
      }
      return { width, height }
    })
  }, [])

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) {
      return
    }
    const frameWindow = iframe.contentWindow as (Window & typeof globalThis) | null
    const MutationObserverConstructor =
      frameWindow?.MutationObserver ?? (typeof MutationObserver !== "undefined" ? MutationObserver : undefined)
    const ResizeObserverConstructor =
      frameWindow?.ResizeObserver ?? (typeof ResizeObserver !== "undefined" ? ResizeObserver : undefined)
    let cleanup: (() => void) | null = null

    const setupObservers = () => {
      const doc = iframe.contentDocument
      if (!doc) {
        return
      }
      const listeners: Array<() => void> = []
      doc.body.style.overflow = "hidden"
      doc.documentElement.style.overflow = "hidden"

      const observeImages = () => {
        const images = Array.from(doc.images)
        images.forEach((image) => {
          if (!image.complete) {
            const onLoad = () => updateContentSize()
            image.addEventListener("load", onLoad)
            image.addEventListener("error", onLoad)
            listeners.push(() => {
              image.removeEventListener("load", onLoad)
              image.removeEventListener("error", onLoad)
            })
          }
        })
      }
      observeImages()
      const mutationObserver = MutationObserverConstructor
        ? new MutationObserver(() => {
            observeImages()
            updateContentSize()
          })
        : null
      mutationObserver?.observe(doc.documentElement, {
        attributes: true,
        childList: true,
        subtree: true,
      })
      const resizeObserver = ResizeObserverConstructor
        ? new ResizeObserver(() => updateContentSize())
        : null
      resizeObserver?.observe(doc.documentElement)
      updateContentSize()
      cleanup = () => {
        listeners.forEach((dispose) => dispose())
        mutationObserver?.disconnect()
        resizeObserver?.disconnect()
      }
    }

    const handleFrameLoad = () => {
      cleanup?.()
      setupObservers()
    }

    iframe.addEventListener("load", handleFrameLoad)
    if (iframe.contentDocument?.readyState === "complete") {
      setupObservers()
    }
    const timer = setTimeout(() => updateContentSize(), 250)
    return () => {
      iframe.removeEventListener("load", handleFrameLoad)
      cleanup?.()
      clearTimeout(timer)
    }
  }, [html, updateContentSize])

  useEffect(() => {
    setContentMeta(null)
    setContentSize(null)
  }, [html])

  return (
    <div className={cn("relative h-full w-full", className)}>
      <PanZoomViewport
        className="h-full w-full"
        contentWidth={contentSize?.width}
        contentHeight={contentSize?.height}
        onTransformChange={setContentMeta}
      >
        <iframe
          ref={iframeRef}
          title={title}
          srcDoc={html}
          sandbox="allow-same-origin"
          className="block border-0"
          style={{
            width: contentSize?.width ?? undefined,
            height: contentSize?.height ?? undefined,
            pointerEvents: "none",
          }}
        />
      </PanZoomViewport>
      <DimensionOverlay
        width={contentMeta?.width}
        height={contentMeta?.height}
        scale={contentMeta?.scale}
        offsetX={contentMeta?.offsetX}
        offsetY={contentMeta?.offsetY}
      />
    </div>
  )
}

type ViewMode = "render" | "source"

function App() {
  const [dataset, setDataset] = useState<DatasetState>(initialState)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const dragDepth = useRef(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const imageUrls = useRef<string[]>([])
  const [detailedMode, setDetailedMode] = useState<ViewMode>("render")
  const [minimalMode, setMinimalMode] = useState<ViewMode>("render")
  const [referenceSize, setReferenceSize] = useState<{ width: number; height: number } | null>(null)
  const [referenceMeta, setReferenceMeta] = useState<DimensionMeta | null>(null)

  const cleanupImageUrls = useCallback(() => {
    for (const url of imageUrls.current) {
      URL.revokeObjectURL(url)
    }
    imageUrls.current = []
  }, [])

  useEffect(() => {
    if (fileInputRef.current) {
      fileInputRef.current.setAttribute("webkitdirectory", "true")
      fileInputRef.current.setAttribute("directory", "true")
    }
  }, [])

  useEffect(() => {
    return () => {
      cleanupImageUrls()
    }
  }, [cleanupImageUrls])

  const handleEntries = useCallback(
    async (entries: FileEntry[]) => {
      if (!entries.length) {
        setError("No files detected. Please drop a log folder.")
        return
      }
      setLoading(true)
      setError(null)
      try {
        const parsed = await parseExperiments(entries)
        cleanupImageUrls()
        const nextUrls: string[] = []
        const nextExperiments = parsed.experiments.map((experiment) => {
          const { imageFile, ...rest } = experiment
          const imageUrl = imageFile ? URL.createObjectURL(imageFile) : undefined
          if (imageUrl) {
            nextUrls.push(imageUrl)
          }
          return {
            ...rest,
            key: createKey(experiment),
            imageUrl,
          }
        })
        imageUrls.current = nextUrls
        setDataset({ experiments: nextExperiments, runs: parsed.runs })
        setSelectedKey(nextExperiments[0]?.key ?? null)
        if (!nextExperiments.length) {
          setError("No experiments found. Please check the folder structure.")
        }
      } catch (err) {
        setError("Unable to read the folder. Please try again.")
      } finally {
        setLoading(false)
      }
    },
    [cleanupImageUrls]
  )

  const handleDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      dragDepth.current = 0
      setIsDragging(false)
      if (!event.dataTransfer || !Array.from(event.dataTransfer.types).includes("Files")) {
        return
      }
      const files = await extractDataTransferFiles(event.dataTransfer)
      await handleEntries(files)
    },
    [handleEntries]
  )

  const handleDragEnter = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (!event.dataTransfer || !Array.from(event.dataTransfer.types).includes("Files")) {
      return
    }
    dragDepth.current += 1
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const nextTarget = event.relatedTarget as Node | null
    if (nextTarget && event.currentTarget.contains(nextTarget)) {
      return
    }
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current <= 0) {
      setIsDragging(false)
    }
  }, [])

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = "copy"
    }
  }, [])

  const handleInputChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = entriesFromFileList(event.target.files)
      await handleEntries(files)
      if (event.target) {
        event.target.value = ""
      }
    },
    [handleEntries]
  )

  const handleBrowse = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleReset = useCallback(() => {
    cleanupImageUrls()
    setDataset(initialState)
    setSelectedKey(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }, [cleanupImageUrls])

  const selectedExperiment = useMemo(
    () => dataset.experiments.find((item) => item.key === selectedKey) ?? null,
    [dataset.experiments, selectedKey]
  )

  useEffect(() => {
    setReferenceMeta(null)
    setReferenceSize(null)
  }, [selectedExperiment?.imageUrl])

  useEffect(() => {
    if (!selectedExperiment) {
      setDetailedMode("render")
      setMinimalMode("render")
      return
    }
    if (selectedExperiment.detailedHtml) {
      setDetailedMode("render")
    } else if (selectedExperiment.detailedRaw) {
      setDetailedMode("source")
    } else {
      setDetailedMode("render")
    }
    if (selectedExperiment.minimalHtml) {
      setMinimalMode("render")
    } else if (selectedExperiment.minimalRaw) {
      setMinimalMode("source")
    } else {
      setMinimalMode("render")
    }
  }, [
    selectedExperiment?.key,
    selectedExperiment?.detailedHtml,
    selectedExperiment?.detailedRaw,
    selectedExperiment?.minimalHtml,
    selectedExperiment?.minimalRaw,
  ])

  const grouped = useMemo<GroupedExperiment[]>(() => {
    const runMap = new Map<
      string,
      Map<string, Map<string, ExperimentView[]>>
    >()
    for (const experiment of dataset.experiments) {
      if (!runMap.has(experiment.run)) {
        runMap.set(experiment.run, new Map())
      }
      const providerMap = runMap.get(experiment.run)!
      if (!providerMap.has(experiment.provider)) {
        providerMap.set(experiment.provider, new Map())
      }
      const sizeMap = providerMap.get(experiment.provider)!
      if (!sizeMap.has(experiment.size)) {
        sizeMap.set(experiment.size, [])
      }
      sizeMap.get(experiment.size)!.push(experiment)
    }
    return Array.from(runMap.entries()).map(([run, providers]) => ({
      run,
      providers: Array.from(providers.entries()).map(([provider, sizes]) => ({
        provider,
        sizes: Array.from(sizes.entries()).map(([size, experiments]) => ({
          size,
          experiments,
        })),
      })),
    }))
  }, [dataset.experiments])

  const runLabel = dataset.runs.length ? dataset.runs.join(" · ") : "No runs loaded yet"
  const previewHeight = "min-h-[320px] h-[calc(100vh-320px)] max-h-[720px]"
  const gridPatternStyle = useMemo(
    () => ({
      backgroundColor: "#f8fafc",
      backgroundImage:
        "linear-gradient(to right, rgba(148, 163, 184, 0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(148, 163, 184, 0.12) 1px, transparent 1px)",
      backgroundSize: "20px 20px",
    }),
    []
  )

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 text-foreground"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        onChange={handleInputChange}
      />
      {isDragging && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-white/85 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-primary/40 bg-white px-14 py-12 text-center shadow-lg">
            <UploadCloud className="h-10 w-10 text-primary" />
            <p className="text-lg font-semibold">Drop to load this run</p>
            <p className="text-sm text-muted-foreground">Drag a full run directory with provider/size/id nesting.</p>
          </div>
        </div>
      )}
      <div className="flex min-h-screen flex-col">
        <header className="border-b border-border/60 bg-white/70 backdrop-blur">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <FolderOpen className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">Widget Viewer</h1>
                  <p className="text-sm text-muted-foreground">
                    Compare generated widgets against their reference screenshots at a glance.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{runLabel}</span>
                {dataset.experiments.length > 0 && (
                  <span>{dataset.experiments.length} experiments</span>
                )}
                {loading && (
                  <span className="flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />Processing
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                onClick={handleBrowse}
                disabled={loading}
                className="shadow-sm"
              >
                <UploadCloud className="mr-2 h-4 w-4" />Upload Folder
              </Button>
              <Button
                variant="ghost"
                onClick={handleReset}
                disabled={!dataset.experiments.length && !error}
                className="text-muted-foreground hover:bg-muted"
              >
                Reset
              </Button>
            </div>
          </div>
        </header>
        <main className="flex flex-1 overflow-hidden">
          <div className="flex w-full flex-1 gap-8 px-10 py-8">
            <aside className="hidden w-[360px] shrink-0 xl:flex">
              <div className="flex h-full w-full flex-col overflow-hidden rounded-3xl border border-border/60 bg-white/90 shadow-lg shadow-slate-200/70 backdrop-blur">
                <div className="flex items-center justify-between px-6 pb-3 pt-6">
                  <span className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
                    Experiments
                  </span>
                  {dataset.experiments.length > 0 && (
                    <Badge variant="secondary" className="bg-primary/10 text-primary">
                      {dataset.experiments.length}
                    </Badge>
                  )}
                </div>
                <div className="flex-1 overflow-hidden px-2 pb-6">
                  <Command className="h-full rounded-2xl border border-border/50 bg-white/80">
                    <CommandInput placeholder="Filter experiments..." />
                    <CommandList className="max-h-full overflow-y-auto">
                      <CommandEmpty>No experiments match your query.</CommandEmpty>
                      {grouped.map((run) => (
                        <CommandGroup key={run.run} heading={run.run} className="space-y-3">
                          {run.providers.map((provider) => (
                            <div key={`${run.run}-${provider.provider}`} className="space-y-2 rounded-2xl bg-muted/30 p-3">
                              <div className="flex items-center justify-between text-sm font-medium text-foreground">
                                <span>{provider.provider}</span>
                                <span className="text-xs text-muted-foreground">
                                  {provider.sizes.reduce((acc, size) => acc + size.experiments.length, 0)}
                                </span>
                              </div>
                              <div className="space-y-2">
                                {provider.sizes.map((size) => (
                                  <div key={`${run.run}-${provider.provider}-${size.size}`} className="space-y-1">
                                    <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                                      {size.size}
                                    </div>
                                    <div className="space-y-1">
                                      {size.experiments.map((experiment) => (
                                        <CommandItem
                                          key={experiment.key}
                                          value={`${run.run} ${provider.provider} ${size.size} ${experiment.id}`}
                                          onSelect={() => setSelectedKey(experiment.key)}
                                          className={cn(
                                            "group flex items-center justify-between rounded-xl border px-3 py-2 text-sm transition",
                                            selectedKey === experiment.key
                                              ? "border-primary/60 bg-primary/10 text-primary"
                                              : "border-transparent bg-white/80 text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-foreground"
                                          )}
                                        >
                                          <span className="font-medium">{experiment.id}</span>
                                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                            {experiment.imageUrl && <ImageIcon className="h-3.5 w-3.5" />}
                                            {experiment.detailedHtml && <FileCode2 className="h-3.5 w-3.5" />}
                                            {experiment.minimalHtml && <FileText className="h-3.5 w-3.5" />}
                                          </span>
                                        </CommandItem>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </CommandGroup>
                      ))}
                    </CommandList>
                  </Command>
                </div>
              </div>
            </aside>
            <section className="flex flex-1 flex-col overflow-hidden rounded-3xl border border-border/60 bg-white/90 shadow-xl shadow-slate-200/60 backdrop-blur">
            <div className="flex-1 overflow-y-auto px-6 py-8">
              {error && (
                <div className="mb-6 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              {selectedExperiment ? (
                <div className="space-y-8">
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge variant="secondary" className="bg-white/80 text-foreground shadow-sm">
                      Run · {selectedExperiment.run}
                    </Badge>
                    <Badge variant="secondary" className="bg-white/80 text-foreground shadow-sm">
                      Provider · {selectedExperiment.provider}
                    </Badge>
                    <Badge variant="secondary" className="bg-white/80 text-foreground shadow-sm">
                      Size · {selectedExperiment.size}
                    </Badge>
                    <Badge variant="outline" className="border-primary/60 text-primary">
                      #{selectedExperiment.id}
                    </Badge>
                  </div>
                  <div className="grid gap-6 xl:grid-cols-3">
                    <Card className="flex h-full flex-col overflow-hidden border-0 bg-white/90 shadow-lg shadow-slate-200/70 ring-1 ring-black/5">
                      <CardHeader className="space-y-1 border-b border-border/40">
                        <CardTitle className="text-base font-semibold">Reference Image</CardTitle>
                      </CardHeader>
                      <CardContent className={cn("flex flex-1 flex-col gap-4 p-6", previewHeight)}>
                        {selectedExperiment.imageUrl ? (
                          <div
                            className="relative h-full w-full overflow-hidden rounded-[26px] border border-border/40 bg-white/70 shadow-inner shadow-slate-200/80"
                            style={gridPatternStyle}
                          >
                            <PanZoomViewport
                              className="h-full w-full"
                              contentWidth={referenceSize?.width}
                              contentHeight={referenceSize?.height}
                              onTransformChange={setReferenceMeta}
                            >
                              <img
                                src={selectedExperiment.imageUrl}
                                alt={selectedExperiment.id}
                                className="block rounded-2xl shadow"
                                style={{
                                  width: referenceSize?.width ?? "auto",
                                  height: referenceSize?.height ?? "auto",
                                }}
                                onLoad={(event) =>
                                  setReferenceSize({
                                    width: event.currentTarget.naturalWidth,
                                    height: event.currentTarget.naturalHeight,
                                  })
                                }
                                onError={() => {
                                  setReferenceSize(null)
                                  setReferenceMeta(null)
                                }}
                              />
                            </PanZoomViewport>
                            <DimensionOverlay
                              width={referenceMeta?.width}
                              height={referenceMeta?.height}
                              scale={referenceMeta?.scale}
                              offsetX={referenceMeta?.offsetX}
                              offsetY={referenceMeta?.offsetY}
                            />
                          </div>
                        ) : (
                          <div
                            className="flex h-full w-full items-center justify-center rounded-[26px] border border-dashed border-border/60 bg-muted/30"
                            style={gridPatternStyle}
                          >
                            <p className="text-sm text-muted-foreground">No reference image available.</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                    <Card className="flex h-full flex-col overflow-hidden border-0 bg-white/90 shadow-lg shadow-slate-200/70 ring-1 ring-black/5">
                      <CardHeader className="space-y-1 border-b border-border/40">
                        <div className="flex items-center justify-between gap-4">
                          <CardTitle className="text-base font-semibold">Detailed HTML</CardTitle>
                          <ToggleGroup
                            type="single"
                            value={detailedMode}
                            onValueChange={(value) => value && setDetailedMode(value as ViewMode)}
                          >
                            <ToggleGroupItem
                              value="render"
                              disabled={!selectedExperiment.detailedHtml}
                            >
                              Render
                            </ToggleGroupItem>
                            <ToggleGroupItem
                              value="source"
                              disabled={!selectedExperiment.detailedRaw}
                            >
                              Source
                            </ToggleGroupItem>
                          </ToggleGroup>
                        </div>
                      </CardHeader>
                      <CardContent className={cn("flex flex-1 flex-col gap-4 p-6", previewHeight)}>
                        {selectedExperiment.detailedHtml || selectedExperiment.detailedRaw ? (
                          <div className="relative flex flex-1">
                            {detailedMode === "render" && selectedExperiment.detailedHtml ? (
                              <div
                                className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[26px] border border-border/40 bg-white/70 shadow-inner shadow-slate-200/80"
                                style={gridPatternStyle}
                              >
                                <HtmlPreview
                                  html={selectedExperiment.detailedHtml}
                                  title={`${selectedExperiment.id}-detailed-html`}
                                  className="h-full w-full rounded-[26px]"
                                />
                              </div>
                            ) : detailedMode === "source" && selectedExperiment.detailedRaw ? (
                              <div className="h-full w-full overflow-auto rounded-2xl border border-border/50 bg-muted/40 p-4">
                                <pre className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/80">
                                  {selectedExperiment.detailedRaw}
                                </pre>
                              </div>
                            ) : (
                              <div className="flex h-full w-full items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/30 text-sm text-muted-foreground">
                                No detailed content available.
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/30 text-sm text-muted-foreground">
                            No detailed HTML for this experiment.
                          </div>
                        )}
                      </CardContent>
                    </Card>
                    <Card className="flex h-full flex-col overflow-hidden border-0 bg-white/90 shadow-lg shadow-slate-200/70 ring-1 ring-black/5">
                      <CardHeader className="space-y-1 border-b border-border/40">
                        <div className="flex items-center justify-between gap-4">
                          <CardTitle className="text-base font-semibold">Minimal HTML</CardTitle>
                          <ToggleGroup
                            type="single"
                            value={minimalMode}
                            onValueChange={(value) => value && setMinimalMode(value as ViewMode)}
                          >
                            <ToggleGroupItem
                              value="render"
                              disabled={!selectedExperiment.minimalHtml}
                            >
                              Render
                            </ToggleGroupItem>
                            <ToggleGroupItem
                              value="source"
                              disabled={!selectedExperiment.minimalRaw}
                            >
                              Source
                            </ToggleGroupItem>
                          </ToggleGroup>
                        </div>
                      </CardHeader>
                      <CardContent className={cn("flex flex-1 flex-col gap-4 p-6", previewHeight)}>
                        {selectedExperiment.minimalHtml || selectedExperiment.minimalRaw ? (
                          <div className="relative flex flex-1">
                            {minimalMode === "render" && selectedExperiment.minimalHtml ? (
                              <div
                                className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[26px] border border-border/40 bg-white/70 shadow-inner shadow-slate-200/80"
                                style={gridPatternStyle}
                              >
                                <HtmlPreview
                                  html={selectedExperiment.minimalHtml}
                                  title={`${selectedExperiment.id}-minimal-html`}
                                  className="h-full w-full rounded-[26px]"
                                />
                              </div>
                            ) : minimalMode === "source" && selectedExperiment.minimalRaw ? (
                              <div className="h-full w-full overflow-auto rounded-2xl border border-border/50 bg-muted/40 p-4">
                                <pre className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/80">
                                  {selectedExperiment.minimalRaw}
                                </pre>
                              </div>
                            ) : (
                              <div className="flex h-full w-full items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/30 text-sm text-muted-foreground">
                                No minimal content available.
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/30 text-sm text-muted-foreground">
                            No minimal HTML for this experiment.
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-5 rounded-3xl border border-dashed border-border/60 bg-white/70 p-12 text-center">
                  <UploadCloud className="h-12 w-12 text-primary" />
                  <div className="space-y-2">
                    <h2 className="text-xl font-semibold tracking-tight">Drag in a log folder to get started</h2>
                    <p className="text-sm text-muted-foreground">
                      Provide a run directory structured as run/provider/size/id or choose one via the upload button.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="bg-white/60 text-foreground">
                      Drag & drop supported
                    </Badge>
                    <Badge variant="secondary" className="bg-white/60 text-foreground">
                      Local parsing only
                    </Badge>
                    <Badge variant="secondary" className="bg-white/60 text-foreground">
                      Works offline
                    </Badge>
                  </div>
                </div>
              )}
            </div>
            <Separator className="xl:hidden" />
            <div className="border-t border-border/50 bg-white/70 px-6 py-4 text-xs text-muted-foreground xl:hidden">
              {dataset.experiments.length ? (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {dataset.experiments.map((experiment) => (
                    <button
                      key={experiment.key}
                      type="button"
                      className={cn(
                        "whitespace-nowrap rounded-full border px-3 py-1",
                        selectedKey === experiment.key
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border/40 bg-white/80 text-muted-foreground"
                      )}
                      onClick={() => setSelectedKey(experiment.key)}
                    >
                      {experiment.id}
                    </button>
                  ))}
                </div>
              ) : (
                <span>No experiments loaded.</span>
              )}
            </div>
          </section>
        </div>
        </main>
      </div>
    </div>
  )
}

export default App
