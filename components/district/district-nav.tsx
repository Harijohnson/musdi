"use client"

import { useState } from "react"
import { List } from "lucide-react"
import type { CanonicalDistrictName } from "@/lib/geo/district-normalizer"
import type { District } from "@/lib/artists/types"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"

/**
 * Keyboard- and screen-reader-accessible navigation of all districts. Serves
 * as the required non-canvas fallback for the WebGL map: every district is a
 * focusable button with its singer count.
 */
export function DistrictNav({
  districts,
  onSelect,
}: {
  districts: District[]
  onSelect: (district: CanonicalDistrictName) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Browse all districts"
          >
            <List />
          </Button>
        }
      />
      <SheetContent side="left" className="w-full gap-0 p-0 sm:max-w-xs">
        <SheetHeader className="border-b p-4">
          <SheetTitle>All districts</SheetTitle>
          <SheetDescription>
            Select a district to view its singers.
          </SheetDescription>
        </SheetHeader>
        <ScrollArea className="h-[calc(100svh-5rem)]">
          <nav aria-label="Districts" className="p-2">
            <ul className="space-y-0.5">
              {districts.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(d.name)
                      setOpen(false)
                    }}
                    className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <span>{d.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {d.artistCount}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
