# School Form 2 (SF2) Attendance Export - Setup Guide

## Overview
This implementation provides a complete School Form 2 (SF2) Daily Attendance Report export system that matches the exact format specified in `mockup/format/SF2_2026_Grade 6 - RIZAL.xls`.

## Installation Steps

### 1. Install PHPSpreadsheet Package

Run this command in your project root:

```bash
composer require phpoffice/phpspreadsheet
```

If you get a timeout error, try:

```bash
composer require phpoffice/phpspreadsheet --prefer-dist
```

Or add to composer.json manually and run `composer update`:

```json
{
    "require": {
        "phpoffice/phpspreadsheet": "^2.0"
    }
}
```

### 2. Run Database Migration

Add the gender field to students table:

```bash
php artisan migrate
```

This will add a `gender` enum field ('male'/'female') to the students table.

### 3. Update Existing Student Data (Optional)

If you have existing students without gender data, you can update them:

```sql
-- Via MySQL or your database tool
UPDATE students SET gender = 'male' WHERE id IN (1,2,3...);
UPDATE students SET gender = 'female' WHERE id IN (4,5,6...);
```

Or create a seeder/command to handle this programmatically.

## Files Created/Modified

### New Files:
1. **`app/Services/SF2ExportService.php`** - Main service for generating SF2 Excel files
2. **`database/migrations/XXXX_add_gender_to_students_table.php`** - Adds gender field
3. **`ATTENDANCE_SF2_IMPLEMENTATION_PLAN.md`** - Technical planning document
4. **`ATTENDANCE_SF2_SETUP.md`** - This file

### Modified Files:
1. **`app/Http/Controllers/AttendanceController.php`** - Added `exportSF2()` method
2. **`app/Models/Student.php`** - Added 'gender' to fillable array
3. **`routes/web.php`** - Added export SF2 route

## API Usage

### Export SF2 Endpoint

**URL:** `GET /api/attendance/export-sf2`

**Authentication:** Required (Bearer token or session)

**Parameters:**

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| course_id | integer | Yes | Course/Section ID | 1 |
| month | integer | Yes | Month number (1-12) | 8 |
| year | integer | Yes | Year | 2026 |
| school_name | string | No | Override school name | "Masupe Elementary School" |
| school_id | string | No | School ID number | "123456" |
| grade_level | string | No | Grade level | "Grade 6" |
| adviser_name | string | No | Adviser name | "JUAN DELA CRUZ" |
| school_head | string | No | School head name | "MARIA SANTOS" |

**Example Request:**

```javascript
// Using Fetch API
fetch('/api/attendance/export-sf2?course_id=1&month=8&year=2026&school_name=Masupe Elementary School', {
    headers: {
        'Authorization': 'Bearer YOUR_TOKEN'
    }
})
.then(response => response.blob())
.then(blob => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'SF2_2026_RIZAL_August.xls';
    a.click();
});
```

```javascript
// Using Axios
axios({
    url: '/api/attendance/export-sf2',
    method: 'GET',
    params: {
        course_id: 1,
        month: 8,
        year: 2026,
        school_name: 'Masupe Elementary School'
    },
    responseType: 'blob',
})
.then(response => {
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'SF2_2026_RIZAL_August.xls');
    document.body.appendChild(link);
    link.click();
});
```

**Response:**
- Content-Type: `application/vnd.ms-excel`
- File download with naming pattern: `SF2_YYYY_Section_MonthName.xls`

## SF2 Format Features

### ✅ Implemented Features:

1. **Exact Header Format**
   - School Form 2 title and subtitle
   - School ID, School Year, Month
   - School Name, Grade Level, Section

2. **Student List with Gender Separation**
   - Male students section
   - Female students section
   - Automatic sorting by name
   - Row numbers

3. **Daily Attendance Grid**
   - Columns for each day of the month
   - Day of week indicators (M, T, W, TH, F)
   - Weekend days greyed out
   - Attendance codes:
     - (blank) = Present
     - x = Absent
     - ▴ = Late/Tardy

4. **Monthly Totals**
   - ABSENT count per student
   - PRESENT count per student
   - REMARKS column for dropout/transfer notes

5. **Summary Section**
   - Month name
   - Number of school days (excluding weekends)
   - Guidelines text
   - Attendance codes explanation

6. **Guidelines Section**
   - Reasons/Causes for NLS
   - Domestic, Individual, School, Geographic, Financial factors
   - Complete as per DepEd format

7. **Footer**
   - Adviser certification statement
   - Adviser signature block
   - School Head attestation
   - "Generated thru LIS" mark

### 📋 Format Specifications:

- **File Format:** Microsoft Excel 97-2003 (.xls)
- **Page Setup:** Landscape, Legal size
- **Fonts:** Arial, SansSerif with exact sizes matching template
- **Borders:** Thin borders on all data cells
- **Alignment:** Center for headers, left for names, center for attendance marks
- **Cell Merging:** Proper merging for headers and labels

