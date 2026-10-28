import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { HTMLAttributes } from 'react';

/** The application supplies React; the static kit has no React dependency. */
export interface KitController<Options> {
  update(options: Options): void;
  destroy(): void;
}
export type KitFactory<Options> = (node: HTMLElement, options: Options) => KitController<Options>;
const useClientLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** React owns the empty wrapper, the kit owns its disposable child. Memoize create. */
export function useKitComponent<Options>(create: KitFactory<Options>, options: Options) {
  const host = useRef<HTMLDivElement>(null);
  const controller = useRef<KitController<Options> | null>(null);
  const latest = useRef(options);
  useClientLayoutEffect(() => { latest.current = options; }, [options]);
  useClientLayoutEffect(() => {
    if (!host.current) return;
    const node = document.createElement('div');
    host.current.append(node);
    let instance: KitController<Options>;
    try { instance = create(node, latest.current); }
    catch (error) { node.remove(); throw error; }
    controller.current = instance;
    return () => {
      controller.current = null;
      try { instance.destroy(); } finally { node.remove(); }
    };
  }, [create]);
  useClientLayoutEffect(() => { controller.current?.update(options); }, [create, options]);
  return host;
}

export function KitRoot({ theme, className = '', ...props }: HTMLAttributes<HTMLDivElement> & {
  theme: 'dark' | 'light';
}) {
  return <div {...props} className={`dk-root ${className}`} data-theme={theme} data-accent="blue" />;
}

export interface DashboardSession<Query, Snapshot> {
  subscribe(listener: (snapshot: Snapshot) => void): () => void;
  getSnapshot(): Snapshot;
  load(query: Query): Promise<Snapshot | null>;
  retry(): Promise<Snapshot | null>;
  destroy(): void;
}

/** Factory runs in an effect, never during render; StrictMode creates fresh sessions. */
export function useDashboardSession<Query, Snapshot>(
  create: () => DashboardSession<Query, Snapshot>, query: Query,
) {
  const session = useRef<DashboardSession<Query, Snapshot> | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  useEffect(() => {
    const instance = create();
    session.current = instance;
    let active = true;
    setSnapshot(instance.getSnapshot());
    const unsubscribe = instance.subscribe(value => { if (active) setSnapshot(value); });
    return () => {
      active = false;
      session.current = null;
      try { unsubscribe(); } finally { instance.destroy(); }
    };
  }, [create]);
  useEffect(() => { void session.current?.load(query); }, [create, query]);
  return { snapshot, retry: () => session.current?.retry() ?? Promise.resolve(null) };
}
