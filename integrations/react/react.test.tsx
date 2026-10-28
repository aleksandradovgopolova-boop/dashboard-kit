import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { KitRoot, useDashboardSession, useKitComponent } from './index';
import type { DashboardSession } from './index';

type Query = { page?: number; filters?: Record<string, string[]> };
type Snapshot = { status: string; view: { rowCount: number } | null };
type Runtime = {
  dkSelect: (node: HTMLElement, options: {label: string; value: string; options: {name: string; value: string}[]; onChange: (v: string | null) => void}) => {
    update(options: {value: string; options: {name: string; value: string}[]}): void; destroy(): void;
  };
  dkDashboard: {createSession(options: {load: (request: {query: Query; signal: AbortSignal}) => Promise<unknown>}): DashboardSession<Query, Snapshot>};
};
const runtime = window as unknown as Runtime;
const kit = process.env.DASHBOARD_KIT_ROOT!;
const data = JSON.parse(readFileSync(resolve(kit, 'data/reference-dashboard.json'), 'utf8'));
beforeAll(() => {
  window.matchMedia ??= (() => ({matches: false, addEventListener() {}, removeEventListener() {}})) as unknown as typeof matchMedia;
  for (const name of ['dk-util', 'dk-icons', 'dk-select', 'dk-dashboard']) {
    window.eval(readFileSync(resolve(kit, `js/${name}.js`), 'utf8'));
  }
});
afterEach(cleanup);

describe('React integration with real kit runtime', () => {
  it('updates a real select without replacing its trigger; closes its menu on unmount in StrictMode', async () => {
    const changed = vi.fn();
    const instances: {destroy: ReturnType<typeof vi.fn>}[] = [];
    const create = (node: HTMLElement, value: string) => {
      const options = [{name: 'Первый', value: 'one'}, {name: 'Второй', value: 'two'}];
      const select = runtime.dkSelect(node, {label: 'Категория', options, value, onChange: changed});
      const destroy = vi.fn(() => select.destroy()); instances.push({destroy});
      return {update: (next: string) => select.update({value: next, options}), destroy};
    };
    function Filter({value}: {value: string}) { const ref = useKitComponent(create, value); return <div ref={ref}/>; }
    const view = render(<StrictMode><Filter value="one"/></StrictMode>);
    const trigger = view.container.querySelector('.dk-select__trigger')!;
    expect(trigger.textContent).toContain('Первый');
    view.rerender(<StrictMode><Filter value="two"/></StrictMode>);
    expect(view.container.querySelector('.dk-select__trigger')).toBe(trigger);
    expect(trigger.textContent).toContain('Второй');
    expect(changed).not.toHaveBeenCalled();
    fireEvent.click(trigger);
    expect(document.querySelector('[role="listbox"]')).not.toBeNull();
    view.unmount();
    expect(document.querySelector('[role="listbox"]')).toBeNull();
    expect(instances.length).toBeGreaterThan(1);
    expect(instances.every(x => x.destroy.mock.calls.length === 1)).toBe(true);
  });

  it('keeps two roots independently themed and preserves the host theme', () => {
    const original = document.documentElement.getAttribute('data-theme');
    const view = render(<><KitRoot theme="dark" title="one"/><KitRoot theme="light" title="two"/></>);
    view.rerender(<><KitRoot theme="light" title="one"/><KitRoot theme="dark" title="two"/></>);
    expect(screen.getByTitle('one').dataset.theme).toBe('light');
    expect(screen.getByTitle('two').dataset.theme).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe(original);
  });

  it('cancels obsolete requests and ignores their late results; unmount aborts the pending request', async () => {
    const requests: {signal: AbortSignal; finish: (value: unknown) => void}[] = [];
    const create = () => runtime.dkDashboard.createSession({load: ({signal}) => new Promise(resolve => requests.push({signal, finish: resolve}))});
    const first = {}, second = {page: 2}, third = {page: 3};
    function Dashboard({query}: {query: Query}) {
      const {snapshot} = useDashboardSession(create, query);
      return <output>{snapshot?.status}:{snapshot?.view?.rowCount}</output>;
    }
    const view = render(<StrictMode><Dashboard query={first}/></StrictMode>);
    await waitFor(() => expect(requests).toHaveLength(1));
    view.rerender(<StrictMode><Dashboard query={second}/></StrictMode>);
    await waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[0].signal.aborted).toBe(true);
    await act(async () => requests[1].finish(data));
    expect(screen.getByRole('status').textContent).toContain('ready:');
    const ready = screen.getByRole('status').textContent;
    await act(async () => requests[0].finish({invalid: true}));
    expect(screen.getByRole('status').textContent).toBe(ready);
    view.rerender(<StrictMode><Dashboard query={third}/></StrictMode>);
    await waitFor(() => expect(requests).toHaveLength(3));
    view.unmount();
    expect(requests[2].signal.aborted).toBe(true);
  });

  it('shows empty and error states and retries the last valid query', async () => {
    let fail = true;
    const create = () => runtime.dkDashboard.createSession({load: async () => {if (fail) throw Error('offline'); return data;}});
    const query = {filters: {[data.dimensions[0].id]: ['missing-value']}};
    function Dashboard() {
      const {snapshot, retry} = useDashboardSession(create, query);
      return <><output>{snapshot?.status}</output><button onClick={() => void retry()}>Повторить</button></>;
    }
    render(<Dashboard/>);
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('error'));
    fail = false; fireEvent.click(screen.getByText('Повторить'));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('empty'));
  });
});
