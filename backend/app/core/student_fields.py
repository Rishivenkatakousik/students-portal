"""The columns of a student record, shared by the models, the CSV importer and grading."""

MARK_FIELDS = ("maths", "science", "english", "social_studies", "second_language")

REQUIRED_COLUMNS = (
    "student_id",
    "full_name",
    "email",
    "date_of_birth",
    "grade_level",
    "section",
    *MARK_FIELDS,
)
