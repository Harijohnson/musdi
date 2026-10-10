import { Skeleton } from "@/components/ui/skeleton"

// Grid placements that sketch Tamil Nadu's rough outline: wide across the top,
// tapering down to a point toward the south (Kanyakumari).
const MAP_TILES = [
  "col-start-1 col-span-4 h-7",
  "col-start-1 col-span-2 h-12",
  "col-start-3 col-span-2 h-10",
  "col-start-1 col-span-1 h-10",
  "col-start-2 col-span-3 h-14",
  "col-start-2 col-span-2 h-12",
  "col-start-3 col-span-1 h-10",
  "col-start-2 col-span-2 h-8",
  "col-start-3 col-span-1 h-6",
]

export function MapLoading() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0a0d14]">
      {/* Top controls — mirrors the real header/search/nav layout. */}
      <div className="absolute inset-x-0 top-0 flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56 opacity-40 sm:h-9 sm:w-72" />
          <Skeleton className="h-3 w-40 opacity-30" />
        </div>
        <div className="flex items-start gap-1.5">
          <Skeleton className="size-9 rounded-md opacity-40" />
          <Skeleton className="size-9 rounded-md opacity-40" />
          <Skeleton className="size-9 rounded-md opacity-40" />
        </div>
      </div>

      {/* Central map placeholder — a loose cluster of district tiles that
          evokes the shape of the map rather than a single box. */}
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center gap-5">
          <div className="grid w-52 grid-cols-4 gap-1.5 sm:w-72">
            {MAP_TILES.map((tile, i) => (
              <Skeleton
                key={i}
                className={`rounded-md opacity-40 ${tile}`}
                style={{ animationDelay: `${(i % 6) * 120}ms` }}
              />
            ))}
          </div>
          <p className="text-sm text-muted-foreground">Loading Tamil Nadu map…</p>
        </div>
      </div>

      {/* Bottom interaction hint */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2">
        <Skeleton className="h-6 w-56 rounded-full opacity-30" />
      </div>
    </div>
  )
}

export function MapError({ message }: { message: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#0a0d14] p-6">
      <div className="max-w-sm text-center">
        <h2 className="font-heading text-base font-semibold">
          Could not load the map
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  )
}
