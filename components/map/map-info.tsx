"use client"

import { Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

/**
 * "About this map" dialog — explains where the data comes from and the
 * nuances of how singers are placed, so the map itself can stay uncluttered.
 */
export function MapInfo({ updatedAt }: { updatedAt: string }) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="About this map"
          >
            <Info />
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>About this map</DialogTitle>
          <DialogDescription>
            How the data was compiled — and what it does and doesn&apos;t claim.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2.5 text-sm text-muted-foreground">
          <li>
            Compiled from{" "}
            <a
              href="https://www.wikidata.org"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Wikidata
            </a>{" "}
            and{" "}
            <a
              href="https://www.wikipedia.org"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Wikipedia
            </a>
            . Coverage is automated and may be incomplete.
          </li>
          <li>
            Singers are grouped by their{" "}
            <span className="text-foreground/90">birthplace district</span>,
            mapped onto the current 38-district boundaries of Tamil Nadu.
          </li>
          <li>
            A native / hometown place is shown only when{" "}
            <span className="text-foreground/90">verified by a source</span> —
            residence, workplace or place of death don&apos;t count.
          </li>
          <li>
            Singers whose district couldn&apos;t be confirmed are left off the
            map rather than guessed.
          </li>
          <li>Photos are optional and may be missing for some singers.</li>
        </ul>

        <p className="text-xs text-muted-foreground/70">
          Data updated {new Date(updatedAt).toLocaleDateString()}
        </p>
      </DialogContent>
    </Dialog>
  )
}
