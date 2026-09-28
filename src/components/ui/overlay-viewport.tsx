"use client"

import * as React from "react"

type Viewport = { height: number; width: number; top: number; left: number }
let viewport: Viewport | null = null
const listeners = new Set<() => void>()
let stopListening: (() => void) | undefined

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (!stopListening) {
    let frame = 0
    const visual = window.visualViewport
    const update = () => {
      const next = {
        height: visual?.height ?? window.innerHeight,
        width: visual?.width ?? window.innerWidth,
        top: visual?.offsetTop ?? 0,
        left: visual?.offsetLeft ?? 0,
      }
      if (!viewport || Object.keys(next).some(key => next[key as keyof Viewport] !== viewport?.[key as keyof Viewport])) {
        viewport = next
        listeners.forEach(notify => notify())
      }
    }
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    }
    window.addEventListener("resize", schedule)
    visual?.addEventListener("resize", schedule)
    visual?.addEventListener("scroll", schedule)
    stopListening = () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("resize", schedule)
      visual?.removeEventListener("resize", schedule)
      visual?.removeEventListener("scroll", schedule)
    }
    update()
  }
  return () => {
    listeners.delete(listener)
    if (!listeners.size) {
      stopListening?.()
      stopListening = undefined
      viewport = null
    }
  }
}

const getSnapshot = () => viewport
const getServerSnapshot = () => null

/** Mounted inside the portal, so closed overlays have no viewport listeners. */
export function OverlayViewport({ children }: { children: React.ReactNode }) {
  const bounds = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const style = bounds ? {
    "--overlay-height": `${bounds.height}px`,
    "--overlay-width": `${bounds.width}px`,
    "--overlay-top": `${bounds.top}px`,
    "--overlay-left": `${bounds.left}px`,
  } as React.CSSProperties : undefined

  return <div data-overlay-viewport="" data-compact={bounds && bounds.height < 480 ? "true" : undefined} style={style}>{children}</div>
}
