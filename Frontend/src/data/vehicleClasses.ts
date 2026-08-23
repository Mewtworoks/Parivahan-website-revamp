import type { VehicleClass } from '../types';

// MoRTH schedule, per class of vehicle.
export const LL_GRANT = 150;
export const LL_TEST = 50;

// Real schedule, read off an actual e-receipt: Rs.150 grant PER CLASS + Rs.50 LL test fee ONCE.
// Two classes therefore cost 300 + 50 = 350, not 400.
export const CLASSES: VehicleClass[] = [
  { id: 'MCWOG', code: 'MCWOG', name: 'Motorcycle without gear', note: 'Scooter or moped up to 50cc. Allowed from age 16.', min: 16, fee: 150 },
  { id: 'MCWG', code: 'MCWG', name: 'Motorcycle with gear', note: 'Any geared motorcycle. Allowed from 18.', min: 18, fee: 150 },
  { id: 'LMV-NT', code: 'LMV-NT', name: 'Light motor vehicle, non-transport', note: 'Private car or jeep. Allowed from 18.', min: 18, fee: 150 },
  { id: 'E-RICK', code: 'E-RICKSHAW', name: 'E-rickshaw', note: 'Battery rickshaw, non-transport endorsement.', min: 18, fee: 150 },
  { id: 'LMV-TR', code: 'LMV-TR', name: 'Light motor vehicle, transport', note: 'Taxi or goods carrier. Needs Form 1A medical certificate and age 20.', min: 20, fee: 150, medical: true },
];
