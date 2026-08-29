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
  TextureLoader,
  UnsignedByteType,
  Vector2,
  Vector3,
  type Camera,
  type Texture,
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
  calculateGalleryWarpOffset,
  DIMMED_ACTIVITY,
  getDirectionalDamping,
  getSlotActivityTarget,
  getSlotScaleTarget,
  resolveWarpedPointerSlot,
  resolveVisualSlotIndex,
  type ActiveSlot
} from './selection'
import styles from './spatial-gallery.module.css'
import {
  planTextureLoads,
  rankNearbyItemIndices,
  settleTextureLoad,
  type TextureLoadStage
} from './texture-residency'
import type { SpatialGalleryController, SpatialGalleryItem } from './types'

const PAPER = new Color('#e8dece')
const PAPER_LIGHT = '#f8f0df'
const ELECTRIC = '#ff4d1f'
const FRAME_ASPECT = 1.72
const DESKTOP_LANES = 5
const DESKTOP_FRAME_WIDTH = 1.4
const DESKTOP_ROW_GAP = 1.45
const BRACKET_ARM_RATIO = 0.14
const BRACKET_INSET_RATIO = 0.045
const BRACKET_THICKNESS_RATIO = 0.011
const SELECTED_SCALE = 1.045
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
const INTRO_REST_FRACTION = 0.025
const INTRO_VISIBILITY_THRESHOLD = 0.2
const TEXTURE_EVICTION_DELAY_SECONDS = 0.5
const FULL_TEXTURE_LOAD_CONCURRENCY = 12
const PLACEHOLDER_TEXTURE_LOAD_CONCURRENCY = 4
const TEXTURE_LOOKAHEAD_SECONDS = 0.2
const TEXTURE_MAX_RESIDENT = 64
const TEXTURE_SWEEP_INTERVAL_SECONDS = 0.12

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
  initialIndex: number
  initialOffsetX: number | null
  items: readonly SpatialGalleryItem[]
  onControllerReady(): void
  onPressItem(index: number): void
  onSelectItem(index: number): void
  reducedMotion: boolean
}>

type ScenarioSlot = Readonly<{
  slot: ProjectedSurfaceSlot
  slotIndex: number
}>

