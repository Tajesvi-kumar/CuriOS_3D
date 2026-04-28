import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { useStore } from '../store'

const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const gapColors: Record<string, string> = {
  root: '#ef4444', confirmed: '#f97316',
  suspected: '#eab308', fixed: '#22c55e',
}

export default function KnowledgeGraph() {
  const svgRef = useRef<SVGSVGElement>(null)
  const { gaps } = useStore()

  useEffect(() => {
    fetch(`${API}/graph`)
      .then(r => r.json())
      .then(data => drawGraph(data.nodes, data.edges))
  }, [])

  useEffect(() => {
    if (!svgRef.current) return
    d3.select(svgRef.current).selectAll('circle')
      .attr('fill', (d: any) => gapColors[gaps[d.id]] || '#3b82f6')
  }, [gaps])

  const drawGraph = (nodes: any[], edges: any[]) => {
    if (!svgRef.current) return
    const svg = svgRef.current
    const W = svg.clientWidth || 280
    const H = svg.clientHeight || 500
    d3.select(svg).selectAll('*').remove()

    const container = d3.select(svg).append('g')
    d3.select(svg).call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.3, 3])
        .on('zoom', (e) => container.attr('transform', e.transform)) as any
    )

    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(edges).id((d: any) => d.id).distance(80))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collision', d3.forceCollide(25))

    const link = container.append('g').selectAll('line')
      .data(edges).enter().append('line')
      .attr('stroke', '#374151').attr('stroke-width', 1.5).attr('opacity', 0.6)

    const node = container.append('g').selectAll('g')
      .data(nodes).enter().append('g').style('cursor', 'pointer')
      .call(d3.drag<SVGGElement, any>()
        .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y })
        .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y })
        .on('end', (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null })
      )

    node.append('circle')
      .attr('r', 18)
      .attr('fill', (d: any) => gapColors[gaps[d.id]] || '#3b82f6')
      .attr('stroke', '#1f2937').attr('stroke-width', 2)

    node.append('text')
      .text((d: any) => `C${d.class}`)
      .attr('text-anchor', 'middle').attr('dy', 4)
      .attr('fill', 'white').attr('font-size', '8px').attr('font-weight', 'bold')
      .style('pointer-events', 'none')

    node.append('text')
      .text((d: any) => d.label.length > 9 ? d.label.slice(0, 8) + '…' : d.label)
      .attr('text-anchor', 'middle').attr('dy', 32)
      .attr('fill', '#9ca3af').attr('font-size', '9px')
      .style('pointer-events', 'none')

    sim.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x).attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x).attr('y2', (d: any) => d.target.y)
      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`)
    })
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#030712', borderLeft: '1px solid #1f2937', width: '280px', flexShrink: 0 }}>
      <div style={{ padding: '12px', borderBottom: '1px solid #1f2937' }}>
        <h3 style={{ color: 'white', fontWeight: '600', fontSize: '13px' }}>🧠 NCERT Concept Map</h3>
        <p style={{ color: '#6b7280', fontSize: '11px', marginTop: '2px' }}>Drag • Zoom • Watch gaps appear</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
          {[['Root', '#ef4444'], ['Confirmed', '#f97316'], ['Suspected', '#eab308'], ['Normal', '#3b82f6']].map(([l, c]) => (
            <span key={l} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#9ca3af' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: c, display: 'inline-block' }} />
              {l}
            </span>
          ))}
        </div>
      </div>
      <svg ref={svgRef} style={{ flex: 1, width: '100%' }} />
    </div>
  )
}