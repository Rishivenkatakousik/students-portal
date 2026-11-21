import { Link } from 'react-router'
import { btnPrimary, stateText } from '../ui'

export function NotFoundPage() {
  return (
    <div className="px-4 py-12 text-center">
      <h1>Page not found</h1>
      <p className={stateText}>There is nothing at this address.</p>
      <Link to="/students" className={btnPrimary}>
        Go to students
      </Link>
    </div>
  )
}
