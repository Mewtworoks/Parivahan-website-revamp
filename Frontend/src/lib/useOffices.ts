import * as api from '../api';
import { rtosFor } from '../data/rtoOffices';
import type { RtoOffice } from '../types';
import { useApi } from './useApi';

/**
 * The offices for a state, with load and wait taken from the live queues.
 *
 * Falls back to the static list in data/rtoOffices.ts when the service is
 * unreachable, because choosing an office is step one of the form — a citizen
 * should never be blocked from starting by a backend that is down. The `live`
 * flag lets a screen say which it is showing.
 */
export function useOffices(state: string | undefined) {
  const stateName = state || 'Maharashtra';
  const { data, error, loading, reload } = useApi(
    signal => api.listRtos(stateName, signal),
    [stateName],
  );

  const live = Boolean(data && !error);
  const offices: RtoOffice[] = live
    ? data!.rtos.map(o => ({
        id: o.id, name: o.name, area: o.area, km: o.km, wait: o.wait, load: o.load,
      }))
    : rtosFor(stateName);

  return { offices, live, loading, error, reload, detail: data?.rtos ?? null };
}
