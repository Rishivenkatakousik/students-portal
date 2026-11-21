import { Link, NavLink, Outlet } from 'react-router'

const container = 'mx-auto w-full max-w-[1100px] px-4'

function navLinkClass({ isActive }: { isActive: boolean }) {
  return `inline-flex items-center border-b-3 px-3 font-medium no-underline max-[420px]:px-2 ${
    isActive ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-ink'
  }`
}

export function Layout() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-4 focus:z-10 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="border-b border-line bg-white print:hidden">
        <div className={`${container} flex min-h-15 items-center justify-between gap-4`}>
          <Link to="/students" className="inline-flex items-center gap-2.5 font-bold text-ink no-underline max-[420px]:gap-2">
            <span className="size-6 rounded-md bg-accent" aria-hidden="true" />
            Results Portal
          </Link>
          <nav aria-label="Main" className="flex gap-1 self-stretch">
            <NavLink to="/import" className={navLinkClass}>
              Import
            </NavLink>
            <NavLink to="/students" className={navLinkClass}>
              Students
            </NavLink>
          </nav>
        </div>
      </header>
      <main id="main" className={`${container} pt-7 pb-12 print:max-w-none print:p-0`}>
        <Outlet />
      </main>
    </>
  )
}
