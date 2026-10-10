"use client"

import { useLayoutEffect, useRef, useState } from "react"
import { ExternalLink } from "lucide-react"
import type { CanonicalDistrictName } from "@/lib/geo/district-normalizer"
import type { Artist } from "@/lib/artists/types"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"

const MAX_PREVIEW = 5
const EDGE_MARGIN = 12

interface DistrictTooltipProps {
  district: CanonicalDistrictName
  artists: Artist[]
  x: number
  y: number
  onPointerEnter: () => void
  onPointerLeave: () => void
  onOpenDetails: () => void
}

export function DistrictTooltip({
  district,
  artists,
  x,
  y,
  onPointerEnter,
  onPointerLeave,
  onOpenDetails,
}: DistrictTooltipProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: x + 16, top: y + 16 })

  // Clamp within the viewport once we know the rendered size.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    let left = x + 16
    let top = y + 16
    if (left + width > window.innerWidth - EDGE_MARGIN) {
      left = Math.max(EDGE_MARGIN, x - width - 16)
    }
    if (top + height > window.innerHeight - EDGE_MARGIN) {
      top = Math.max(EDGE_MARGIN, window.innerHeight - height - EDGE_MARGIN)
    }
    setPos({ left, top })
  }, [x, y, district, artists.length])

  const preview = artists.slice(0, MAX_PREVIEW)
  const remaining = artists.length - preview.length

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={`${district} district summary`}
      className="pointer-events-auto fixed z-40 w-72 max-w-[calc(100vw-1.5rem)] rounded-xl border border-border bg-popover/95 p-3 text-popover-foreground shadow-xl backdrop-blur"
      style={{ left: pos.left, top: pos.top }}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-heading text-sm font-semibold">{district}</h3>
        <span className="text-xs text-muted-foreground">
          {artists.length} {artists.length === 1 ? "singer" : "singers"}
        </span>
      </div>

      {artists.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          No verified singers in the current dataset.
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {preview.map((artist) => (
            <li key={artist.id} className="flex items-center gap-2">
              <Avatar className="size-6 shrink-0">
                {artist.imageUrl ? (
                  <AvatarImage src={artist.imageUrl} alt="" />
                ) : null}
                <AvatarFallback className="text-[10px]">
                  {initials(artist.name)}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 truncate text-xs">{artist.name}</span>
              {artist.wikipedia ? (
                <a
                  href={artist.wikipedia.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-xs text-primary hover:underline"
                >
                  Wikipedia
                  <ExternalLink className="size-3" />
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2.5 flex items-center justify-between">
        {remaining > 0 ? (
          <span className="text-xs text-muted-foreground">+ {remaining} more</span>
        ) : (
          <span />
        )}
        <Button size="xs" variant="secondary" onClick={onOpenDetails}>
          View details
        </Button>
      </div>
    </div>
  )
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
}
