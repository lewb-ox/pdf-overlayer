import type { legendLayout } from './legend';

export function NumberBadge({ x, y, radius, number, color }: { x: number; y: number; radius: number; number: number; color: string }) {
  const size = radius * (String(number).length === 1 ? 1.2 : String(number).length === 2 ? 1.05 : String(number).length === 3 ? 0.82 : 0.65);
  return <g>
    <circle cx={x} cy={y} r={radius} fill="white" stroke={color} strokeWidth={radius * 0.22}/>
    <text x={x} y={y + size * 0.34} fontFamily="DM Sans, sans-serif" fontSize={size} fontWeight={600} fill="#222222" textAnchor="middle">{number}</text>
  </g>;
}

export function LegendGraphic({ layout }: { layout: ReturnType<typeof legendLayout> }) {
  return <>
    <rect width={layout.width} height={layout.height} fill="white"/>
    <g transform={`scale(${layout.scale})`} fontFamily="DM Sans, sans-serif">
      {layout.items.map((item, i) => item.type === 'text'
        ? <text key={i} x={item.x} y={item.y} fontSize={item.size} fontWeight={item.weight} fill={item.color}>{item.text}</text>
        : item.type === 'number' ? <NumberBadge key={i} {...item}/>
          : <rect key={i} x={item.x} y={item.y} width={item.width} height={item.height} fill={item.category.color} fillOpacity={item.category.opacity} stroke={item.category.color} strokeWidth={1.4} rx={1}/>) }
    </g>
  </>;
}
