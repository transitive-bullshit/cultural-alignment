'use client'

import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type MutableRefObject
} from 'react'
import {
  Color,
  DataTexture,
  DynamicDrawUsage,
  InstancedMesh,
  LinearFilter,
  MathUtils,
  Object3D,
  OrthographicCamera,
  PlaneGeometry,
  RGBAFormat,
  ShaderMaterial,
  SRGBColorSpace,
  Texture,
  UnsignedByteType,
  Vector2,
  Vector3,
  type Camera,
  type WebGLRenderer
} from 'three'

import {
  calculateVelocityDeformation,
  calculateInertialLaunchVelocity,
  createProjectedSurfaceLayout,
  damp,
  decayInertia,
  projectWheelToHorizontal,
  toroidalDelta,
  wrapCentered,
  type FieldMotion,
  type ProjectedSurfaceSlot
} from '@/lib/spatial/field'

import {
  GALLERY_BRACKET_INSET_RATIO as BRACKET_INSET_RATIO,
  GALLERY_BRACKET_THICKNESS_RATIO as BRACKET_THICKNESS_RATIO,
  GALLERY_FRAME_ASPECT as FRAME_ASPECT,
  GALLERY_SELECTED_SCALE as SELECTED_SCALE,
  getGalleryDecoratedFrameHalfHeight,
  getGalleryGeometry,
  getGalleryLaneCount,
  getGalleryLaneCountForZoom,
  getGalleryLayoutViewportWidth,
  getGalleryTargetZoom
} from './gallery-sizing'
import {
  getGalleryLaneTargetXOffset,
  getGalleryLaneTargetY,
  getGalleryLaneWindowStart,
  isGalleryLaneActive,
  shouldRenderGalleryLane,
  stepGalleryLaneCount,
  syncGalleryTextureLaneMask
} from './gallery-lane-motion'
import {
  calculateGalleryWarpOffset,
  DIMMED_ACTIVITY,
  getDirectionalDamping,
  getSlotActivityTarget,
  getSlotScaleTarget,
  resolveVisibleRestoredOffset,
  resolveWarpedPointerSlot,
  resolveVisualSlotIndex,
  type ActiveSlot
} from './selection'
import styles from './spatial-gallery.module.css'
import {
  getTextureBindingLimit,
  isMobileGalleryViewport,
  planTextureBindings,
  planTextureLoads,
  prioritizeTextureItemIndices,
  settleTextureLoad,
  type TextureLoadStage
} from './texture-residency'
import type {
  SpatialGalleryController,
  SpatialGalleryItem,
  SpatialGalleryTopology
} from './types'

const PAPER = new Color('#e8dece')
const PAPER_LIGHT = '#f8f0df'
const ELECTRIC = '#ff4d1f'
const BRACKET_ARM_RATIO = 0.14
const HOVER_ENTER_DAMPING = 18
const HOVER_SCALE_EXIT_DAMPING = 9
const HOVER_ACTIVITY_EXIT_DAMPING = 8
const POINTER_HIT_PADDING = 0.08
const MAX_VELOCITY = 30
const WARP_REFERENCE_VELOCITY = 30
const WARP_DAMPING = 15
const INERTIA_DAMPING = 3.4
const MAX_FRAME_DELTA = 0.1
const WHEEL_DIRECT_GAIN = 0.18
const WHEEL_IMPULSE_GAIN = 12
const INTRO_TRAVEL_COLUMNS = 3.6
const DESKTOP_DISMISSAL_BURST_TRAVEL_COLUMNS = INTRO_TRAVEL_COLUMNS * 1.5
const MOBILE_DISMISSAL_BURST_TRAVEL_COLUMNS = INTRO_TRAVEL_COLUMNS / 4
const INTRO_REST_FRACTION = 0.025
const INTRO_VISIBILITY_THRESHOLD = 0.2
const FULL_TEXTURE_LOAD_CONCURRENCY = 32
const IDLE_TEXTURE_LOAD_CONCURRENCY = 16
const PLACEHOLDER_TEXTURE_LOAD_CONCURRENCY = 4
const TEXTURE_LOOKAHEAD_SECONDS = 0.2
const TEXTURE_IDLE_TIMEOUT_MILLISECONDS = 1_000
const TEXTURE_IDLE_VELOCITY_THRESHOLD = 0.1
const TEXTURE_SWEEP_INTERVAL_SECONDS = 0.12
const SIZING_DAMPING = 18
const SIZING_ZOOM_EPSILON = 0.01
const SIZING_POSITION_EPSILON = 0.001

const warpVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying float vActivity;
  varying float vSurfaceU;
  uniform float uRowGap;
  uniform float uRowOverride;
  uniform float uUseRowOverride;
  uniform float uViewportAspect;
  uniform float uWarpSpeed;

  const float PI = 3.141592653589793;

  void main() {
    vUv = uv;
    #ifdef USE_INSTANCING_COLOR
      vActivity = instanceColor.r;
    #else
      vActivity = 0.0;
    #endif
    vec4 instancePosition = instanceMatrix * vec4(position, 1.0);
    vec4 clip = projectionMatrix * modelViewMatrix * instancePosition;
    float u = clamp(clip.x / clip.w * 0.5 + 0.5, 0.0, 1.0);
    float edge = 0.15 * uWarpSpeed * tan(0.9 * PI * (u - 0.5));
    float derivedRowCoefficient = instanceMatrix[3].y / uRowGap;
    float rowCoefficient = mix(
      derivedRowCoefficient,
      uRowOverride,
      uUseRowOverride
    );
    float row = -2.0 * uWarpSpeed * rowCoefficient * (
      0.016667 * uViewportAspect
    );

    clip.y += clip.w * (edge + row);
    vSurfaceU = u;
    gl_Position = clip;
  }
`

const imageFragmentShader = /* glsl */ `
  varying vec2 vUv;
  varying float vActivity;
  varying float vSurfaceU;
  uniform sampler2D uTexture;
  uniform vec2 uTextureSize;
  uniform vec2 uFocalPoint;
  uniform float uFrameAspect;
  uniform vec3 uPaper;

  vec2 coverUv(vec2 uv) {
    float textureAspect = uTextureSize.x / uTextureSize.y;
    vec2 coveredUv = uv;

    if (textureAspect > uFrameAspect) {
      float visibleFraction = uFrameAspect / textureAspect;
      float center = clamp(
        uFocalPoint.x,
        visibleFraction * 0.5,
        1.0 - visibleFraction * 0.5
      );
      coveredUv.x = center + (uv.x - 0.5) * visibleFraction;
    } else {
      float visibleFraction = textureAspect / uFrameAspect;
      float center = clamp(
        uFocalPoint.y,
        visibleFraction * 0.5,
        1.0 - visibleFraction * 0.5
      );
      coveredUv.y = center + (uv.y - 0.5) * visibleFraction;
    }

    return coveredUv;
  }

  void main() {
    vec4 sampled = texture2D(uTexture, coverUv(vUv));
    float luminance = dot(sampled.rgb, vec3(0.299, 0.587, 0.114));
    vec3 charcoal = mix(vec3(luminance), uPaper, 0.38);
    vec3 paperWashed = mix(charcoal, uPaper, 0.24);
    vec3 vivid = sampled.rgb * vec3(1.025, 1.0, 0.965);
    float distanceFromCenter = clamp(abs(vSurfaceU - 0.5) * 2.0, 0.0, 1.0);
    float edgeWash = smoothstep(0.5, 1.0, distanceFromCenter);
    float vividness = vActivity * (1.0 - edgeWash * 0.88);

    gl_FragColor = vec4(mix(paperWashed, vivid, vividness), sampled.a);
  }
`

const flatFragmentShader = /* glsl */ `
  uniform vec3 uColor;

  void main() {
    gl_FragColor = vec4(uColor, 1.0);
  }
