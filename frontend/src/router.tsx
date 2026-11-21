import { createBrowserRouter, Navigate } from 'react-router'
import { Layout } from './components/Layout'
import { ImportPage } from './pages/ImportPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { StudentReportPage } from './pages/StudentReportPage'
import { StudentsPage } from './pages/StudentsPage'

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/students" replace /> },
      { path: 'import', element: <ImportPage /> },
      { path: 'students', element: <StudentsPage /> },
      { path: 'students/:studentId', element: <StudentReportPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
