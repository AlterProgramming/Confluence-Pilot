/**
 * Scene composition: which generated prop GLBs populate each room, and where.
 * Props live in /assets/props/<asset>.glb. Placements are in room-local space
 * (centerpiece at origin, floor at y ≈ -1.5). `size` is the normalized target
 * height in metres; `floor` places the prop's base on the floor.
 *
 * `default` is used by every room unless a room id overrides it. `lamp: true`
 * adds a warm point light at the prop so the space always has real light.
 */
export type PropPlacement = {
  asset: string;
  position: [number, number, number];
  rotationY?: number;
  size?: number;
  lamp?: boolean;
};

const FLOOR = -1.5;

const base: PropPlacement[] = [
  { asset: 'floor-lamp', position: [-5.0, FLOOR, -2.9], size: 1.95, lamp: true },
  { asset: 'floor-lamp', position: [5.0, FLOOR, -2.9], size: 1.95, lamp: true },
  { asset: 'potted-plant', position: [-5.3, FLOOR, 2.0], size: 1.7, rotationY: 0.4 },
  { asset: 'potted-plant', position: [5.3, FLOOR, 2.0], size: 1.7, rotationY: -0.4 },
  { asset: 'shelving-unit', position: [-5.1, FLOOR, -0.6], rotationY: 1.5, size: 2.0 },
  { asset: 'workstation-desk', position: [4.4, FLOOR, 0.9], rotationY: -0.7, size: 1.7 },
  { asset: 'office-chair', position: [3.7, FLOOR, 1.7], rotationY: 2.4, size: 1.05 },
  { asset: 'round-meeting-table', position: [-3.9, FLOOR, 1.9], size: 1.7 },
];

export const roomProps: Record<string, PropPlacement[]> = {
  default: base,
  // Public / gallery rooms: lounge feel.
  '01': [
    ...base.filter((p) => p.asset !== 'workstation-desk' && p.asset !== 'office-chair'),
    { asset: 'two-seat-sofa', position: [4.2, FLOOR, 1.4], rotationY: -1.1, size: 2.0 },
    { asset: 'presentation-podium', position: [-2.6, FLOOR, 2.4], rotationY: 0.2, size: 1.2 },
    { asset: 'display-kiosk', position: [2.7, FLOOR, 2.5], rotationY: -0.3, size: 1.6 },
  ],
  // Academy: rows of workstations already procedural — add lamps, plants, board.
  '02': [
    ...base,
    { asset: 'presentation-podium', position: [-2.4, FLOOR, 2.6], rotationY: 0.25, size: 1.25 },
  ],
  // Maker studio: workbench feel.
  '03': [
    ...base,
    { asset: 'display-kiosk', position: [2.6, FLOOR, 2.6], rotationY: -0.3, size: 1.55 },
  ],
};
