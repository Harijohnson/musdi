"use client"

import type { CanonicalDistrictName } from "@/lib/geo/district-normalizer"
import type { Artist } from "@/lib/artists/types"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ArtistCard } from "@/components/artist/artist-card"

interface DistrictSheetProps {
  district: CanonicalDistrictName | null
  artists: Artist[]
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Artist id to visually highlight (e.g. arrived via search). */
  highlightArtistId?: string | null
}

export function DistrictSheet({
  district,
  artists,
  open,
  onOpenChange,
  highlightArtistId,
}: DistrictSheetProps) {
  const count = artists.length

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 p-0 sm:max-w-md"
        aria-describedby={undefined}
      >
        <SheetHeader className="border-b p-4">
          <SheetTitle className="text-lg">
            {district ? `${district} District` : "District"}
          </SheetTitle>
          <SheetDescription>
            {count} {count === 1 ? "singer" : "singers"} in the current dataset
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100svh-5rem)]">
          <div className="space-y-2 p-4">
            {count === 0 ? (
              <p className="text-sm text-muted-foreground">
                No verified singers in the current dataset. Artist information is
                compiled from Wikidata and Wikipedia and may be incomplete.
              </p>
            ) : (
              artists.map((artist) => (
                <div
                  key={artist.id}
                  id={`artist-${artist.id}`}
                  className={
                    highlightArtistId === artist.id
                      ? "rounded-lg ring-2 ring-ring"
                      : undefined
                  }
                >
                  <ArtistCard artist={artist} />
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
