"use client"

import { ExternalLink, MapPin, Home } from "lucide-react"
import type { Artist } from "@/lib/artists/types"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { SpotifyIcon, AppleMusicIcon } from "@/components/artist/streaming-icons"

const CATEGORY_LABEL: Record<string, string> = {
  singer: "Singer",
  actor: "Actor",
  music_director: "Music Director",
  lyricist: "Lyricist",
  dancer: "Dancer",
  director: "Director",
}

export function ArtistCard({ artist }: { artist: Artist }) {
  return (
    <Card className="flex flex-row items-start gap-3 p-3">
      <Avatar className="size-14 shrink-0 rounded-md">
        {artist.imageUrl ? <AvatarImage src={artist.imageUrl} alt={artist.name} /> : null}
        <AvatarFallback className="rounded-md text-sm">
          {initials(artist.name)}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <h3 className="font-medium">{artist.name}</h3>
          {artist.category.map((c) => (
            <Badge key={c} variant="secondary" className="text-[10px]">
              {CATEGORY_LABEL[c] ?? c}
            </Badge>
          ))}
        </div>

        <dl className="mt-1 space-y-0.5 text-xs text-muted-foreground">
          {artist.birthplace.name ? (
            <div className="flex items-start gap-1">
              <MapPin className="mt-0.5 size-3 shrink-0" />
              <dd>
                Born in {artist.birthplace.name}
                {artist.birthplaceDistrict ? ` · ${artist.birthplaceDistrict} district` : ""}
              </dd>
            </div>
          ) : null}

          {/* Native/hometown shown ONLY when verified. Never fabricated. */}
          {artist.nativePlace?.verified ? (
            <div className="flex items-start gap-1">
              <Home className="mt-0.5 size-3 shrink-0" />
              <dd>
                Native: {artist.nativePlace.name}
                {artist.nativePlace.district ? ` · ${artist.nativePlace.district} district` : ""}
              </dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {artist.wikipedia ? (
            <a
              href={artist.wikipedia.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-primary hover:underline"
            >
              Wikipedia ({artist.wikipedia.language})
              <ExternalLink className="size-3" />
            </a>
          ) : (
            <span className="text-muted-foreground">No Wikipedia article</span>
          )}
          <a
            href={artist.wikidataUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-muted-foreground hover:underline"
          >
            Wikidata
            <ExternalLink className="size-3" />
          </a>
        </div>

        {/* Streaming profiles — shown only when sourced from Wikidata. */}
        {artist.streaming?.spotify || artist.streaming?.appleMusic ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {artist.streaming.spotify ? (
              <a
                href={artist.streaming.spotify}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${artist.name} on Spotify`}
                className="inline-flex size-7 items-center justify-center rounded-full border text-[#1DB954] transition-colors hover:bg-[#1DB954]/10"
              >
                <SpotifyIcon className="size-4" />
              </a>
            ) : null}
            {artist.streaming.appleMusic ? (
              <a
                href={artist.streaming.appleMusic}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${artist.name} on Apple Music`}
                className="inline-flex size-7 items-center justify-center rounded-full border text-[#FA243C] transition-colors hover:bg-[#FA243C]/10"
              >
                <AppleMusicIcon className="size-4" />
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  )
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("")
}
