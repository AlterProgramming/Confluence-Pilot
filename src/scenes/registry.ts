import type { ComponentType } from 'react';
import type { RoomDefinition } from '../types/room';
import { GalleryForum } from './GalleryForum';
import { ControlRoom } from './ControlRoom';
import {
  ColdChainLab,
  CommunicationsLab,
  FintechStudio,
  InfrastructureTestbed,
  MainStreetStudio,
  MobilityHangar,
  NeighborhoodStudio,
  StudentMakerspace,
  TrustworthyAILab,
  WorkforceAcademy,
} from './ProgramRooms';

export type RoomSceneProps = { room: RoomDefinition; active: boolean };

/** Reference-grounded scenes keyed by room id. Each room now has its own
 * composition entry rather than sharing the StandardRoom implementation.
 * Room 04 keeps the hand-built ControlRoom (matched to its concept board)
 * rather than the templated ProgramRooms entry the rest of the lane uses. */
export const roomScenes: Record<string, ComponentType<RoomSceneProps>> = {
  '01': GalleryForum,
  '02': WorkforceAcademy,
  '03': StudentMakerspace,
  '04': ControlRoom,
  '05': NeighborhoodStudio,
  '06': InfrastructureTestbed,
  '07': TrustworthyAILab,
  '08': MobilityHangar,
  '09': CommunicationsLab,
  '10': ColdChainLab,
  '11': FintechStudio,
  '12': MainStreetStudio,
};
