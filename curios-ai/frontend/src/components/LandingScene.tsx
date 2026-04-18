import { useRef, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Float, Stars } from '@react-three/drei'
import * as THREE from 'three'

function CameraRig() {
  const { camera, pointer } = useThree()
  useFrame(() => {
    camera.position.lerp(new THREE.Vector3(pointer.x * 2.5, pointer.y * 2.5, 15), 0.04)
    camera.lookAt(0, 0, 0)
  })
  return null
}

function FloatingShape({ position, type, scale, speed }: any) {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.x += 0.001 * speed
      meshRef.current.rotation.y += 0.002 * speed
    }
  })

  const geometry = useMemo(() => {
    if (type === 'box') return new THREE.BoxGeometry(1, 1, 1)
    if (type === 'torus') return new THREE.TorusGeometry(0.8, 0.2, 16, 32)
    if (type === 'sphere') return new THREE.SphereGeometry(1, 16, 16)
    return new THREE.IcosahedronGeometry(1, 0)
  }, [type])

  return (
    <Float speed={1} rotationIntensity={0.2} floatIntensity={0.6} position={position}>
      <mesh ref={meshRef} scale={scale} geometry={geometry}>
        <meshBasicMaterial color="#38bdf8" wireframe transparent opacity={0.18} />
      </mesh>
      <mesh scale={scale * 0.95} geometry={geometry}>
        <meshBasicMaterial color="#0ea5e9" transparent opacity={0.04} />
      </mesh>
    </Float>
  )
}

// Glowing particle field
function ParticleField() {
  const pointsRef = useRef<THREE.Points>(null)

  const { positions, colors } = useMemo(() => {
    const count = 800
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 60
      pos[i * 3 + 1] = (Math.random() - 0.5) * 40
      pos[i * 3 + 2] = (Math.random() - 0.5) * 30 - 5
      // Cyan to blue gradient
      const t = Math.random()
      col[i * 3] = 0.1 + t * 0.2
      col[i * 3 + 1] = 0.5 + t * 0.4
      col[i * 3 + 2] = 0.8 + t * 0.2
    }
    return { positions: pos, colors: col }
  }, [])

  useFrame(({ clock }) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y = clock.getElapsedTime() * 0.015
      pointsRef.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.01) * 0.05
    }
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.08} vertexColors transparent opacity={0.7} sizeAttenuation />
    </points>
  )
}

// Animated grid lines on the floor
function BackgroundGrid() {
  return <gridHelper args={[100, 80, '#0f2a3f', '#0a1929']} position={[0, -12, 0]} rotation={[0, 0, 0]} />
}

// Glowing ring that pulses
function GlowRing() {
  const meshRef = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (meshRef.current) {
      const s = 1 + Math.sin(clock.getElapsedTime() * 0.8) * 0.05
      meshRef.current.scale.set(s, s, s)
      meshRef.current.rotation.z += 0.002
    }
  })
  return (
    <mesh ref={meshRef} position={[0, 0, -8]}>
      <torusGeometry args={[6, 0.03, 8, 120]} />
      <meshBasicMaterial color="#38bdf8" transparent opacity={0.15} />
    </mesh>
  )
}

export default function LandingScene() {
  const shapes = useMemo(() => {
    const types = ['box', 'torus', 'sphere', 'icosahedron']
    return Array.from({ length: 30 }).map((_, i) => ({
      id: i,
      type: types[Math.floor(Math.random() * types.length)],
      position: [(Math.random() - 0.5) * 40, (Math.random() - 0.5) * 25, (Math.random() - 0.5) * 20 - 5],
      scale: Math.random() * 1.8 + 0.4,
      speed: Math.random() * 2 + 0.5,
    }))
  }, [])

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: -1 }}>
      <Canvas camera={{ position: [0, 0, 15], fov: 45 }}>
        <color attach="background" args={['#030712']} />
        <fog attach="fog" args={['#030712', 20, 60]} />
        <Stars radius={80} depth={50} count={3000} factor={3} saturation={0.5} fade speed={0.5} />
        <ParticleField />
        <BackgroundGrid />
        <GlowRing />
        {shapes.map((shape) => <FloatingShape key={shape.id} {...shape} />)}
        <CameraRig />
      </Canvas>
    </div>
  )
}