type IntroState = 'waiting' | 'running' | 'finished'

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
  controllerRef,
  initialIndex,
  initialOffsetX,
  items,
  onControllerReady,
  onPressItem,
  onSelectItem,
  reducedMotion
}: CanvasProps) {
  const draggingRef = useRef(false)
  const canvasBoundsRef = useRef<DOMRect | null>(null)
  const hoveredSlotRef = useRef<ActiveSlot | null>(null)
  const initializedStateRef = useRef<string | null>(null)
  const introStateRef = useRef<IntroState>('waiting')
  const introVelocityRef = useRef(0)
  const pointerPositionRef = useRef<{
    clientX: number
    clientY: number
  } | null>(null)
  const pressedSlotRef = useRef<ActiveSlot | null>(null)
  const lastCenterIndexRef = useRef(initialIndex)
  const selectionOverrideRef = useRef<number | null>(initialIndex)
  const snapTargetRef = useRef<number | null>(null)
  const warpSpeedRef = useRef(0)
  const zoomRef = useRef(100)
  const viewportWidthRef = useRef(10)
  const motionRef = useRef<FieldMotion>({
    offset: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 }
  })
  const disposedRef = useRef(false)
  const failedFullTextureItemsRef = useRef(new Set<number>())
  const failedPlaceholderTextureItemsRef = useRef(new Set<number>())
  const fullTextureItemsRef = useRef(new Set<number>())
  const nearbyTextureItemsRef = useRef(new Set<number>())
  const pendingFullTextureItemsRef = useRef(new Set<number>())
  const pendingPlaceholderTextureItemsRef = useRef(new Set<number>())
  const prioritizedTextureItemsRef = useRef<readonly number[]>([])
  const residentTexturesRef = useRef(new Map<number, Texture>())
  const textureGenerationRef = useRef(1)
  const textureLastSeenRef = useRef(new Map<number, number>())
  const lastTextureSweepRef = useRef(Number.NEGATIVE_INFINITY)
  const { camera, gl, size } = useThree()
  const mobile = size.width <= 680
  const lanes = mobile ? 3 : DESKTOP_LANES
  const frameWidth = mobile ? 2.72 : DESKTOP_FRAME_WIDTH
  const frameHeight = frameWidth / FRAME_ASPECT
  const columnGap = mobile ? 2.8 : 1.76
  const rowGap = mobile ? 2.35 : DESKTOP_ROW_GAP
  const stagger = mobile ? 0 : 0.28
  const targetZoom = getTargetZoom(mobile, size.width, size.height)
  const viewportWidth = size.width / targetZoom
  const layout = useMemo(
    () =>
      createProjectedSurfaceLayout(items.length, {
        lanes,
        columnGap,
        rowGap,
        viewportWidth,
        itemWidth: frameWidth,
        overscan: 0.75,
        stagger
      }),
    [columnGap, frameWidth, items.length, lanes, rowGap, stagger, viewportWidth]
  )
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
  const textureLoader = useMemo(() => new TextureLoader(), [])
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
    () => Float32Array.from(layout.slots, ({ x }) => x),
    [layout.slots]
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
  const cancelIntro = useCallback(() => {
    if (introStateRef.current === 'finished') return

    if (introStateRef.current === 'running') {
      motionRef.current = {
        offset: motionRef.current.offset,
        velocity: { x: 0, y: 0 }
      }
    }

    introStateRef.current = 'finished'
  }, [])

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
        viewportWidth,
        warpSpeed: warpSpeedRef.current,
        xPositions: slotXPositions
      })
    },
    [
      frameHeight,
      frameWidth,
      gl,
      layout.slots,
      rowGap,
      size.height,
      size.width,
      slotScales,
      slotXPositions,
      viewportWidth
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

      onSelectItem(activeSlot.itemIndex)
    },
    [onSelectItem]
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
    const disposed = disposedRef
    const failedFullTextureItems = failedFullTextureItemsRef.current
    const failedPlaceholderTextureItems =
      failedPlaceholderTextureItemsRef.current
    const fullTextureItems = fullTextureItemsRef.current
    const nearbyTextureItems = nearbyTextureItemsRef.current
    const pendingFullTextureItems = pendingFullTextureItemsRef.current
    const pendingPlaceholderTextureItems =
      pendingPlaceholderTextureItemsRef.current
    const prioritizedTextureItems = prioritizedTextureItemsRef
    const residentTextures = residentTexturesRef.current
    const textureLastSeen = textureLastSeenRef.current

    disposedRef.current = false
    syncTextureDiagnostics(gl, residentTextures, fullTextureItems)

    return () => {
      disposed.current = true
      textureGenerationRef.current += 1
      for (const texture of residentTextures.values()) {
        texture.dispose()
      }
      failedFullTextureItems.clear()
      failedPlaceholderTextureItems.clear()
      fullTextureItems.clear()
      nearbyTextureItems.clear()
      pendingFullTextureItems.clear()
      pendingPlaceholderTextureItems.clear()
      prioritizedTextureItems.current = []
      residentTextures.clear()
      textureLastSeen.clear()
      delete gl.domElement.dataset.galleryFullTextures
      delete gl.domElement.dataset.galleryPlaceholderTextures
    }
  }, [gl, imageMaterials])

  useEffect(
    () => () => {
      backingMesh.dispose()
      bracketMesh.dispose()
      for (const mesh of imageMeshes) mesh.dispose()
    },
    [backingMesh, bracketMesh, imageMeshes]
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
    // Viewport changes may recreate the slot topology; only a new initial item
    // is allowed to reset the user's live selection and motion.
    const initializationKey = `${initialIndex}:${initialOffsetX ?? 'default'}`
    if (initializedStateRef.current === initializationKey) return

    const initialSlotIndex = findClosestSlotForItem(
      layout.slots,
      initialIndex,
      0,
      layout.span
    )
    if (initialSlotIndex === null) {
      throw new Error(`Projected surface has no slot for item ${initialIndex}`)
    }
    const initialSlot = layout.slots[initialSlotIndex]
    if (!initialSlot) {
      throw new Error(`Projected surface slot ${initialSlotIndex} is missing`)
    }

    motionRef.current = {
      offset: { x: initialOffsetX ?? -initialSlot.x, y: 0 },
      velocity: { x: 0, y: 0 }
    }
    snapTargetRef.current = null
    selectionOverrideRef.current = initialIndex
    lastCenterIndexRef.current = initialIndex
    warpSpeedRef.current = 0
    initializedStateRef.current = initializationKey
    if (initialOffsetX !== null) introStateRef.current = 'finished'
  }, [initialIndex, initialOffsetX, layout])

  useEffect(() => {
    if (reducedMotion) {
      cancelIntro()
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
        motionRef.current = {
          offset: motionRef.current.offset,
          velocity: { x: introVelocity, y: 0 }
        }
        observer.disconnect()
      },
      { threshold: INTRO_VISIBILITY_THRESHOLD }
    )

    observer.observe(gl.domElement)
    return () => observer.disconnect()
  }, [cancelIntro, columnGap, gl, reducedMotion])

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
        return { offsetX: motionRef.current.offset.x }
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
          slotXPositions
        )
        if (slotIndex === null) return null
        const slot = layout.slots[slotIndex]
        if (!slot) return null

        return getSlotScreenRect({
          camera,
          canvasRect: gl.domElement.getBoundingClientRect(),
          frameHeight,
          frameWidth,
          rowCoefficient: slot.y / rowGap,
          scale: slotScales[slotIndex] ?? 1,
          viewportAspect: size.width / size.height,
          warpSpeed: warpSpeedRef.current,
          x: slotXPositions[slotIndex] ?? slot.x,
          y: slot.y
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
          layout.slots[pressedSlot.slotIndex]?.itemIndex === index
            ? pressedSlot.slotIndex
            : null
        const slotIndex =
          pressedSlotIndex ??
          findClosestSlotForItem(
            layout.slots,
            index,
            motionRef.current.offset.x,
            layout.span
          )
        if (slotIndex === null) return
        const slot = layout.slots[slotIndex]
        if (!slot) return

        pointerPositionRef.current = null
        hoveredSlotRef.current = null
        const currentX = wrapCentered(
          slot.x + motionRef.current.offset.x,
          layout.span
        )
        snapTargetRef.current =
          motionRef.current.offset.x + toroidalDelta(currentX, 0, layout.span)
        selectionOverrideRef.current = index
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
    onControllerReady()

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
    layout,
    onControllerReady,
    onPressItem,
    reducedMotion,
    resolvePointerSlotAt,
    rowGap,
    size.height,
    size.width,
    slotScales,
    slotXPositions
  ])

  useFrame(({ clock }, delta) => {
    const frameDelta = Math.min(delta, MAX_FRAME_DELTA)
    const orthographicCamera = camera as OrthographicCamera
    const nextZoom = getTargetZoom(mobile, size.width, size.height)

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
      motionRef.current = {
        offset: motionRef.current.offset,
        velocity: { x: 0, y: 0 }
      }
    }

    const targetWarpSpeed = reducedMotion
      ? 0
      : calculateVelocityDeformation(
          viewportWidthRef.current / 2,
          viewportWidthRef.current,
          motionRef.current.velocity.x,
          WARP_REFERENCE_VELOCITY
        ).speed
    warpSpeedRef.current = reducedMotion
      ? 0
      : damp(warpSpeedRef.current, targetWarpSpeed, WARP_DAMPING, frameDelta)

    // oxlint-disable react/immutability -- Instanced buffers and shader uniforms are GPU resources updated inside the render loop.
    for (const [slotIndex, slot] of layout.slots.entries()) {
      slotXPositions[slotIndex] = wrapCentered(
        slot.x + motionRef.current.offset.x,
        layout.span
      )
    }

    const textureVisibilityLimit =
      viewportWidthRef.current / 2 + frameWidth * 1.75
    const textureSweepDue =
      clock.elapsedTime - lastTextureSweepRef.current >=
      TEXTURE_SWEEP_INTERVAL_SECONDS
    if (textureSweepDue) {
      const prioritizedItemIndices = rankNearbyItemIndices(
        layout.slots,
        slotXPositions,
        textureVisibilityLimit,
        motionRef.current.velocity.x,
        TEXTURE_LOOKAHEAD_SECONDS
      )
      prioritizedTextureItemsRef.current = prioritizedItemIndices
      nearbyTextureItemsRef.current.clear()
      for (const itemIndex of prioritizedItemIndices) {
        nearbyTextureItemsRef.current.add(itemIndex)
      }
      updateTextureResidency({
        disposed: disposedRef,
        elapsedSeconds: clock.elapsedTime,
        gl,
        imageMaterials,
        items,
        failedFull: failedFullTextureItemsRef.current,
        failedPlaceholder: failedPlaceholderTextureItemsRef.current,
        full: fullTextureItemsRef.current,
        lastSeen: textureLastSeenRef.current,
        lastSweep: lastTextureSweepRef,
        nearbyItemIndices: nearbyTextureItemsRef.current,
        nearbyItems: nearbyTextureItemsRef,
        pendingFull: pendingFullTextureItemsRef.current,
        pendingPlaceholder: pendingPlaceholderTextureItemsRef.current,
        placeholderTexture,
        prioritizedItems: prioritizedTextureItemsRef,
        resident: residentTexturesRef.current,
        textureGeneration: textureGenerationRef,
        textureLoader
      })
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
        slot.y,
        -0.025,
        (frameWidth + 0.15) * scale,
        (frameHeight + 0.15) * scale
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
        const activity = slotActivities[slotIndex] ?? DIMMED_ACTIVITY
        setInstanceTransform(
          mesh,
          instanceIndex,
          transform,
          slotXPositions[slotIndex] ?? slot.x,
          slot.y,
          0,
          frameWidth * scale,
          frameHeight * scale
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
        updateSelectionBrackets({
          frameHeight,
          frameWidth,
          mesh: bracketMesh,
          scale: slotScales[activeSlotIndex] ?? 1,
          transform,
          x: slotXPositions[activeSlotIndex] ?? activeSlot.x,
          y: activeSlot.y
        })
        bracketMaterial.uniforms.uRowOverride!.value = activeSlot.y / rowGap
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
      const x = slotXPositions[slotIndex] ?? slot.x
      const distance = x * x + slot.y * slot.y
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestItemIndex = slot.itemIndex
      }
    }

    if (nearestItemIndex !== lastCenterIndexRef.current) {
      lastCenterIndexRef.current = nearestItemIndex
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

type TextureResidencyOptions = Readonly<{
  disposed: MutableRefObject<boolean>
  elapsedSeconds: number
  failedFull: Set<number>
  failedPlaceholder: Set<number>
  full: Set<number>
  gl: WebGLRenderer
  imageMaterials: readonly ShaderMaterial[]
  items: readonly SpatialGalleryItem[]
  lastSeen: Map<number, number>
  lastSweep: MutableRefObject<number>
  nearbyItemIndices: ReadonlySet<number>
  nearbyItems: MutableRefObject<ReadonlySet<number>>
  pendingFull: Set<number>
  pendingPlaceholder: Set<number>
  placeholderTexture: Texture
  prioritizedItems: MutableRefObject<readonly number[]>
  resident: Map<number, Texture>
  textureGeneration: MutableRefObject<number>
  textureLoader: TextureLoader
}>

function updateTextureResidency({
  disposed,
  elapsedSeconds,
  failedFull,
  failedPlaceholder,
  full,
  gl,
  imageMaterials,
  items,
  lastSeen,
  lastSweep,
  nearbyItemIndices,
  nearbyItems,
  pendingFull,
  pendingPlaceholder,
  placeholderTexture,
  prioritizedItems,
  resident,
  textureGeneration,
  textureLoader
}: TextureResidencyOptions) {
  if (elapsedSeconds - lastSweep.current < TEXTURE_SWEEP_INTERVAL_SECONDS) {
    return
  }
  lastSweep.current = elapsedSeconds

  for (const itemIndex of prioritizedItems.current) {
    lastSeen.set(itemIndex, elapsedSeconds)
  }

  clearFailuresOutsideRange(failedFull, nearbyItemIndices)
  clearFailuresOutsideRange(failedPlaceholder, nearbyItemIndices)

  let residencyChanged = false
  for (const [itemIndex] of resident) {
    if (nearbyItemIndices.has(itemIndex)) continue
    const secondsSinceVisible =
      elapsedSeconds - (lastSeen.get(itemIndex) ?? elapsedSeconds)
    if (secondsSinceVisible < TEXTURE_EVICTION_DELAY_SECONDS) continue

    residencyChanged =
      evictResidentTexture(
        itemIndex,
        full,
        imageMaterials,
        lastSeen,
        placeholderTexture,
        resident
      ) || residencyChanged
  }
  if (residencyChanged) syncTextureDiagnostics(gl, resident, full)

  const loadPlan = planTextureLoads({
    failedFull,
    failedPlaceholder,
    full,
    fullLoadCapacity: Math.max(
      0,
      FULL_TEXTURE_LOAD_CONCURRENCY - pendingFull.size
    ),
    maximumResidentTextures: TEXTURE_MAX_RESIDENT,
    pendingFull,
    pendingPlaceholder,
    placeholderLoadCapacity: Math.max(
      0,
      PLACEHOLDER_TEXTURE_LOAD_CONCURRENCY - pendingPlaceholder.size
    ),
    prioritizedItemIndices: prioritizedItems.current,
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

    pending.add(itemIndex)
    textureLoader.load(
      source,
      (texture) => {
        const current =
          !disposed.current && textureGeneration.current === requestGeneration
        if (!current) {
          texture.dispose()
          return
        }
        pending.delete(itemIndex)
        const committed = settleTextureLoad({
          activeItemIndices: nearbyItems.current,
          current,
          dispose: (loadedTexture) => loadedTexture.dispose(),
          fullItemIndices: full,
          itemIndex,
          lastSeen,
          maximumResidentTextures: TEXTURE_MAX_RESIDENT,
          onBind: (loadedTexture) => {
            configureTexture(loadedTexture, gl, stage)
            // oxlint-disable-next-line react/immutability -- Shader uniforms are mutable GPU resources.
            material.uniforms.uTexture!.value = loadedTexture
          },
          onEvict: (evictedItemIndex) => {
            evictResidentTexture(
              evictedItemIndex,
              full,
              imageMaterials,
              lastSeen,
              placeholderTexture,
              resident
            )
          },
          prioritizedItemIndices: prioritizedItems.current,
          residentTextures: resident,
          stage,
          texture
        })
        if (committed) syncTextureDiagnostics(gl, resident, full)
      },
      undefined,
      () => {
        if (
          disposed.current ||
          textureGeneration.current !== requestGeneration
        ) {
          return
        }
        pending.delete(itemIndex)
        if (nearbyItems.current.has(itemIndex)) failed.add(itemIndex)
      }
    )
  }

  for (const itemIndex of loadPlan.placeholderItemIndices) {
    startTextureLoad(itemIndex, 'placeholder')
  }
  for (const itemIndex of loadPlan.fullItemIndices) {
    startTextureLoad(itemIndex, 'full')
  }
}

function evictResidentTexture(
  itemIndex: number,
  full: Set<number>,
  imageMaterials: readonly ShaderMaterial[],
  lastSeen: Map<number, number>,
  placeholderTexture: Texture,
  resident: Map<number, Texture>
) {
  const texture = resident.get(itemIndex)
  if (!texture) return false

  const material = imageMaterials[itemIndex]
  if (material) {
    // oxlint-disable-next-line react/immutability -- Shader uniforms are mutable GPU resources.
    material.uniforms.uTexture!.value = placeholderTexture
  }
  texture.dispose()
  full.delete(itemIndex)
  resident.delete(itemIndex)
  lastSeen.delete(itemIndex)
  return true
}

function clearFailuresOutsideRange(
  failed: Set<number>,
  nearbyItemIndices: ReadonlySet<number>
) {
  for (const itemIndex of failed) {
    if (!nearbyItemIndices.has(itemIndex)) failed.delete(itemIndex)
  }
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

function syncTextureDiagnostics(
  gl: WebGLRenderer,
  resident: ReadonlyMap<number, Texture>,
  full: ReadonlySet<number>
) {
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
  span: number
) {
  let closestSlotIndex: number | null = null
  let closestDistance = Number.POSITIVE_INFINITY

  for (const [slotIndex, slot] of slots.entries()) {
    if (slot.itemIndex !== itemIndex) continue
    const distance = Math.abs(wrapCentered(slot.x + offset, span))
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
  xPositions: Float32Array
) {
  if (
    pressedSlot?.itemIndex === itemIndex &&
    slots[pressedSlot.slotIndex]?.itemIndex === itemIndex
  ) {
    return pressedSlot.slotIndex
  }
  if (
    hoveredSlot?.itemIndex === itemIndex &&
    slots[hoveredSlot.slotIndex]?.itemIndex === itemIndex
  ) {
    return hoveredSlot.slotIndex
  }

  let closestSlotIndex: number | null = null
  let closestDistance = Number.POSITIVE_INFINITY
  for (const [slotIndex, slot] of slots.entries()) {
    if (slot.itemIndex !== itemIndex) continue
    const x = xPositions[slotIndex] ?? slot.x
    const distance = x * x + slot.y * slot.y
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

function getTargetZoom(mobile: boolean, width: number, height: number) {
  if (mobile) return Math.max(76, width / 5.2, height / 10.4)

  const densityZoom = Math.max(90, width / 20.5, height / 7.15)
  const outerLaneCenter = ((DESKTOP_LANES - 1) / 2) * DESKTOP_ROW_GAP
  const selectedFrameHalfHeight =
    ((DESKTOP_FRAME_WIDTH / FRAME_ASPECT) * SELECTED_SCALE) / 2
  const requiredHalfHeight =
    outerLaneCenter +
    selectedFrameHalfHeight +
    DESKTOP_FRAME_WIDTH * SELECTED_SCALE * BRACKET_INSET_RATIO +
    (DESKTOP_FRAME_WIDTH * SELECTED_SCALE * BRACKET_THICKNESS_RATIO) / 2
  const verticalFitZoom = height / (requiredHalfHeight * 2)

  return Math.min(densityZoom, verticalFitZoom)
}

function combineImpulse(current: number, impulse: number) {
  if (impulse === 0) return current
  if (current !== 0 && Math.sign(current) !== Math.sign(impulse)) return impulse
  return MathUtils.clamp(current + impulse, -MAX_VELOCITY, MAX_VELOCITY)
}

function CanvasUnavailable() {
  return <div className={styles.canvasUnavailable}>Canvas unavailable</div>
}
