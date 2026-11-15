import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { MapControlIcon } from './MapControlIcon';

type Props = {
  url: string;
  filename: string;
  location: string;
  onClose: () => void;
};
type Point = { clientX: number; clientY: number };
type ZoomAnchor = Point & { x: number; y: number };

export function PlannerGuidePreview({ url, filename, location, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const image = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [dragging, setDragging] = useState(false);
  const zoomValue = useRef(1);
  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef<{ distance: number; zoom: number; x: number; y: number } | null>(null);
  const pendingAnchor = useRef<ZoomAnchor | null>(null);

  function applyAnchor(anchor: ZoomAnchor) {
    const viewport = body.current;
    const bounds = image.current?.getBoundingClientRect();
    if (!viewport || !bounds) return;
    viewport.scrollLeft += bounds.left + bounds.width * anchor.x - anchor.clientX;
    viewport.scrollTop += bounds.top + bounds.height * anchor.y - anchor.clientY;
  }

  function updateZoom(next: number, anchor: ZoomAnchor) {
    const clamped = Math.max(1, Math.min(3, next));
    if (clamped === zoomValue.current) {
      applyAnchor(anchor);
      return;
    }
    zoomValue.current = clamped;
    pendingAnchor.current = anchor;
    setZoom(clamped);
  }

  function changeZoom(next: number, point?: Point) {
    const viewport = body.current;
    const bounds = image.current?.getBoundingClientRect();
    if (!viewport || !bounds) return;
    const viewportBounds = viewport.getBoundingClientRect();
    const clientX = point?.clientX ?? viewportBounds.left + viewport.clientWidth / 2;
    const clientY = point?.clientY ?? viewportBounds.top + viewport.clientHeight / 2;
    updateZoom(next, {
      x: (clientX - bounds.left) / bounds.width,
      y: (clientY - bounds.top) / bounds.height,
      clientX,
      clientY
    });
  }

  function fitWidth() {
    pendingAnchor.current = null;
    zoomValue.current = 1;
    setZoom(1);
    body.current?.scrollTo({ left: 0, top: 0, behavior: 'instant' });
  }

  useLayoutEffect(() => {
    const anchor = pendingAnchor.current;
    if (anchor) applyAnchor(anchor);
    pendingAnchor.current = null;
  }, [zoom]);

  function startPointer(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
    setDragging(true);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const bounds = image.current!.getBoundingClientRect();
      pinch.current = {
        distance: Math.max(1, Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)),
        zoom: zoomValue.current,
        x: ((a.clientX + b.clientX) / 2 - bounds.left) / bounds.width,
        y: ((a.clientY + b.clientY) / 2 - bounds.top) / bounds.height
      };
    }
  }

  function movePointer(event: ReactPointerEvent<HTMLDivElement>) {
    const previous = pointers.current.get(event.pointerId);
    if (!previous || !body.current) return;
    pointers.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
    if (pointers.current.size >= 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      updateZoom(pinch.current.zoom * distance / pinch.current.distance, {
        x: pinch.current.x,
        y: pinch.current.y,
        clientX: (a.clientX + b.clientX) / 2,
        clientY: (a.clientY + b.clientY) / 2
      });
    } else {
      body.current.scrollLeft -= event.clientX - previous.clientX;
      body.current.scrollTop -= event.clientY - previous.clientY;
    }
  }

  function finishPointer(event: ReactPointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    setDragging(pointers.current.size > 0);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  useEffect(() => {
    const viewport = body.current;
    if (!viewport) return;
    function handleWheel(event: WheelEvent) {
      // Trackpads send pinch gestures as control-wheel events; ordinary scrolling stays native.
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const units = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport!.clientHeight : 1;
      changeZoom(zoomValue.current * Math.exp(-event.deltaY * units * 0.01), event);
    }
    viewport.addEventListener('wheel', handleWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', handleWheel);
  }, []);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      element?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <dialog ref={dialog} className="planner-preview" aria-labelledby="planner-preview-title" onCancel={onClose}>
      <header className="planner-preview-header">
        <div>
          <h2 id="planner-preview-title">Planting guide preview</h2>
          <p>Drag to move the guide. Pinch or use the controls to zoom.</p>
        </div>
        <div className="planner-preview-actions">
          <a className="planner-download" href={url} download={filename}>Save PNG</a>
          <button type="button" className="quiet-button" onClick={onClose} autoFocus>Close</button>
        </div>
      </header>
      <div className="planner-preview-toolbar" role="group" aria-label="Preview zoom controls">
        <button type="button" className="quiet-button" onClick={() => changeZoom(zoom - 0.5)} disabled={zoom <= 1} aria-label="Zoom out" title="Zoom out"><MapControlIcon name="zoomOut" /></button>
        <output aria-label="Preview zoom" aria-live="polite">{Math.round(zoom * 100)}%</output>
        <button type="button" className="quiet-button" onClick={() => changeZoom(zoom + 0.5)} disabled={zoom >= 3} aria-label="Zoom in" title="Zoom in"><MapControlIcon name="zoomIn" /></button>
        <button type="button" className="quiet-button planner-preview-fit" onClick={fitWidth}>Fit width</button>
      </div>
      <div ref={body} className={`planner-preview-body${dragging ? ' is-dragging' : ''}`}
        role="region" aria-label="Planting guide image" tabIndex={0}
        onPointerDown={startPointer} onPointerMove={movePointer}
        onPointerUp={finishPointer} onPointerCancel={finishPointer} onLostPointerCapture={finishPointer}>
        <div ref={image} className="planner-preview-image" style={{ width: `${zoom * 100}%` }}>
          <img src={url} alt={`Planting guide for ${location}`} draggable={false} />
        </div>
      </div>
    </dialog>
  );
}
