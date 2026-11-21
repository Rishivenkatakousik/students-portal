import { Link, NavLink, Outlet } from 'react-router'

export function Layout() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <div className="container site-header__inner">
          <Link to="/students" className="brand">
            <span className="brand__mark" aria-hidden="true" />
            Results Portal
          </Link>
          <nav aria-label="Main">
            <NavLink to="/import" className="nav-link">
              Import
            </NavLink>
            <NavLink to="/students" className="nav-link">
              Students
            </NavLink>
          </nav>
        </div>
      </header>
      <main id="main" className="container">
        <Outlet />
      </main>
    </>
  )
}