## Student Gender Management

### Adding Gender When Importing Students

If you import students from Google Classroom or CSV, add gender field:

```php
// In your import/sync logic
$student = Student::updateOrCreate([
    'student_number' => $data['student_number']
], [
    'course_id' => $courseId,
    'name' => $data['name'],
    'email' => $data['email'],
    'gender' => $data['gender'] ?? 'male', // Add gender field
]);
```

### Manual Gender Update

Create a UI or API endpoint to update student gender:

```php
// Example API endpoint
Route::put('/api/students/{student}/gender', function (Request $request, Student $student) {
    $request->validate([
        'gender' => ['required', 'in:male,female']
    ]);
    
    $student->update(['gender' => $request->gender]);
    
    return response()->json(['message' => 'Gender updated successfully']);
});
```

## Attendance Status Codes

The SF2 export maps attendance statuses as follows:

| Database Status | SF2 Display | Description |
|----------------|-------------|-------------|
| present | (blank) | Student was present |
| excused | (blank) | Student was excused (counted as present) |
| absent | x | Student was absent |
| late | ▴ | Student was late/tardy |

## Troubleshooting

### Issue: "Class 'PhpOffice\PhpSpreadsheet\Spreadsheet' not found"
**Solution:** Run `composer install` or `composer require phpoffice/phpspreadsheet`

### Issue: "Column 'gender' not found"
**Solution:** Run `php artisan migrate` to add the gender column

### Issue: Export shows all students as male
**Solution:** Update student records with correct gender values

### Issue: Weekend days not greyed out
**Solution:** Check that the date calculation is working correctly (uses PHP's date() function)

### Issue: File download doesn't work
**Solution:** Ensure temporary file directory is writable:
```bash
# Check permissions
ls -la storage/
chmod -R 775 storage/
```

## Customization

### Change Default School Information

Edit the defaults in `SF2ExportService.php` or pass them via API parameters:

```php
$config = [
    'school_name' => 'Your School Name',
    'school_id' => 'YOUR_ID',
    'grade_level' => 'Grade 7',
    'adviser_name' => 'TEACHER NAME',
    'school_head' => 'PRINCIPAL NAME',
];
```

### Modify Cell Styling

Edit the `styleCell()` and related methods in `SF2ExportService.php`:

```php
private function styleCell(string $cell, int $fontSize = 10, bool $bold = false, string $alignment = Alignment::HORIZONTAL_LEFT): void
{
    // Modify font, alignment, colors here
}
```

### Add Custom Columns

Add additional columns in the `generateStudentList()` method:

```php
// After attendance columns
$col = 'AK'; // Next available column
$this->sheet->setCellValue($col . $row, 'Custom Data');
```

## Next Steps - Frontend Integration

### 1. Add Export Button to Attendance Page

```jsx
// Example React component
function AttendanceExportButton({ courseId, currentDate }) {
    const handleExport = async () => {
        const date = new Date(currentDate);
        const month = date.getMonth() + 1;
        const year = date.getFullYear();
        
        const url = `/api/attendance/export-sf2?course_id=${courseId}&month=${month}&year=${year}`;
        
        try {
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `SF2_${year}_${month}.xls`;
            a.click();
        } catch (error) {
            console.error('Export failed:', error);
        }
    };
    
    return (
        <button onClick={handleExport} className="btn btn-primary">
            Export SF2 Report
        </button>
    );
}
```

### 2. Add Month/Year Selector

```jsx
function SF2ExportModal({ courseId, onClose }) {
    const [month, setMonth] = useState(new Date().getMonth() + 1);
    const [year, setYear] = useState(new Date().getFullYear());
    
    return (
        <div className="modal">
            <h3>Export SF2 Report</h3>
            <select value={month} onChange={e => setMonth(e.target.value)}>
                {/* Months 1-12 */}
            </select>
            <select value={year} onChange={e => setYear(e.target.value)}>
                {/* Years */}
            </select>
            <button onClick={() => exportSF2(courseId, month, year)}>
                Download Report
            </button>
        </div>
    );
}
```

## Testing

### Test the Export

1. Ensure you have students with attendance records
2. Make sure students have gender values set
3. Call the export API:

```bash
curl -X GET "http://localhost:8000/api/attendance/export-sf2?course_id=1&month=8&year=2026" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  --output test_sf2.xls
```

4. Open the generated `test_sf2.xls` file in Excel/LibreOffice
5. Verify formatting matches the template

## Support and Maintenance

- The SF2 format is based on DepEd's official School Form 2
- Template reference: `mockup/format/SF2_2026_Grade 6 - RIZAL.xls`
- For format updates, modify `SF2ExportService.php`

## License

This implementation is part of the Mentora LMS project.
