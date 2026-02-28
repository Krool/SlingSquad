import goblinWastes from '@/data/nodes.json';
import frozenPeaks from '@/data/maps/frozen_peaks.json';
import infernalKeep from '@/data/maps/infernal_keep.json';
import type { NodeDef } from '@/systems/RunState';

export interface MapDef {
  id: string;
  name: string;
  skyColor: string;
  nodes: NodeDef[];
}

const maps: MapDef[] = [
  { id: 'goblin_wastes', name: goblinWastes.name, skyColor: '0x0e1520', nodes: goblinWastes.nodes as NodeDef[] },
  { id: 'frozen_peaks', name: frozenPeaks.name, skyColor: frozenPeaks.skyColor, nodes: frozenPeaks.nodes as NodeDef[] },
  { id: 'infernal_keep', name: infernalKeep.name, skyColor: infernalKeep.skyColor, nodes: infernalKeep.nodes as NodeDef[] },
];

export function getAllMaps(): MapDef[] {
  return maps;
}

export function getMapById(id: string): MapDef | undefined {
  return maps.find(m => m.id === id);
}

/** Build a 3-floor sequence starting with the given map, then the other maps. */
export function getFloorSequence(startMapId: string): string[] {
  const others = maps.filter(m => m.id !== startMapId).map(m => m.id);
  // Shuffle others for variety
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }
  return [startMapId, ...others];
}
