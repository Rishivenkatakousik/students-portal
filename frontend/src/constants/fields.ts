// The CSV columns the importer requires, as the backend defines them.

/** Readable names for CSV columns, as an administrator would say them. */
export const FIELD_LABELS: Record<string, string> = {
  student_id: 'Student ID',
  full_name: 'Name',
  email: 'Email',
  date_of_birth: 'Date of birth',
  grade_level: 'Class',
  section: 'Section',
  maths: 'Maths',
  science: 'Science',
  english: 'English',
  social_studies: 'Social studies',
  second_language: 'Second language',
}

export const REQUIRED_COLUMNS = Object.keys(FIELD_LABELS)
