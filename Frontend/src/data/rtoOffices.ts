import type { RtoOffice } from '../types';

export const RTO_BY_STATE: Record<string, RtoOffice[]> = {
  Bihar: [
    { id: 'br33', name: 'DTO, Samastipur (BR-33)', area: 'Samastipur, Bihar', km: 4.1, wait: 'Avg wait once you arrive: 30 min', load: 'light' },
    { id: 'br06', name: 'DTO, Darbhanga (BR-06)', area: 'Darbhanga, Bihar', km: 38.5, wait: 'Avg wait once you arrive: 50 min', load: 'busy' },
    { id: 'br01', name: 'DTO, Patna (BR-01)', area: 'Patna, Bihar', km: 92.0, wait: 'Avg wait once you arrive: 65 min', load: 'busy' },
  ],
};

export const RTOS: RtoOffice[] = [
  { id: 'mh01', name: 'Andheri RTO (MH-01)', area: 'Andheri West, Mumbai', km: 3.2, wait: 'Avg wait once you arrive: 25 min', load: 'light' },
  { id: 'mh02', name: 'Wadala RTO (MH-02)', area: 'Wadala East, Mumbai', km: 8.6, wait: 'Avg wait once you arrive: 55 min', load: 'busy' },
  { id: 'mh03', name: 'Borivali RTO (MH-47)', area: 'Borivali East, Mumbai', km: 14.1, wait: 'Avg wait once you arrive: 20 min', load: 'light' },
];

/** Returns the RTO list for a state, falling back to the Maharashtra list (the only other one modelled). */
export function rtosFor(state: string): RtoOffice[] {
  return RTO_BY_STATE[state] || RTOS;
}

export const DAYS = [
  { d: 'Mon 24 Aug', left: 0 }, { d: 'Tue 25 Aug', left: 6 }, { d: 'Wed 26 Aug', left: 14 },
  { d: 'Thu 27 Aug', left: 22 }, { d: 'Fri 28 Aug', left: 19 }, { d: 'Sat 29 Aug', left: 4 },
];

export const TIMES = [
  { t: '09:30 am', left: 2 }, { t: '10:15 am', left: 0 }, { t: '11:00 am', left: 7 },
  { t: '11:45 am', left: 5 }, { t: '02:30 pm', left: 9 }, { t: '03:15 pm', left: 0 },
];
