import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <div className="state">
      <h1>Page not found</h1>
      <p>There is nothing at this address.</p>
      <Link to="/students" className="button">
        Go to students
      </Link>
    </div>
  )
}
