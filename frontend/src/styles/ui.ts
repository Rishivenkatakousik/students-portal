// Tables that turn into labelled cards on narrow screens. Every cell needs a
// data-label; the header row is hidden visually (but kept for screen readers).
export const stackedTable = [
  'max-sm:[&_thead]:sr-only',
  'max-sm:[&_tbody_tr]:block max-sm:[&_tbody_tr]:px-4 max-sm:[&_tbody_tr]:py-3',
  'max-sm:[&_td]:grid max-sm:[&_td]:grid-cols-[7.5rem_minmax(0,1fr)] max-sm:[&_td]:gap-2 max-sm:[&_td]:px-0 max-sm:[&_td]:py-1 max-sm:[&_td]:whitespace-normal',
  'max-sm:[&_td]:before:text-xs max-sm:[&_td]:before:font-medium max-sm:[&_td]:before:text-muted-foreground max-sm:[&_td]:before:content-[attr(data-label)]',
  'max-sm:[&_td>*]:justify-self-start',
].join(' ')

/** Column header style shared by the data tables. */
export const tableHead = 'h-11 px-4 text-xs font-medium tracking-wider text-muted-foreground uppercase'
