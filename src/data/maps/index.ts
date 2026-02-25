import goblinWastes from '@/data/nodes.json';
import frozenPeaks from '@/data/maps/frozen_peaks.json';
import infernalKeep from '@/data/maps/infernal_keep.json';

export interface MapDef {
  id: string;
  name: string;
  skyColor: string;
  nodes: any[];
}

const maps: MapDef[] = [
  { id: 'goblin_wastes', name: (goblinWastes as any).name, skyColor: '0x0e1520', nodes: (goblinWastes as any).nodes },
  { id: 'frozen_peaks', name: (frozenPeaks as any).name, skyColor: (frozenPeaks as any).skyColor, nodes: (frozenPeaks as any).nodes },
  { id: 'infernal_keep', name: (infernalKeep as any).name, skyColor: (infernalKeep as any).skyColor, nodes: (infernalKeep as any).nodes },
];

export function getAllMaps(): MapDef[] {
  return maps;
}

export function getMapById(id: string): MapDef | undefined {
  return maps.find(m => m.id === id);
}
