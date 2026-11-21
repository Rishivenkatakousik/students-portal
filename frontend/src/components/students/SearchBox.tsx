import { Search } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { Input } from '@/components/ui/input'

const SEARCH_DELAY_MS = 300

export function SearchBox({ value, onSearch }: { value: string; onSearch: (q: string) => void }) {
  const [text, setText] = useState(value)
  const debounced = useDebouncedValue(text, SEARCH_DELAY_MS)
  const id = useId()

  // Typing -> URL, once the user pauses.
  useEffect(() => {
    if (debounced.trim() !== value) onSearch(debounced.trim())
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to new input
  }, [debounced])

  // URL -> box, when it changes from outside (Back button, "Clear filters").
  useEffect(() => {
    setText((current) => (current.trim() === value ? current : value))
  }, [value])

  return (
    <div className="relative flex-[1_1_320px]">
      <label htmlFor={id} className="sr-only">
        Search by name or student ID
      </label>
      <Search
        className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        id={id}
        type="search"
        className="h-12 rounded-[14px] bg-background pl-11 text-[15px] md:text-[15px] dark:bg-background"
        placeholder="Search by name or student ID"
        value={text}
        maxLength={100}
        onChange={(e) => setText(e.target.value)}
        autoComplete="off"
      />
    </div>
  )
}
