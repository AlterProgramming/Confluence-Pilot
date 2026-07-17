import type { ComponentType } from 'react';
import type { RoomDefinition } from '../types/room';
import { GalleryForum } from './GalleryForum';
import {
  ColdChainLab,
  CommunicationsLab,
  FintechStudio,
  InfrastructureTestbed,
  LivingBuildingLab,
  MainStreetStudio,
  MobilityHangar,
  NeighborhoodStudio,
  StudentMakerspace,
  TrustworthyAILab,
  WorkforceAcademy,
} from './ProgramRooms';

export type RoomSceneProps = { room: RoomDefinition; active: boolean };

/** Reference-grounded scenes keyed by room id. Each room now has its own
 * composition entry rather than sharing the StandardRoom implementation. */
export const roomScenes: Record<string, ComponentType<RoomSceneProps>> = {
  '01': GalleryForum,
  '02': WorkforceAcademy,
  '03': StudentMakerspace,
  '04': LivingBuildingLab,
  '05': NeighborhoodStudio,
  '06': InfrastructureTestbed,
  '07': TrustworthyAILab,
  '08': MobilityHangar,
  '09': CommunicationsLab,
  '10': ColdChainLab,
  '11': FintechStudio,
  '12': MainStreetStudio,
};
