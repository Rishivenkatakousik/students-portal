import { useEffect, useId, useState } from 'react'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { control } from '../../styles/ui'

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
    <div className="flex-[1_1_260px]">
      <label htmlFor={id} className="sr-only">
        Search by name or student ID
      </label>
      <input
        id={id}
        type="search"
        className={`${control} w-full`}
        placeholder="Search by name or student ID"
        value={text}
        maxLength={100}
        onChange={(e) => setText(e.target.value)}
        autoComplete="off"
      />
    </div>
  )
}
