"use client"

import { useEffect, useState } from "react"
import { Search, MapPin, Music } from "lucide-react"
import type { CanonicalDistrictName } from "@/lib/geo/district-normalizer"
import type { Artist, District } from "@/lib/artists/types"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"

interface MapSearchProps {
  districts: District[]
  artists: Artist[]
  onSelectDistrict: (district: CanonicalDistrictName) => void
  onSelectArtist: (artist: Artist) => void
}

export function MapSearch({
  districts,
  artists,
  onSelectDistrict,
  onSelectArtist,
}: MapSearchProps) {
  const [open, setOpen] = useState(false)

  // ⌘K / Ctrl+K toggles the search dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  return (
    <>
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Search districts and singers"
        onClick={() => setOpen(true)}
      >
        <Search />
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search"
        description="Search districts and singers"
      >
        <Command shouldFilter label="Search districts and singers">
          <CommandInput placeholder="Search a district or singer…" />
          <CommandList>
            <CommandEmpty>No matching district or singer.</CommandEmpty>

            <CommandGroup heading="Districts">
              {districts.map((d) => (
                <CommandItem
                  key={`district-${d.id}`}
                  value={`district ${d.name}`}
                  onSelect={() => {
                    onSelectDistrict(d.name)
                    setOpen(false)
                  }}
                >
                  <MapPin className="size-3.5 text-muted-foreground" />
                  <span>{d.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {d.artistCount}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>

            {artists.length > 0 ? (
              <CommandGroup heading="Singers">
                {artists.map((a) => (
                  <CommandItem
                    key={`artist-${a.id}`}
                    value={`singer ${a.name}`}
                    onSelect={() => {
                      onSelectArtist(a)
                      setOpen(false)
                    }}
                  >
                    <Music className="size-3.5 text-muted-foreground" />
                    <span className="truncate">{a.name}</span>
                    {a.birthplaceDistrict ? (
                      <span className="ml-auto truncate text-xs text-muted-foreground">
                        {a.birthplaceDistrict}
                      </span>
                    ) : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
