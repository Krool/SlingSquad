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