`

type CanvasProps = Readonly<{
  controllerRef: MutableRefObject<SpatialGalleryController | null>
  inertiaBurst: boolean
  initialIndex: number
  initialOffsetX: number | null
  initialTopology: SpatialGalleryTopology | null
  animateItemSize: boolean
  itemSize: number
  items: readonly SpatialGalleryItem[]
  onPressItem(index: number): void
  onSelectItem(index: number): void
  onTransitionReady(): void
  reducedMotion: boolean
}>

type ScenarioSlot = Readonly<{
  slot: ProjectedSurfaceSlot
  slotIndex: number
}>

type IntroState = 'waiting' | 'running' | 'finished'
type AutoMotionInterruption = 'interrupted' | 'skipped'
type IntroMotionDiagnostic =
  | AutoMotionInterruption
  | 'running'
  | 'settled'
  | 'waiting'
type InertiaBurstDiagnostic =
  | AutoMotionInterruption
  | 'launched'
  | 'pending'
  | 'settled'
type GallerySizingMotionDiagnostic = 'running' | 'settled'

type PendingTextureRequest = Readonly<{
  cancel(): void
  promote(): void
}>

type TextureFetchPriority = 'high' | 'low'

type GalleryLaneMotionState = {
  active: Uint8Array
  key: string
  rendered: Uint8Array
  texturePriority: Uint8Array
  visibleLanes: number
  windowStart: number
  x: Float32Array
  y: Float32Array
}

type GallerySizingMotionState = {
  configurationKey: string
  itemSize: number
  smooth: boolean
  zoom: number
}

export function SpatialGalleryCanvas(props: CanvasProps) {
  return (
    <div className={styles.canvasWrap} aria-hidden='true'>
      <Canvas
        orthographic
        camera={{ position: [0, 0, 20], zoom: 100, near: 0.1, far: 60 }}
        dpr={[1, 1.75]}
        gl={{
          alpha: true,
          antialias: true,
          powerPreference: 'high-performance'
        }}
        fallback={<CanvasUnavailable />}
      >
        <SpatialField {...props} />
      </Canvas>
    </div>
  )
}

function SpatialField({
  animateItemSize,
  controllerRef,
  inertiaBurst,
  initialIndex,
  initialOffsetX,
  initialTopology,
  itemSize,
  items,
  onPressItem,
  onSelectItem,
  onTransitionReady,
  reducedMotion
}: CanvasProps) {
  const draggingRef = useRef(false)
  const canvasBoundsRef = useRef<DOMRect | null>(null)
  const hoveredSlotRef = useRef<ActiveSlot | null>(null)
  const initializedStateRef = useRef<string | null>(null)
  const inertiaBurstActiveRef = useRef(false)
  const inertiaBurstHandledRef = useRef(false)
  const inertiaBurstVelocityRef = useRef(0)
  const introStateRef = useRef<IntroState>('waiting')
  const introVelocityRef = useRef(0)
  const pointerPositionRef = useRef<{
    clientX: number
    clientY: number
  } | null>(null)
  const pressedSlotRef = useRef<ActiveSlot | null>(null)
  const lastCenterIndexRef = useRef(initialIndex)
  const selectedItemIndexRef = useRef(initialIndex)
  const selectedLaneRef = useRef(0)
  const selectionOverrideRef = useRef<number | null>(initialIndex)
  const snapTargetRef = useRef<number | null>(null)
  const warpSpeedRef = useRef(0)
  const zoomRef = useRef(100)
  const viewportWidthRef = useRef(10)
  const laneMotionRef = useRef<GalleryLaneMotionState | null>(null)
  const sizingMotionRef = useRef<GallerySizingMotionState | null>(null)
  const motionRef = useRef<FieldMotion>({
    offset: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 }
  })
  const disposedRef = useRef(false)
  const failedFullTextureItemsRef = useRef(new Set<number>())
  const failedPlaceholderTextureItemsRef = useRef(new Set<number>())
  const boundFullTextureItemsRef = useRef(new Set<number>())
  const fullTextureItemsRef = useRef(new Set<number>())
  const idleTextureItemsRef = useRef<readonly number[]>([])
  const nearbyTextureItemsRef = useRef(new Set<number>())
  const pendingFullTextureRequestsRef = useRef(
    new Map<number, PendingTextureRequest>()
  )
  const pendingPlaceholderTextureRequestsRef = useRef(
    new Map<number, PendingTextureRequest>()
  )
  const prioritizedTextureItemsRef = useRef<readonly number[]>([])
  const residentTexturesRef = useRef(new Map<number, Texture>())
  const textureIdleCancelRef = useRef<(() => void) | null>(null)
  const textureGenerationRef = useRef(1)
  const transitionReadyRef = useRef(false)
  const lastTextureSweepRef = useRef(Number.NEGATIVE_INFINITY)
  const { camera, gl, size } = useThree()
  const mobile = isMobileGalleryViewport(size.width)
  const maximumBoundFullTextures = getTextureBindingLimit(size.width)
  const galleryGeometry = getGalleryGeometry(mobile)
  const {
    columnGap,
    defaultLanes,
    frameWidth,
    maximumLanes,
    overscan,
    rowGap,
    stagger
  } = galleryGeometry
  const targetLanes = getGalleryLaneCount(
    mobile,
    size.width,
    size.height,
    itemSize
  )
  const frameHeight = frameWidth / FRAME_ASPECT
  const targetZoom = getGalleryTargetZoom(
    mobile,
    size.width,
    size.height,
    itemSize
  )
  const layoutViewportWidth = getGalleryLayoutViewportWidth(
    mobile,
    size.width,
    size.height
  )
  // oxlint-disable react/preserve-manual-memoization -- The fixed-capacity field intentionally keys its topology to primitive geometry values.
  const layout = useMemo(
    () =>
      createProjectedSurfaceLayout(items.length, {
        assignmentLanes: defaultLanes,
        lanes: maximumLanes,
        columnGap,
        rowGap,
        viewportWidth: layoutViewportWidth,
        itemWidth: frameWidth,
        overscan,
        stagger: 0
      }),
    [
      columnGap,
      defaultLanes,
      frameWidth,
      items.length,
      layoutViewportWidth,
      maximumLanes,
      overscan,
      rowGap
    ]
  )
  // oxlint-enable react/preserve-manual-memoization
  const laneMotionKey = `${mobile}:${maximumLanes}:${rowGap}:${stagger}`
  let laneMotion = laneMotionRef.current
  if (
    !laneMotion ||
    laneMotion.key !== laneMotionKey ||
    !laneMotion.rendered ||
    !laneMotion.texturePriority
  ) {
    laneMotion = createGalleryLaneMotionState({
      hiddenLaneCenter: getHiddenGalleryLaneCenter(
        size.height,
        targetZoom,
        frameWidth
      ),
      key: laneMotionKey,
      maximumLanes,
      rowGap,
      stagger,
      visibleLanes: targetLanes
    })
    laneMotionRef.current = laneMotion
  }
  const previousLayoutRef = useRef(layout)
  const scenarioSlots = useMemo(
    () =>
      items.map((_, itemIndex) =>
        layout.slots.flatMap((slot, slotIndex): ScenarioSlot[] =>
          slot.itemIndex === itemIndex ? [{ slot, slotIndex }] : []
        )
      ),
    [items, layout]
  )
  const geometry = useMemo(() => new PlaneGeometry(1, 1, 20, 12), [])
  const placeholderTexture = useMemo(() => createPlaceholderTexture(), [])
  const backingMaterial = useMemo(
    () => createFlatMaterial(PAPER_LIGHT, false),
    []
  )
  const bracketMaterial = useMemo(() => createFlatMaterial(ELECTRIC, true), [])
  const imageMaterials = useMemo(
    () => items.map((item) => createImageMaterial(item, placeholderTexture)),
    [items, placeholderTexture]
  )
  const warpMaterials = useMemo(
    () => [backingMaterial, bracketMaterial, ...imageMaterials],
    [backingMaterial, bracketMaterial, imageMaterials]
  )
  const backingMesh = useMemo(
    () => createInstancedMesh(geometry, backingMaterial, layout.slots.length),
    [backingMaterial, geometry, layout.slots.length]
  )
  const bracketMesh = useMemo(() => {
    const mesh = createInstancedMesh(geometry, bracketMaterial, 8)
    mesh.visible = false
    return mesh
  }, [bracketMaterial, geometry])
  const imageMeshes = useMemo(
    () =>
      scenarioSlots.map((slots, index) =>
        createImageInstancedMesh(geometry, imageMaterials[index]!, slots.length)
      ),
    [geometry, imageMaterials, scenarioSlots]
  )
  const slotXPositions = useMemo(
    () =>
      Float32Array.from(
        layout.slots,
        ({ lane, x }) => x + (laneMotion.x[lane] ?? 0)
      ),
    [laneMotion, layout.slots]
  )
  const slotYPositions = useMemo(
    () =>
      Float32Array.from(layout.slots, ({ lane, y }) => laneMotion.y[lane] ?? y),
    [laneMotion, layout.slots]
  )
  const slotScales = useMemo(() => {
    const scales = new Float32Array(layout.slots.length)
    scales.fill(1)
    return scales
  }, [layout.slots.length])
  const slotActivities = useMemo(() => {
    const activities = new Float32Array(layout.slots.length)
    activities.fill(DIMMED_ACTIVITY)
    return activities
  }, [layout.slots.length])
  const activityColor = useMemo(() => new Color(), [])
  const transform = useMemo(() => new Object3D(), [])
  const cancelIntro = useCallback(
    (motionState: AutoMotionInterruption = 'interrupted') => {
      const introActive = introStateRef.current !== 'finished'
      const burstActive = inertiaBurstActiveRef.current
      if (!introActive && !burstActive) return

      if (introStateRef.current === 'running' || burstActive) {
        motionRef.current = {
          offset: motionRef.current.offset,
          velocity: { x: 0, y: 0 }
        }
      }

      if (introActive) {
        introStateRef.current = 'finished'
        setIntroMotionDiagnostic(gl, motionState)
      }
      if (burstActive) {
        inertiaBurstActiveRef.current = false
        setInertiaBurstDiagnostic(gl, motionState)
      }
    },
    [gl]
  )

  const resolvePointerSlotAt = useCallback(
    (clientX: number, clientY: number) => {
      const bounds =
        canvasBoundsRef.current ?? gl.domElement.getBoundingClientRect()
      if (
        bounds.width <= 0 ||
        bounds.height <= 0 ||
        clientX < bounds.left ||
        clientX > bounds.right ||
        clientY < bounds.top ||
        clientY > bounds.bottom
      ) {
        return null
      }

      return resolveWarpedPointerSlot({
        activeLanes: laneMotion.active,
        frameHeight,
        frameWidth,
        hitPadding: POINTER_HIT_PADDING,
        pointerNdc: {
          x: ((clientX - bounds.left) / bounds.width) * 2 - 1,
          y: 1 - ((clientY - bounds.top) / bounds.height) * 2
        },
        rowGap,
        scales: slotScales,
        slots: layout.slots,
        viewportAspect: size.width / size.height,
        viewportWidth: viewportWidthRef.current,
        warpSpeed: warpSpeedRef.current,
        xPositions: slotXPositions,
        yPositions: slotYPositions
      })
    },
    [
      frameHeight,
      frameWidth,
      gl,
      laneMotion,
      layout.slots,
      rowGap,
      size.height,
      size.width,
      slotScales,
      slotXPositions,
      slotYPositions
    ]
  )

  const applyPointerHit = useCallback(
    (activeSlot: ActiveSlot | null) => {
      const previousSlot = hoveredSlotRef.current
      hoveredSlotRef.current = activeSlot
      if (!activeSlot) return

      selectionOverrideRef.current = null
      if (
        previousSlot?.itemIndex === activeSlot.itemIndex &&
        previousSlot.slotIndex === activeSlot.slotIndex
      ) {
        return
      }

      selectedItemIndexRef.current = activeSlot.itemIndex
      selectedLaneRef.current =
        layout.slots[activeSlot.slotIndex]?.lane ?? selectedLaneRef.current
      onSelectItem(activeSlot.itemIndex)
    },
    [layout.slots, onSelectItem]
  )

  useEffect(() => {
    const updateBounds = () => {
      canvasBoundsRef.current = gl.domElement.getBoundingClientRect()
    }
    updateBounds()

    const resizeObserver = new ResizeObserver(updateBounds)
    resizeObserver.observe(gl.domElement)
    window.addEventListener('resize', updateBounds, { passive: true })
    window.addEventListener('scroll', updateBounds, {
      capture: true,
      passive: true
    })

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateBounds)
      window.removeEventListener('scroll', updateBounds, true)
    }
  }, [gl])

  useEffect(() => {
    const boundFullTextureItems = boundFullTextureItemsRef.current
    const disposed = disposedRef
    const failedFullTextureItems = failedFullTextureItemsRef.current
    const failedPlaceholderTextureItems =
      failedPlaceholderTextureItemsRef.current
    const fullTextureItems = fullTextureItemsRef.current
    const idleTextureItems = idleTextureItemsRef
    const nearbyTextureItems = nearbyTextureItemsRef.current
    const pendingFullTextureRequests = pendingFullTextureRequestsRef.current
    const pendingPlaceholderTextureRequests =
      pendingPlaceholderTextureRequestsRef.current
    const prioritizedTextureItems = prioritizedTextureItemsRef
    const residentTextures = residentTexturesRef.current
    const textureIdleCancel = textureIdleCancelRef

    disposedRef.current = false
    syncTextureDiagnostics(
      gl,
      residentTextures,
      fullTextureItems,
      boundFullTextureItems,
      getTextureBindingLimit(gl.domElement.clientWidth)
    )

    return () => {
      disposed.current = true
      textureIdleCancel.current?.()
      textureIdleCancel.current = null
      textureGenerationRef.current += 1
      for (const texture of residentTextures.values()) {
        texture.dispose()
      }
      failedFullTextureItems.clear()
      failedPlaceholderTextureItems.clear()
      boundFullTextureItems.clear()
      fullTextureItems.clear()
      idleTextureItems.current = []
      nearbyTextureItems.clear()
      prioritizedTextureItems.current = []
      for (const request of pendingFullTextureRequests.values()) {
        request.cancel()
      }
      for (const request of pendingPlaceholderTextureRequests.values()) {
        request.cancel()
      }
      pendingFullTextureRequests.clear()
      pendingPlaceholderTextureRequests.clear()
      residentTextures.clear()
      delete gl.domElement.dataset.galleryBoundTextures
      delete gl.domElement.dataset.galleryBindingLimit
      delete gl.domElement.dataset.galleryFullTextures
      delete gl.domElement.dataset.galleryPlaceholderTextures
    }
  }, [gl, imageMaterials])

  useEffect(() => () => backingMesh.dispose(), [backingMesh])

  useEffect(() => () => bracketMesh.dispose(), [bracketMesh])

  useEffect(
    () => () => {
      for (const mesh of imageMeshes) mesh.dispose()
    },
    [imageMeshes]
  )

  useEffect(
    () => () => {
      backingMaterial.dispose()
      bracketMaterial.dispose()
      for (const material of imageMaterials) material.dispose()
    },
    [backingMaterial, bracketMaterial, imageMaterials]
  )

  useEffect(
    () => () => {
      geometry.dispose()
      placeholderTexture.dispose()
    },
    [geometry, placeholderTexture]
  )

  useEffect(() => {
    setIntroMotionDiagnostic(
      gl,
      initialOffsetX === null ? 'waiting' : 'skipped'
    )
    setInertiaBurstDiagnostic(gl, 'pending')

    return () => clearMotionDiagnostics(gl)
  }, [gl, initialOffsetX])

  useEffect(() => {
    syncGallerySizingDiagnostics({
      capacityLanes: maximumLanes,
      gl,
      itemSize,
      renderedLanes: laneMotion.visibleLanes,
      targetLanes,
      targetZoom
    })
  }, [gl, itemSize, laneMotion, maximumLanes, targetLanes, targetZoom])

  useEffect(() => () => clearGallerySizingDiagnostics(gl), [gl])

  useEffect(() => {
    const previousLayout = previousLayoutRef.current
    previousLayoutRef.current = layout
    if (previousLayout === layout || initializedStateRef.current === null)
      return

    const selectedItemIndex = selectedItemIndexRef.current
    const selectedSlotIndex = findClosestSlotForItem(
      layout.slots,
      selectedItemIndex,
      motionRef.current.offset.x,
      layout.span,
      laneMotion.active,
      slotYPositions,
      laneMotion.x
    )
    if (selectedSlotIndex === null) return
    const selectedSlot = layout.slots[selectedSlotIndex]
    if (!selectedSlot) return
    const currentX = wrapCentered(
      selectedSlot.x +
        (laneMotion.x[selectedSlot.lane] ?? 0) +
        motionRef.current.offset.x,
      layout.span
    )
    const offsetX =
      motionRef.current.offset.x + toroidalDelta(currentX, 0, layout.span)

    draggingRef.current = false
    hoveredSlotRef.current = null
    pointerPositionRef.current = null
    pressedSlotRef.current = null
    snapTargetRef.current = null
    selectionOverrideRef.current = selectedItemIndex
    selectedLaneRef.current = selectedSlot.lane
    lastCenterIndexRef.current = selectedItemIndex
    const automaticVelocityActive =
      introStateRef.current === 'running' || inertiaBurstActiveRef.current
    motionRef.current = {
      offset: { x: offsetX, y: 0 },
      velocity: automaticVelocityActive
        ? motionRef.current.velocity
        : { x: 0, y: 0 }
    }
  }, [laneMotion, layout, slotYPositions])

  useEffect(() => {
    // Viewport changes may recreate the slot topology; only a new initial item
    // is allowed to reset the user's live selection and motion.
    const initializationKey = `${initialIndex}:${initialOffsetX ?? 'default'}:${initialTopology ?? 'legacy'}`
    if (initializedStateRef.current === initializationKey) return

    const currentTopology: SpatialGalleryTopology = mobile
      ? 'mobile'
      : 'desktop'
    const restoredOffsetX =
      initialTopology === currentTopology ? initialOffsetX : null

    const initialSlotIndex = findClosestSlotForItem(
      layout.slots,
      initialIndex,
      restoredOffsetX ?? 0,
      layout.span,
      laneMotion.active,
      slotYPositions,
      laneMotion.x
    )
    if (initialSlotIndex === null) {
      throw new Error(`Projected surface has no slot for item ${initialIndex}`)
    }
    const initialSlot = layout.slots[initialSlotIndex]
    if (!initialSlot) {
      throw new Error(`Projected surface slot ${initialSlotIndex} is missing`)
    }

    const initialSlotX = initialSlot.x + (laneMotion.x[initialSlot.lane] ?? 0)
    const initialOffset =
      restoredOffsetX === null
        ? -initialSlotX
        : resolveVisibleRestoredOffset({
            frameWidth,
            offsetX: restoredOffsetX,
            slotX: initialSlotX,
            span: layout.span,
            viewportWidth: size.width / targetZoom
          })

    motionRef.current = {
      offset: {
        x: initialOffset,
        y: 0
      },
      velocity: { x: 0, y: 0 }
    }
    snapTargetRef.current = null
    selectionOverrideRef.current = initialIndex
    lastCenterIndexRef.current = initialIndex
    selectedItemIndexRef.current = initialIndex
    selectedLaneRef.current = initialSlot.lane
    warpSpeedRef.current = 0
    initializedStateRef.current = initializationKey
    if (initialOffsetX !== null) {
      introStateRef.current = 'finished'
      setIntroMotionDiagnostic(gl, 'skipped')
    }
  }, [
    frameWidth,
    gl,
    initialIndex,
    initialOffsetX,
    initialTopology,
    laneMotion,
    layout,
    mobile,
    size.width,
    slotYPositions,
    targetZoom
  ])

  useEffect(() => {
    if (reducedMotion) {
      cancelIntro('skipped')
      warpSpeedRef.current = 0
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (
          !entry?.isIntersecting ||
          entry.intersectionRatio < INTRO_VISIBILITY_THRESHOLD ||
          introStateRef.current !== 'waiting'
        ) {
          return
        }

        const introVelocity = calculateInertialLaunchVelocity(
          -columnGap * INTRO_TRAVEL_COLUMNS,
          INERTIA_DAMPING
        )
        introVelocityRef.current = introVelocity
        introStateRef.current = 'running'
        setIntroMotionDiagnostic(gl, 'running')
        motionRef.current = {
          offset: motionRef.current.offset,
          velocity: {
            x: motionRef.current.velocity.x + introVelocity,
            y: 0
          }
        }
        observer.disconnect()
      },
      { threshold: INTRO_VISIBILITY_THRESHOLD }
    )

    observer.observe(gl.domElement)
    return () => observer.disconnect()
  }, [cancelIntro, columnGap, gl, reducedMotion])

  useEffect(() => {
    if (!inertiaBurst || inertiaBurstHandledRef.current) return

    inertiaBurstHandledRef.current = true
    if (reducedMotion) {
      setInertiaBurstDiagnostic(gl, 'skipped')
      return
    }

    if (introStateRef.current === 'waiting') {
      introStateRef.current = 'finished'
      setIntroMotionDiagnostic(gl, 'skipped')
    }

    const travelColumns = mobile
      ? MOBILE_DISMISSAL_BURST_TRAVEL_COLUMNS
      : DESKTOP_DISMISSAL_BURST_TRAVEL_COLUMNS
    const burstVelocity = calculateInertialLaunchVelocity(
      -columnGap * travelColumns,
      INERTIA_DAMPING
    )
    inertiaBurstActiveRef.current = true
    inertiaBurstVelocityRef.current = burstVelocity
    motionRef.current = {
      offset: motionRef.current.offset,
      velocity: {
        x: motionRef.current.velocity.x + burstVelocity,
        y: 0
      }
    }
    setInertiaBurstDiagnostic(gl, 'launched')
  }, [columnGap, gl, inertiaBurst, mobile, reducedMotion])

  useEffect(() => {
    controllerRef.current = {
      cancelIntro,
      dragBy(deltaX, _deltaY, deltaMilliseconds) {
        cancelIntro()
        draggingRef.current = true
        pointerPositionRef.current = null
        hoveredSlotRef.current = null
        pressedSlotRef.current = null
        snapTargetRef.current = null
        selectionOverrideRef.current = null
        const seconds = Math.max(deltaMilliseconds / 1000, 1 / 120)
        const worldX = deltaX / zoomRef.current

        motionRef.current = {
          offset: {
            x: motionRef.current.offset.x + worldX,
            y: 0
          },
          velocity: reducedMotion
            ? { x: 0, y: 0 }
            : {
                x: MathUtils.clamp(
                  worldX / seconds,
                  -MAX_VELOCITY,
                  MAX_VELOCITY
                ),
                y: 0
              }
        }
      },
      endDrag() {
        draggingRef.current = false
      },
      getHistoryState() {
        return {
          offsetX: motionRef.current.offset.x,
          topology: mobile ? 'mobile' : 'desktop'
        }
      },
      clearHover() {
        pointerPositionRef.current = null
        hoveredSlotRef.current = null
      },
      getFrameRect(index) {
        const slotIndex = getDisplaySlotIndex(
          index,
          pressedSlotRef.current,
          hoveredSlotRef.current,
          layout.slots,
          slotXPositions,
          slotYPositions,
          laneMotion.active
        )
        if (slotIndex === null) return null
        const slot = layout.slots[slotIndex]
        if (!slot) return null
        const y = slotYPositions[slotIndex] ?? slot.y

        return getSlotScreenRect({
          camera,
          canvasRect: gl.domElement.getBoundingClientRect(),
          frameHeight,
          frameWidth,
          rowCoefficient: y / rowGap,
          scale: slotScales[slotIndex] ?? 1,
          viewportAspect: size.width / size.height,
          warpSpeed: warpSpeedRef.current,
          x: slotXPositions[slotIndex] ?? slot.x,
          y
        })
      },
      hoverAt(clientX, clientY) {
        if (draggingRef.current) return

        pointerPositionRef.current = { clientX, clientY }
        applyPointerHit(resolvePointerSlotAt(clientX, clientY))
      },
      pressAt(clientX, clientY) {
        const activeSlot = resolvePointerSlotAt(clientX, clientY)
        pressedSlotRef.current = activeSlot
        if (!activeSlot) {
          applyPointerHit(null)
          return
        }

        onPressItem(activeSlot.itemIndex)
      },
      recenter(index) {
        cancelIntro()
        const pressedSlot = pressedSlotRef.current
        const pressedSlotIndex =
          pressedSlot?.itemIndex === index &&
          layout.slots[pressedSlot.slotIndex]?.itemIndex === index &&
          laneMotion.active[
            layout.slots[pressedSlot.slotIndex]?.lane ?? maximumLanes
          ] === 1
            ? pressedSlot.slotIndex
            : null
        const slotIndex =
          pressedSlotIndex ??
          findClosestSlotForItem(
            layout.slots,
            index,
            motionRef.current.offset.x,
            layout.span,
            laneMotion.active,
            slotYPositions,
            laneMotion.x
          )
        if (slotIndex === null) return
        const slot = layout.slots[slotIndex]
        if (!slot) return

        pointerPositionRef.current = null
        hoveredSlotRef.current = null
        const currentX = wrapCentered(
          slot.x + (laneMotion.x[slot.lane] ?? 0) + motionRef.current.offset.x,
          layout.span
        )
        snapTargetRef.current =
          motionRef.current.offset.x + toroidalDelta(currentX, 0, layout.span)
        selectionOverrideRef.current = index
        selectedItemIndexRef.current = index
        selectedLaneRef.current = slot.lane
        motionRef.current = {
          offset: { x: motionRef.current.offset.x, y: 0 },
          velocity: { x: 0, y: 0 }
        }
        lastCenterIndexRef.current = index
      },
      wheelBy(deltaX, deltaY) {
        cancelIntro()
        draggingRef.current = false
        hoveredSlotRef.current = null
        pressedSlotRef.current = null
        snapTargetRef.current = null
        selectionOverrideRef.current = null
        const worldPerPixel = 1 / zoomRef.current
        const wheelDelta = projectWheelToHorizontal(deltaX, deltaY)
        const directTravel = MathUtils.clamp(
          -wheelDelta * worldPerPixel * WHEEL_DIRECT_GAIN,
          -2.4,
          2.4
        )
        const impulse = MathUtils.clamp(
          -wheelDelta * worldPerPixel * WHEEL_IMPULSE_GAIN,
          -MAX_VELOCITY,
          MAX_VELOCITY
        )

        if (reducedMotion) {
          motionRef.current = {
            offset: {
              x: motionRef.current.offset.x - wheelDelta * worldPerPixel,
              y: 0
            },
            velocity: { x: 0, y: 0 }
          }
          return
        }

        motionRef.current = {
          offset: {
            x: motionRef.current.offset.x + directTravel,
            y: 0
          },
          velocity: {
            x: combineImpulse(motionRef.current.velocity.x, impulse),
            y: 0
          }
        }
      }
    }
    return () => {
      controllerRef.current = null
    }
  }, [
    applyPointerHit,
    camera,
    cancelIntro,
    controllerRef,
    frameHeight,
    frameWidth,
    gl,
    laneMotion,
    layout,
    maximumLanes,
    mobile,
    onPressItem,
    reducedMotion,
    resolvePointerSlotAt,
    rowGap,
    size.height,
    size.width,
    slotScales,
    slotXPositions,
    slotYPositions
  ])

  useFrame(({ clock }, delta) => {
    // oxlint-disable react/immutability -- R3F cameras, transient lane buffers, and DOM diagnostics are intentionally updated inside the render loop.
    const frameDelta = Math.min(delta, MAX_FRAME_DELTA)
    const orthographicCamera = camera as OrthographicCamera
    const configurationKey = `${mobile}:${size.width}:${size.height}:${maximumLanes}`
    let sizingMotion = sizingMotionRef.current
    if (!sizingMotion) {
      sizingMotion = {
        configurationKey,
        itemSize,
        smooth: false,
        zoom: targetZoom
      }
      sizingMotionRef.current = sizingMotion
    }

    const itemSizeChanged = sizingMotion.itemSize !== itemSize
    const configurationChanged =
      sizingMotion.configurationKey !== configurationKey
    if (itemSizeChanged || configurationChanged) {
      sizingMotion.smooth =
        itemSizeChanged &&
        !configurationChanged &&
        animateItemSize &&
        !reducedMotion
      sizingMotion.configurationKey = configurationKey
      sizingMotion.itemSize = itemSize
      if (!sizingMotion.smooth) sizingMotion.zoom = targetZoom
      setGallerySizingMotionDiagnostic(
        gl,
        sizingMotion.smooth ? 'running' : 'settled'
      )
      if (sizingMotion.smooth) {
        cancelIntro()
        snapTargetRef.current = null
        motionRef.current = {
          offset: motionRef.current.offset,
          velocity: { x: 0, y: 0 }
        }
        warpSpeedRef.current = 0
      }
      if (itemSizeChanged) {
        lastTextureSweepRef.current = Number.NEGATIVE_INFINITY
      }
    } else if (sizingMotion.smooth && (reducedMotion || !animateItemSize)) {
      sizingMotion.smooth = false
      sizingMotion.zoom = targetZoom
      setGallerySizingMotionDiagnostic(gl, 'settled')
    }

    const smoothSizing = sizingMotion.smooth
    sizingMotion.zoom = smoothSizing
      ? damp(sizingMotion.zoom, targetZoom, SIZING_DAMPING, frameDelta)
      : targetZoom
    if (
      smoothSizing &&
      Math.abs(sizingMotion.zoom - targetZoom) <= SIZING_ZOOM_EPSILON
    ) {
      sizingMotion.zoom = targetZoom
    }

    const nextZoom = sizingMotion.zoom
    const fittingVisibleLanes = getGalleryLaneCountForZoom(
      mobile,
      size.height,
      nextZoom
    )
    const nextVisibleLanes =
      smoothSizing && mobile
        ? stepGalleryLaneCount(laneMotion.visibleLanes, fittingVisibleLanes)
        : fittingVisibleLanes
    const hiddenLaneCenter = getHiddenGalleryLaneCenter(
      size.height,
      nextZoom,
      frameWidth
    )
    if (nextVisibleLanes !== laneMotion.visibleLanes) {
      selectedLaneRef.current = Math.min(
        maximumLanes - 1,
        Math.max(0, selectedLaneRef.current)
      )
      laneMotion.windowStart = getGalleryLaneWindowStart(
        maximumLanes,
        nextVisibleLanes,
        selectedLaneRef.current,
        laneMotion.windowStart
      )
      laneMotion.visibleLanes = nextVisibleLanes
      for (let lane = 0; lane < maximumLanes; lane += 1) {
        const wasActive = laneMotion.active[lane] === 1
        const active = isGalleryLaneActive(
          lane,
          laneMotion.windowStart,
          laneMotion.visibleLanes
        )
        laneMotion.active[lane] = active ? 1 : 0
        if (active) {
          if (!wasActive && laneMotion.rendered[lane] !== 1) {
            laneMotion.y[lane] =
              (laneMotion.y[lane] ?? hiddenLaneCenter) < 0
                ? -hiddenLaneCenter
                : hiddenLaneCenter
          }
          laneMotion.rendered[lane] = 1
        }
      }
      lastTextureSweepRef.current = Number.NEGATIVE_INFINITY
      hoveredSlotRef.current = null
      pointerPositionRef.current = null
      pressedSlotRef.current = null
      selectionOverrideRef.current = selectedItemIndexRef.current
      lastCenterIndexRef.current = selectedItemIndexRef.current
      gl.domElement.dataset.galleryLanes = String(nextVisibleLanes)
    }

    let lanePositionsSettled = true
    for (let lane = 0; lane < maximumLanes; lane += 1) {
      const targetX = getGalleryLaneTargetXOffset(
        lane,
        laneMotion.windowStart,
        laneMotion.visibleLanes,
        stagger
      )
      const targetY = getGalleryLaneTargetY(
        lane,
        laneMotion.windowStart,
        laneMotion.visibleLanes,
        rowGap,
        hiddenLaneCenter
      )
      const nextX = smoothSizing
        ? damp(
            laneMotion.x[lane] ?? targetX,
            targetX,
            SIZING_DAMPING,
            frameDelta
          )
        : targetX
      const nextY = smoothSizing
        ? damp(
            laneMotion.y[lane] ?? targetY,
            targetY,
            SIZING_DAMPING,
            frameDelta
          )
        : targetY
      const xSettled = Math.abs(nextX - targetX) <= SIZING_POSITION_EPSILON
      const ySettled = Math.abs(nextY - targetY) <= SIZING_POSITION_EPSILON
      lanePositionsSettled &&= xSettled && ySettled
      laneMotion.x[lane] = xSettled ? targetX : nextX
      laneMotion.y[lane] = ySettled ? targetY : nextY
      laneMotion.rendered[lane] = shouldRenderGalleryLane(
        laneMotion.active[lane] === 1,
        ySettled,
        laneMotion.rendered[lane] === 1
      )
        ? 1
        : 0
    }

    if (
      smoothSizing &&
      sizingMotion.zoom === targetZoom &&
      lanePositionsSettled
    ) {
      sizingMotion.smooth = false
      setGallerySizingMotionDiagnostic(gl, 'settled')
    }

    if (Math.abs(orthographicCamera.zoom - nextZoom) > 0.01) {
      // oxlint-disable-next-line react/immutability -- R3F cameras are intentionally updated inside the render loop.
      orthographicCamera.zoom = nextZoom
      orthographicCamera.updateProjectionMatrix()
    }
    zoomRef.current = nextZoom
    viewportWidthRef.current = size.width / nextZoom

    const snapTarget = snapTargetRef.current
    if (snapTarget !== null) {
      const nextX = damp(
        motionRef.current.offset.x,
        snapTarget,
        reducedMotion ? 100 : 10,
        frameDelta
      )
      motionRef.current = {
        offset: { x: nextX, y: 0 },
        velocity: { x: 0, y: 0 }
      }

      if (Math.abs(nextX - snapTarget) < 0.001) {
        motionRef.current = {
          offset: { x: snapTarget, y: 0 },
          velocity: { x: 0, y: 0 }
        }
        snapTargetRef.current = null
      }
    } else if (!draggingRef.current) {
      const decayed = decayInertia(
        motionRef.current,
        frameDelta,
        reducedMotion ? 30 : INERTIA_DAMPING
      )
      motionRef.current = {
        offset: { x: decayed.offset.x, y: 0 },
        velocity: { x: decayed.velocity.x, y: 0 }
      }
    }

    if (
      introStateRef.current === 'running' &&
      Math.abs(motionRef.current.velocity.x) <=
        Math.abs(introVelocityRef.current) * INTRO_REST_FRACTION
    ) {
      introStateRef.current = 'finished'
      setIntroMotionDiagnostic(gl, 'settled')
      motionRef.current = {
        offset: motionRef.current.offset,
        velocity: { x: 0, y: 0 }
      }
    }

    if (
      inertiaBurstActiveRef.current &&
      Math.abs(motionRef.current.velocity.x) <=
        Math.abs(inertiaBurstVelocityRef.current) * INTRO_REST_FRACTION
    ) {
      inertiaBurstActiveRef.current = false
      setInertiaBurstDiagnostic(gl, 'settled')
      motionRef.current = {
        offset: motionRef.current.offset,
        velocity: { x: 0, y: 0 }
      }
    }

    if (smoothSizing) {
      motionRef.current = {
        offset: motionRef.current.offset,
        velocity: { x: 0, y: 0 }
      }
    }
    const targetWarpSpeed =
      reducedMotion || smoothSizing
        ? 0
        : calculateVelocityDeformation(
            viewportWidthRef.current / 2,
            viewportWidthRef.current,
            motionRef.current.velocity.x,
            WARP_REFERENCE_VELOCITY
          ).speed
    warpSpeedRef.current =
      reducedMotion || smoothSizing
        ? 0
        : damp(warpSpeedRef.current, targetWarpSpeed, WARP_DAMPING, frameDelta)

    for (const [slotIndex, slot] of layout.slots.entries()) {
      slotXPositions[slotIndex] = wrapCentered(
        slot.x + (laneMotion.x[slot.lane] ?? 0) + motionRef.current.offset.x,
        layout.span
      )
      slotYPositions[slotIndex] = laneMotion.y[slot.lane] ?? slot.y
    }

    const textureVisibilityLimit =
      viewportWidthRef.current / 2 + frameWidth * 1.75
    const textureTargetWindowStart = getGalleryLaneWindowStart(
      maximumLanes,
      targetLanes,
      selectedLaneRef.current,
      laneMotion.windowStart
    )
    syncGalleryTextureLaneMask(
      laneMotion.texturePriority,
      laneMotion.rendered,
      textureTargetWindowStart,
      targetLanes
    )
    const textureSweepDue =
      clock.elapsedTime - lastTextureSweepRef.current >=
      TEXTURE_SWEEP_INTERVAL_SECONDS
    if (textureSweepDue) {
      lastTextureSweepRef.current = clock.elapsedTime
      const { foregroundItemIndices, idleItemIndices } =
        prioritizeTextureItemIndices(
          layout.slots,
          slotXPositions,
          textureVisibilityLimit,
          motionRef.current.velocity.x,
          TEXTURE_LOOKAHEAD_SECONDS,
          laneMotion.texturePriority
        )
      const prioritizedItemIndices = [
        ...foregroundItemIndices,
        ...idleItemIndices
      ]
      idleTextureItemsRef.current = idleItemIndices
      prioritizedTextureItemsRef.current = prioritizedItemIndices
      for (const itemIndex of foregroundItemIndices) {
        pendingFullTextureRequestsRef.current.get(itemIndex)?.promote()
        if (nearbyTextureItemsRef.current.has(itemIndex)) continue

        failedFullTextureItemsRef.current.delete(itemIndex)
        failedPlaceholderTextureItemsRef.current.delete(itemIndex)
      }
      nearbyTextureItemsRef.current.clear()
      for (const itemIndex of foregroundItemIndices) {
        nearbyTextureItemsRef.current.add(itemIndex)
      }

      syncFullTextureBindings({
        bound: boundFullTextureItemsRef.current,
        full: fullTextureItemsRef.current,
        gl,
        imageMaterials,
        maximumBoundTextures: maximumBoundFullTextures,
        placeholderTexture,
        prioritizedItemIndices,
        resident: residentTexturesRef.current
      })

      const textureLoadOptions = {
        boundFull: boundFullTextureItemsRef.current,
        disposed: disposedRef,
        gl,
        imageMaterials,
        items,
        failedFull: failedFullTextureItemsRef.current,
        failedPlaceholder: failedPlaceholderTextureItemsRef.current,
        full: fullTextureItemsRef.current,
        nearbyItems: nearbyTextureItemsRef,
        pendingFull: pendingFullTextureRequestsRef.current,
        pendingPlaceholder: pendingPlaceholderTextureRequestsRef.current,
        placeholderTexture,
        prioritizedItems: prioritizedTextureItemsRef,
        resident: residentTexturesRef.current,
        textureGeneration: textureGenerationRef
      } satisfies TextureLoadOptions

      updateTextureLoads({
        ...textureLoadOptions,
        fullFetchPriority: 'high',
        fullLoadConcurrency: FULL_TEXTURE_LOAD_CONCURRENCY,
        loadItemIndices: foregroundItemIndices,
        placeholderLoadConcurrency: PLACEHOLDER_TEXTURE_LOAD_CONCURRENCY
      })

      if (
        textureIdleCancelRef.current === null &&
        hasFullTextureLoadCandidate(
          idleItemIndices,
          fullTextureItemsRef.current,
          pendingFullTextureRequestsRef.current,
          failedFullTextureItemsRef.current
        )
      ) {
        const requestGeneration = textureGenerationRef.current
        textureIdleCancelRef.current = scheduleIdleWork(() => {
          textureIdleCancelRef.current = null
          if (
            disposedRef.current ||
            textureGenerationRef.current !== requestGeneration ||
            draggingRef.current ||
            Math.abs(motionRef.current.velocity.x) >
              TEXTURE_IDLE_VELOCITY_THRESHOLD
          ) {
            return
          }

          updateTextureLoads({
            ...textureLoadOptions,
            fullFetchPriority: 'low',
            fullLoadConcurrency: IDLE_TEXTURE_LOAD_CONCURRENCY,
            loadItemIndices: idleTextureItemsRef.current,
            placeholderLoadConcurrency: 0
          })
        })
      }
    }

    if (
      !transitionReadyRef.current &&
      (fullTextureItemsRef.current.has(initialIndex) ||
        failedFullTextureItemsRef.current.has(initialIndex))
    ) {
      transitionReadyRef.current = true
      onTransitionReady()
    }
    const nearbyItemIndices = nearbyTextureItemsRef.current

    const pointerPosition = pointerPositionRef.current
    if (pointerPosition && !draggingRef.current) {
      applyPointerHit(
        resolvePointerSlotAt(pointerPosition.clientX, pointerPosition.clientY)
      )
    }

    const activeSlotIndex = resolveVisualSlotIndex(
      hoveredSlotRef.current ?? (mobile ? pressedSlotRef.current : null),
      layout.slots
    )

    for (const [slotIndex, slot] of layout.slots.entries()) {
      const x = slotXPositions[slotIndex] ?? slot.x
      const y = slotYPositions[slotIndex] ?? slot.y
      const renderScale = laneMotion.rendered[slot.lane] === 1 ? 1 : 0
      const active = slotIndex === activeSlotIndex
      const scaleTarget = getSlotScaleTarget(
        active,
        reducedMotion,
        SELECTED_SCALE
      )
      const currentScale = slotScales[slotIndex] ?? 1
      const scale = damp(
        currentScale,
        scaleTarget,
        reducedMotion
          ? 30
          : getDirectionalDamping(
              currentScale,
              scaleTarget,
              HOVER_ENTER_DAMPING,
              HOVER_SCALE_EXIT_DAMPING
            ),
        frameDelta
      )
      slotScales[slotIndex] = scale
      const currentActivity = slotActivities[slotIndex] ?? DIMMED_ACTIVITY
      const activityTarget = getSlotActivityTarget(slotIndex, activeSlotIndex)
      slotActivities[slotIndex] = damp(
        currentActivity,
        activityTarget,
        reducedMotion
          ? 30
          : getDirectionalDamping(
              currentActivity,
              activityTarget,
              HOVER_ENTER_DAMPING,
              HOVER_ACTIVITY_EXIT_DAMPING
            ),
        frameDelta
      )

      setInstanceTransform(
        backingMesh,
        slotIndex,
        transform,
        x,
        y,
        -0.025,
        (frameWidth + 0.15) * scale * renderScale,
        (frameHeight + 0.15) * scale * renderScale
      )
    }
    backingMesh.instanceMatrix.needsUpdate = true

    for (const [itemIndex, slots] of scenarioSlots.entries()) {
      const mesh = imageMeshes[itemIndex]
      if (!mesh) continue

      mesh.visible = nearbyItemIndices.has(itemIndex)
      if (!mesh.visible) continue

      for (const [instanceIndex, { slot, slotIndex }] of slots.entries()) {
        const scale = slotScales[slotIndex] ?? 1
        const renderScale = laneMotion.rendered[slot.lane] === 1 ? 1 : 0
        const activity = slotActivities[slotIndex] ?? DIMMED_ACTIVITY
        setInstanceTransform(
          mesh,
          instanceIndex,
          transform,
          slotXPositions[slotIndex] ?? slot.x,
          slotYPositions[slotIndex] ?? slot.y,
          0,
          frameWidth * scale * renderScale,
          frameHeight * scale * renderScale
        )
        activityColor.setRGB(activity, activity, activity)
        mesh.setColorAt(instanceIndex, activityColor)
      }
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }

    bracketMesh.visible = activeSlotIndex !== null
    if (activeSlotIndex !== null) {
      const activeSlot = layout.slots[activeSlotIndex]
      if (activeSlot) {
        const activeSlotY = slotYPositions[activeSlotIndex] ?? activeSlot.y
        updateSelectionBrackets({
          frameHeight,
          frameWidth,
          mesh: bracketMesh,
          scale: slotScales[activeSlotIndex] ?? 1,
          transform,
          x: slotXPositions[activeSlotIndex] ?? activeSlot.x,
          y: activeSlotY
        })
        bracketMaterial.uniforms.uRowOverride!.value = activeSlotY / rowGap
      }
    }

    updateWarpUniforms(
      warpMaterials,
      warpSpeedRef.current,
      size.width / size.height,
      rowGap
    )
    // oxlint-enable react/immutability

    if (
      hoveredSlotRef.current !== null ||
      selectionOverrideRef.current !== null
    ) {
      return
    }

    let nearestItemIndex = 0
    let nearestDistance = Number.POSITIVE_INFINITY
    for (const [slotIndex, slot] of layout.slots.entries()) {
      if (laneMotion.active[slot.lane] !== 1) continue

      const x = slotXPositions[slotIndex] ?? slot.x
      const y = slotYPositions[slotIndex] ?? slot.y
      const distance = x * x + y * y
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestItemIndex = slot.itemIndex
        selectedLaneRef.current = slot.lane
      }
    }

    if (nearestItemIndex !== lastCenterIndexRef.current) {
      lastCenterIndexRef.current = nearestItemIndex
      selectedItemIndexRef.current = nearestItemIndex
      onSelectItem(nearestItemIndex)
    }
  })

  return (
    <group>
      <primitive object={backingMesh} dispose={null} />
      {imageMeshes.map((mesh, itemIndex) => (
        <primitive key={items[itemIndex]!.id} object={mesh} dispose={null} />
      ))}
      <primitive object={bracketMesh} dispose={null} />
    </group>
  )
}

function createInstancedMesh(
  geometry: PlaneGeometry,
  material: ShaderMaterial,
  count: number
) {
  const mesh = new InstancedMesh(geometry, material, count)
  mesh.frustumCulled = false
  mesh.instanceMatrix.setUsage(DynamicDrawUsage)
  return mesh
}

function createImageInstancedMesh(
  geometry: PlaneGeometry,
  material: ShaderMaterial,
  count: number
) {
  const mesh = createInstancedMesh(geometry, material, count)
  const dimmed = new Color(DIMMED_ACTIVITY, DIMMED_ACTIVITY, DIMMED_ACTIVITY)

  for (let instanceIndex = 0; instanceIndex < count; instanceIndex += 1) {
    mesh.setColorAt(instanceIndex, dimmed)
  }
  if (mesh.instanceColor) mesh.instanceColor.setUsage(DynamicDrawUsage)
  mesh.visible = false

  return mesh
}

type TextureLoadOptions = Readonly<{
  boundFull: Set<number>
  disposed: MutableRefObject<boolean>
  failedFull: Set<number>
  failedPlaceholder: Set<number>
  full: Set<number>
  gl: WebGLRenderer
  imageMaterials: readonly ShaderMaterial[]
  items: readonly SpatialGalleryItem[]
  nearbyItems: MutableRefObject<ReadonlySet<number>>
  pendingFull: Map<number, PendingTextureRequest>
  pendingPlaceholder: Map<number, PendingTextureRequest>
  placeholderTexture: Texture
  prioritizedItems: MutableRefObject<readonly number[]>
  resident: Map<number, Texture>
  textureGeneration: MutableRefObject<number>
}>

type TextureLoadSweepOptions = TextureLoadOptions &
  Readonly<{
    fullFetchPriority: TextureFetchPriority
    fullLoadConcurrency: number
    loadItemIndices: readonly number[]
    placeholderLoadConcurrency: number
  }>

function updateTextureLoads({
  boundFull,
  disposed,
  failedFull,
  failedPlaceholder,
  fullFetchPriority,
  fullLoadConcurrency,
  full,
  gl,
  imageMaterials,
  items,
  loadItemIndices,
  nearbyItems,
  pendingFull,
  pendingPlaceholder,
  placeholderTexture,
  placeholderLoadConcurrency,
  prioritizedItems,
  resident,
  textureGeneration
}: TextureLoadSweepOptions) {
  const loadPlan = planTextureLoads({
    failedFull,
    failedPlaceholder,
    full,
    fullLoadCapacity: Math.max(0, fullLoadConcurrency - pendingFull.size),
    pendingFull,
    pendingPlaceholder,
    placeholderLoadCapacity: Math.max(
      0,
      placeholderLoadConcurrency - pendingPlaceholder.size
    ),
    prioritizedItemIndices: loadItemIndices,
    resident
  })

  const startTextureLoad = (itemIndex: number, stage: TextureLoadStage) => {
    const item = items[itemIndex]
    const material = imageMaterials[itemIndex]
    if (!item || !material) return

    const failed = stage === 'full' ? failedFull : failedPlaceholder
    const pending = stage === 'full' ? pendingFull : pendingPlaceholder
    const requestGeneration = textureGeneration.current
    const source = stage === 'full' ? item.image.src : item.image.blurDataURL

    const request = loadBrowserTexture(
      source,
      stage === 'full' ? fullFetchPriority : 'high',
      (texture) => {
        const current =
          !disposed.current && textureGeneration.current === requestGeneration
        pending.delete(itemIndex)
        if (!current) {
          texture.dispose()
          return
        }
        const committed = settleTextureLoad({
          activeItemIndices: nearbyItems.current,
          current,
          dispose: (loadedTexture) => loadedTexture.dispose(),
          fullItemIndices: full,
          itemIndex,
          onBind: (loadedTexture) => {
            configureTexture(loadedTexture, gl, stage)
            if (stage === 'placeholder') {
              // oxlint-disable-next-line react/immutability -- Shader uniforms are mutable GPU resources.
              material.uniforms.uTexture!.value = loadedTexture
            }
          },
          residentTextures: resident,
          stage,
          texture
        })
        if (!committed) return

        if (stage === 'full') {
          // Keep the decoded image resident even when its GPU upload is not in
          // the current binding window. Foreground rebinding is synchronous.
          // oxlint-disable-next-line react/immutability -- Shader uniforms are mutable GPU resources.
          material.uniforms.uTexture!.value = placeholderTexture
          syncFullTextureBindings({
            bound: boundFull,
            full,
            gl,
            imageMaterials,
            maximumBoundTextures: getTextureBindingLimit(
              gl.domElement.clientWidth
            ),
            placeholderTexture,
            prioritizedItemIndices: prioritizedItems.current,
            resident
          })
          return
        }

        syncTextureDiagnostics(
          gl,
          resident,
          full,
          boundFull,
          getTextureBindingLimit(gl.domElement.clientWidth)
        )
      },
      () => {
        if (
          disposed.current ||
          textureGeneration.current !== requestGeneration
        ) {
          return
        }
        pending.delete(itemIndex)
        failed.add(itemIndex)
      }
    )
    pending.set(itemIndex, request)
  }

  for (const itemIndex of loadPlan.placeholderItemIndices) {
    startTextureLoad(itemIndex, 'placeholder')
  }
  for (const itemIndex of loadPlan.fullItemIndices) {
    startTextureLoad(itemIndex, 'full')
  }
}

function loadBrowserTexture(
  source: string,
  fetchPriority: TextureFetchPriority,
  onLoad: (texture: Texture) => void,
  onError: () => void
): PendingTextureRequest {
  const texture = new Texture()
  let settled = false
  let image: HTMLImageElement

  const removeListeners = (target: HTMLImageElement) => {
    target.removeEventListener('load', handleLoad)
    target.removeEventListener('error', handleError)
  }
  const handleLoad = (event: Event) => {
    if (settled) return

    settled = true
    const loadedImage = event.currentTarget as HTMLImageElement
    removeListeners(loadedImage)
    // oxlint-disable react/immutability -- Three.js textures receive their browser image after the request settles.
    texture.image = loadedImage
    texture.needsUpdate = true
    // oxlint-enable react/immutability
    onLoad(texture)
  }
  const handleError = (event: Event) => {
    if (settled) return

    settled = true
    removeListeners(event.currentTarget as HTMLImageElement)
    texture.dispose()
    onError()
  }
  const start = (priority: TextureFetchPriority) => {
    image = createTextureImage(source, priority)
    image.addEventListener('load', handleLoad)
    image.addEventListener('error', handleError)
    image.src = source
  }

  start(fetchPriority)

  return {
    cancel() {
      if (settled) return

      settled = true
      removeListeners(image)
      image.src = ''
      texture.dispose()
    },
    promote() {
      if (settled || image.fetchPriority === 'high') return

      removeListeners(image)
      image.src = ''
      start('high')
    }
  }
}

function createTextureImage(
  source: string,
  fetchPriority: TextureFetchPriority
) {
  const image = new Image()
  image.decoding = 'async'
  image.fetchPriority = fetchPriority
  if (!source.startsWith('data:')) image.crossOrigin = 'anonymous'
  return image
}

function hasFullTextureLoadCandidate(
  itemIndices: readonly number[],
  full: ReadonlySet<number>,
  pending: ReadonlyMap<number, PendingTextureRequest>,
  failed: ReadonlySet<number>
) {
  return itemIndices.some(
    (itemIndex) =>
      !full.has(itemIndex) && !pending.has(itemIndex) && !failed.has(itemIndex)
  )
}

function scheduleIdleWork(callback: () => void) {
  if (typeof window.requestIdleCallback === 'function') {
    const handle = window.requestIdleCallback(callback, {
      timeout: TEXTURE_IDLE_TIMEOUT_MILLISECONDS
    })
    return () => window.cancelIdleCallback(handle)
  }

  const handle = window.setTimeout(callback, 16)
  return () => window.clearTimeout(handle)
}

function configureTexture(
  texture: Texture,
  gl: WebGLRenderer,
  stage: TextureLoadStage
) {
  // oxlint-disable react/immutability -- Three.js textures are mutable GPU resources configured after loading.
  texture.colorSpace = SRGBColorSpace
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  texture.generateMipmaps = false
  texture.anisotropy =
    stage === 'full' ? Math.min(8, gl.capabilities.getMaxAnisotropy()) : 1
  texture.needsUpdate = true
  // oxlint-enable react/immutability
}

type FullTextureBindingOptions = Readonly<{
  bound: Set<number>
  full: ReadonlySet<number>
  gl: WebGLRenderer
  imageMaterials: readonly ShaderMaterial[]
  maximumBoundTextures: number
  placeholderTexture: Texture
  prioritizedItemIndices: readonly number[]
  resident: ReadonlyMap<number, Texture>
}>

function syncFullTextureBindings({
  bound,
  full,
  gl,
  imageMaterials,
  maximumBoundTextures,
  placeholderTexture,
  prioritizedItemIndices,
  resident
}: FullTextureBindingOptions) {
  const plan = planTextureBindings({
    boundItemIndices: bound,
    fullItemIndices: full,
    maximumBoundTextures,
    prioritizedItemIndices,
    residentItemIndices: resident
  })

  for (const itemIndex of plan.evictItemIndices) {
    const material = imageMaterials[itemIndex]
    const texture = resident.get(itemIndex)
    if (material) {
      // oxlint-disable-next-line react/immutability -- Shader uniforms are mutable GPU resources.
      material.uniforms.uTexture!.value = placeholderTexture
    }
    texture?.dispose()
    bound.delete(itemIndex)
  }

  for (const itemIndex of plan.bindItemIndices) {
    const material = imageMaterials[itemIndex]
    const texture = resident.get(itemIndex)
    if (!material || !texture) continue

    // A disposed Three.js texture retains its loaded HTML image. Marking it
    // dirty recreates only the GPU upload, without a network request or blur.
    // oxlint-disable react/immutability -- Shader uniforms and textures are mutable GPU resources.
    texture.needsUpdate = true
    material.uniforms.uTexture!.value = texture
    // oxlint-enable react/immutability
    bound.add(itemIndex)
  }

  syncTextureDiagnostics(gl, resident, full, bound, maximumBoundTextures)
}

function syncTextureDiagnostics(
  gl: WebGLRenderer,
  resident: ReadonlyMap<number, Texture>,
  full: ReadonlySet<number>,
  bound: ReadonlySet<number>,
  maximumBoundTextures: number
) {
  gl.domElement.dataset.galleryBoundTextures = String(bound.size)
  gl.domElement.dataset.galleryBindingLimit = String(maximumBoundTextures)
  gl.domElement.dataset.galleryFullTextures = String(full.size)
  gl.domElement.dataset.galleryPlaceholderTextures = String(
    resident.size - full.size
  )
}

function createPlaceholderTexture() {
  const texture = new DataTexture(
    new Uint8Array([232, 222, 206, 255]),
    1,
    1,
    RGBAFormat,
    UnsignedByteType
  )
  texture.colorSpace = SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

function createImageMaterial(item: SpatialGalleryItem, texture: Texture) {
  return new ShaderMaterial({
    fragmentShader: imageFragmentShader,
    toneMapped: false,
    uniforms: {
      ...createWarpUniforms(false),
      uFocalPoint: {
        value: new Vector2(
          item.image.focalPoint?.x ?? 0.5,
          item.image.focalPoint?.y ?? 0.5
        )
      },
      uFrameAspect: { value: FRAME_ASPECT },
      uPaper: { value: PAPER },
      uTexture: { value: texture },
      uTextureSize: {
        value: new Vector2(item.image.width, item.image.height)
      }
    },
    vertexShader: warpVertexShader
  })
}

function createFlatMaterial(color: Color | string, useRowOverride: boolean) {
  return new ShaderMaterial({
    fragmentShader: flatFragmentShader,
    toneMapped: false,
    uniforms: {
      ...createWarpUniforms(useRowOverride),
      uColor: { value: new Color(color) }
    },
    vertexShader: warpVertexShader
  })
}

function createWarpUniforms(useRowOverride: boolean) {
  return {
    uRowGap: { value: 1 },
    uRowOverride: { value: 0 },
    uUseRowOverride: { value: useRowOverride ? 1 : 0 },
    uViewportAspect: { value: 1 },
    uWarpSpeed: { value: 0 }
  }
}

function updateWarpUniforms(
  materials: readonly ShaderMaterial[],
  speed: number,
  viewportAspect: number,
  rowGap: number
) {
  // oxlint-disable react/immutability -- Shader uniforms are intentionally mutated once per frame.
  for (const material of materials) {
    material.uniforms.uWarpSpeed!.value = speed
    material.uniforms.uViewportAspect!.value = viewportAspect
    material.uniforms.uRowGap!.value = rowGap
  }
  // oxlint-enable react/immutability
}

function setInstanceTransform(
  mesh: InstancedMesh,
  index: number,
  transform: Object3D,
  x: number,
  y: number,
  z: number,
  width: number,
  height: number
) {
  transform.position.set(x, y, z)
  transform.rotation.set(0, 0, 0)
  transform.scale.set(width, height, 1)
  transform.updateMatrix()
  mesh.setMatrixAt(index, transform.matrix)
}

function updateSelectionBrackets({
  frameHeight,
  frameWidth,
  mesh,
  scale,
  transform,
  x,
  y
}: {
  readonly frameHeight: number
  readonly frameWidth: number
  readonly mesh: InstancedMesh
  readonly scale: number
  readonly transform: Object3D
  readonly x: number
  readonly y: number
}) {
  const scaledFrameWidth = frameWidth * scale
  const scaledFrameHeight = frameHeight * scale
  const inset = scaledFrameWidth * BRACKET_INSET_RATIO
  const arm = scaledFrameWidth * BRACKET_ARM_RATIO
  const thickness = scaledFrameWidth * BRACKET_THICKNESS_RATIO
  const horizontalInset = scaledFrameWidth / 2 + inset
  const verticalInset = scaledFrameHeight / 2 + inset
  let instanceIndex = 0

  for (const xDirection of [-1, 1] as const) {
    for (const yDirection of [-1, 1] as const) {
      setInstanceTransform(
        mesh,
        instanceIndex,
        transform,
        x + xDirection * (horizontalInset - arm / 2),
        y + yDirection * verticalInset,
        0.06,
        arm,
        thickness
      )
      instanceIndex += 1
      setInstanceTransform(
        mesh,
        instanceIndex,
        transform,
        x + xDirection * horizontalInset,
        y + yDirection * (verticalInset - arm / 2),
        0.06,
        thickness,
        arm
      )
      instanceIndex += 1
    }
  }

  mesh.instanceMatrix.needsUpdate = true
}

function findClosestSlotForItem(
  slots: readonly ProjectedSurfaceSlot[],
  itemIndex: number,
  offset: number,
  span: number,
  activeLanes?: ArrayLike<number>,
  yPositions?: ArrayLike<number>,
  laneXOffsets?: ArrayLike<number>
) {
  let closestSlotIndex: number | null = null
  let closestDistance = Number.POSITIVE_INFINITY

  for (const [slotIndex, slot] of slots.entries()) {
    if (slot.itemIndex !== itemIndex) continue
    if (activeLanes && activeLanes[slot.lane] !== 1) continue

    const x = wrapCentered(
      slot.x + (laneXOffsets?.[slot.lane] ?? 0) + offset,
      span
    )
    const y = yPositions?.[slotIndex] ?? slot.y
    const distance = x * x + y * y
    if (distance < closestDistance) {
      closestDistance = distance
      closestSlotIndex = slotIndex
    }
  }

  return closestSlotIndex
}

function getDisplaySlotIndex(
  itemIndex: number,
  pressedSlot: ActiveSlot | null,
  hoveredSlot: ActiveSlot | null,
  slots: readonly ProjectedSurfaceSlot[],
  xPositions: Float32Array,
  yPositions: Float32Array,
  activeLanes: ArrayLike<number>
) {
  if (
    pressedSlot?.itemIndex === itemIndex &&
    slots[pressedSlot.slotIndex]?.itemIndex === itemIndex &&
    activeLanes[slots[pressedSlot.slotIndex]?.lane ?? activeLanes.length] === 1
  ) {
    return pressedSlot.slotIndex
  }
  if (
    hoveredSlot?.itemIndex === itemIndex &&
    slots[hoveredSlot.slotIndex]?.itemIndex === itemIndex &&
    activeLanes[slots[hoveredSlot.slotIndex]?.lane ?? activeLanes.length] === 1
  ) {
    return hoveredSlot.slotIndex
  }

  let closestSlotIndex: number | null = null
  let closestDistance = Number.POSITIVE_INFINITY
  for (const [slotIndex, slot] of slots.entries()) {
    if (slot.itemIndex !== itemIndex) continue
    if (activeLanes[slot.lane] !== 1) continue

    const x = xPositions[slotIndex] ?? slot.x
    const y = yPositions[slotIndex] ?? slot.y
    const distance = x * x + y * y
    if (distance < closestDistance) {
      closestDistance = distance
      closestSlotIndex = slotIndex
    }
  }

  return closestSlotIndex
}

function getSlotScreenRect({
  camera,
  canvasRect,
  frameHeight,
  frameWidth,
  rowCoefficient,
  scale,
  viewportAspect,
  warpSpeed,
  x,
  y
}: {
  readonly camera: Camera
  readonly canvasRect: DOMRect
  readonly frameHeight: number
  readonly frameWidth: number
  readonly rowCoefficient: number
  readonly scale: number
  readonly viewportAspect: number
  readonly warpSpeed: number
  readonly x: number
  readonly y: number
}) {
  const halfWidth = (frameWidth * scale) / 2
  const halfHeight = (frameHeight * scale) / 2
  const corners = [
    new Vector3(x - halfWidth, y - halfHeight, 0),
    new Vector3(x + halfWidth, y - halfHeight, 0),
    new Vector3(x + halfWidth, y + halfHeight, 0),
    new Vector3(x - halfWidth, y + halfHeight, 0)
  ].map((corner) => {
    const projected = corner.project(camera)
    projected.y += calculateGalleryWarpOffset(
      projected.x,
      rowCoefficient,
      warpSpeed,
      viewportAspect
    )
    return projected
  })
  const xValues = corners.map(
    ({ x: projectedX }) =>
      canvasRect.left + ((projectedX + 1) / 2) * canvasRect.width
  )
  const yValues = corners.map(
    ({ y: projectedY }) =>
      canvasRect.top + ((1 - projectedY) / 2) * canvasRect.height
  )
  const left = Math.min(...xValues)
  const right = Math.max(...xValues)
  const top = Math.min(...yValues)
  const bottom = Math.max(...yValues)

  return {
    height: bottom - top,
    left,
    top,
    width: right - left
  }
}

function createGalleryLaneMotionState({
  hiddenLaneCenter,
  key,
  maximumLanes,
  rowGap,
  stagger,
  visibleLanes
}: {
  readonly hiddenLaneCenter: number
  readonly key: string
  readonly maximumLanes: number
  readonly rowGap: number
  readonly stagger: number
  readonly visibleLanes: number
}): GalleryLaneMotionState {
  const active = new Uint8Array(maximumLanes)
  const rendered = new Uint8Array(maximumLanes)
  const texturePriority = new Uint8Array(maximumLanes)
  const x = new Float32Array(maximumLanes)
  const y = new Float32Array(maximumLanes)
  const windowStart = getGalleryLaneWindowStart(
    maximumLanes,
    visibleLanes,
    0,
    0
  )

  for (let lane = 0; lane < maximumLanes; lane += 1) {
    active[lane] = isGalleryLaneActive(lane, windowStart, visibleLanes) ? 1 : 0
    rendered[lane] = active[lane] ?? 0
    texturePriority[lane] = rendered[lane] ?? 0
    x[lane] = getGalleryLaneTargetXOffset(
      lane,
      windowStart,
      visibleLanes,
      stagger
    )
    y[lane] = getGalleryLaneTargetY(
      lane,
      windowStart,
      visibleLanes,
      rowGap,
      hiddenLaneCenter
    )
  }

  return {
    active,
    key,
    rendered,
    texturePriority,
    visibleLanes,
    windowStart,
    x,
    y
  }
}

function getHiddenGalleryLaneCenter(
  viewportHeightPixels: number,
  zoom: number,
  frameWidth: number
) {
  return (
    viewportHeightPixels / (zoom * 2) +
    getGalleryDecoratedFrameHalfHeight(frameWidth) +
    SIZING_POSITION_EPSILON
  )
}

function combineImpulse(current: number, impulse: number) {
  if (impulse === 0) return current
  if (current !== 0 && Math.sign(current) !== Math.sign(impulse)) return impulse
  return MathUtils.clamp(current + impulse, -MAX_VELOCITY, MAX_VELOCITY)
}

function setIntroMotionDiagnostic(
  gl: WebGLRenderer,
  state: IntroMotionDiagnostic
) {
  gl.domElement.dataset.galleryIntroMotion = state
}

function syncGallerySizingDiagnostics({
  capacityLanes,
  gl,
  itemSize,
  renderedLanes,
  targetLanes,
  targetZoom
}: {
  readonly capacityLanes: number
  readonly gl: WebGLRenderer
  readonly itemSize: number
  readonly renderedLanes: number
  readonly targetLanes: number
  readonly targetZoom: number
}) {
  gl.domElement.dataset.galleryCapacityLanes = String(capacityLanes)
  gl.domElement.dataset.galleryItemSize = String(itemSize)
  gl.domElement.dataset.galleryLanes = String(renderedLanes)
  gl.domElement.dataset.galleryTargetLanes = String(targetLanes)
  gl.domElement.dataset.galleryTargetZoom = targetZoom.toFixed(3)
  gl.domElement.dataset.gallerySizingMotion ??= 'settled'
}

function setGallerySizingMotionDiagnostic(
  gl: WebGLRenderer,
  state: GallerySizingMotionDiagnostic
) {
  if (gl.domElement.dataset.gallerySizingMotion === state) return

  gl.domElement.dataset.gallerySizingMotion = state
}

function clearGallerySizingDiagnostics(gl: WebGLRenderer) {
  delete gl.domElement.dataset.galleryCapacityLanes
  delete gl.domElement.dataset.galleryItemSize
  delete gl.domElement.dataset.galleryLanes
  delete gl.domElement.dataset.gallerySizingMotion
  delete gl.domElement.dataset.galleryTargetLanes
  delete gl.domElement.dataset.galleryTargetZoom
}

function setInertiaBurstDiagnostic(
  gl: WebGLRenderer,
  state: InertiaBurstDiagnostic
) {
  gl.domElement.dataset.galleryInertiaBurst = state
}

function clearMotionDiagnostics(gl: WebGLRenderer) {
  delete gl.domElement.dataset.galleryInertiaBurst
  delete gl.domElement.dataset.galleryIntroMotion
}

function CanvasUnavailable() {
  return <div className={styles.canvasUnavailable}>Canvas unavailable</div>
}
