# Es Magico | Full-stack Intern Assignment | Sample Pack

Sample data for the **Student Results Portal** assignment. Everything here is synthetic: all names, emails and phone numbers are fictional.

## Files

- `students_sample.csv`: 5,000 student rows with deliberately messy data. Your main test file.
- `students_small.csv`: 25 rows with obvious problems. Use it for quick iteration and tests.

## Expected results

Imported into an empty database, your portal should report:

| File | Rows read | Imported | Rejected |
|---|---|---|---|
| students_small.csv | 25 | 16 | 9 |
| students_sample.csv | 5,000 | 4,685 | 315 |

We will also run your app against a different messy CSV that you have not seen, in the same format. Build for the rules, not for the sample file.

## Column rules

| Column | Required | Rule |
|---|---|---|
| student_id | Yes | 3 to 20 characters: letters, digits or hyphen. Not case-sensitive (store in upper case). The first row with a given ID is the original. Later rows with the same ID in the file are rejected as duplicates. |
| full_name | Yes | 2 to 100 characters after trimming. Collapse repeated spaces inside the name. Any Unicode letters, apostrophes and commas are fine (for example "Singh, Aarav"). |
| email | Yes | A valid email address. Store in lower case. |
| date_of_birth | Yes | Either YYYY-MM-DD or DD/MM/YYYY. Must be a real date. The student must be between 5 and 25 years old today. |
| grade_level | Yes | A whole number from 1 to 12. "9" and "09" are both fine. |
| section | Yes | One letter from A to F, any case. Store in upper case. |
| maths, science, english, social_studies, second_language | Yes | A number from 0 to 100. Decimals are allowed. |

## File-level rules

- The header row must contain all required columns. Column order and letter case do not matter, and surrounding spaces are ignored. Extra columns are ignored.
- UTF-8, with or without a byte order mark. Windows and Unix line endings must both work. Quoted fields may contain commas.
- Blank lines, and rows where every field is empty, are skipped. They are not errors and are not counted.
- A row with the wrong number of fields is rejected as a whole.
- Error codes: MISSING_REQUIRED, INVALID_FORMAT, OUT_OF_RANGE, DUPLICATE_ID, WRONG_FIELD_COUNT.
- Row numbers in the error report are line numbers in the file, with the header as line 1, counting blank lines.
