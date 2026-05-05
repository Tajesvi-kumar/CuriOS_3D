import { Canvas, useFrame } from '@react-three/fiber'
import { Stars, OrbitControls, Float } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../store'
import { useMemo, useRef } from 'react'

function ConceptNode({ position, color, size }: any) {
  const meshRef = useRef<THREE.Mesh>(null)
  
  return (
    <Float speed={2} rotationIntensity={1} floatIntensity={1} position={position}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[size, 32, 32]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} toneMapped={false} />
      </mesh>
      {/* Glow */}
      <mesh>
        <sphereGeometry args={[size * 1.5, 32, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.2} blending={THREE.AdditiveBlending} />
      </mesh>
    </Float>
  )
}

export default function Scene() {
  const { gaps } = useStore()
  
  const nodes = useMemo(() => {
    const entries = Object.entries(gaps)
    if (entries.length === 0) {
      // Default nodes if no gaps yet
      return Array.from({ length: 15 }).map((_, i) => ({
        id: `node-${i}`,
        position: [(Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30],
        color: '#38bdf8',
        size: Math.random() * 1.5 + 0.5
      }))
    }

    return entries.map(([id, status]) => {
      const color = status === 'root' ? '#ef4444' : status === 'confirmed' ? '#f97316' : status === 'suspected' ? '#eab308' : '#22c55e'
      return { 
        id, 
        position: [(Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30], 
        color, 
        size: status === 'root' ? 2 : 1 
      }
    })
  }, [gaps])

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}>
      <Canvas camera={{ position: [0, 0, 35] }}>
        <color attach="background" args={['#030712']} />
        <ambientLight intensity={0.5} />
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        
        {/* Render a cool connected network or just floating orbs */}
        {nodes.map(n => <ConceptNode key={n.id} {...n} />)}
        
        <OrbitControls autoRotate autoRotateSpeed={0.5} />
      </Canvas>
    </div>
  )
}
