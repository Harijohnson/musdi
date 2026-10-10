"use client" // Error boundaries must be Client Components

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex h-svh w-full flex-col items-center justify-center gap-4 bg-[#0a0d14] p-6 text-center">
      <div>
        <h2 className="font-heading text-lg font-semibold text-foreground">
          Something went wrong
        </h2>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          The Tamil Nadu singers map could not be displayed. This may be a
          temporary problem loading the data.
        </p>
      </div>
      <Button onClick={() => retry()}>Try again</Button>
    </div>
  )
}
