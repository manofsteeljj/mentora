# School Form 2 (SF2) Attendance Implementation Plan

## Overview
This document outlines the plan to implement School Form 2 (SF2) Daily Attendance Report format for the Mentora LMS.

## SF2 Format Requirements (Based on mockup/format/SF2_2026_Grade 6 - RIZAL.xls)

### Header Information
- School Form 2 (SF2) Daily Attendance Report of Learners
- School ID
- School Year (e.g., 2026-2027)
- Report for the Month of [Month]
- Name of School
- Grade Level
- Section

### Student List Structure
- Row numbers
- Student names (Last Name, First Name, Middle Name)
- Gender sections (MALE | FEMALE)
- Daily attendance columns (M, T, W, TH, F)
- Total for the Month (ABSENT, PRESENT)
- REMARKS column

### Attendance Codes
- (blank) - Present
- (x) - Absent
- Tardy (half shaded - Upper for Late Commer, Lower for Cutting Classes)

### Monthly Summary Section
- Month name
- Number of Days of Classes
- Enrollment statistics
- Percentage calculations
- Drop-out tracking
- Transfer in/out tracking

### Guidelines Section (Right side)
- Codes for checking attendance
- Reasons/causes for NLS (Non-Learning Status)
- Various factors (Domestic, Individual, School, Geographic, Financial)

### Footer
- Adviser signature
- School Head attestation
- "Generated thru LIS" text

## Implementation Steps

### 1. Install PHPSpreadsheet
```bash
composer require phpoffice/phpspreadsheet
```

### 2. Database Modifications
- No schema changes needed
- Current attendance table supports the requirements

### 3. Create SF2 Export Service
- New service class: `app/Services/SF2ExportService.php`
- Handles Excel generation with exact formatting
- Supports month-based export

### 4. Add Export Controller Method
- Add `exportSF2` method to `AttendanceController`
- Parameters: course_id, month, year

### 5. Add Route
```php
Route::get('/api/attendance/export-sf2', [AttendanceController::class, 'exportSF2'])
    ->name('api.attendance.export-sf2');
```

### 6. Frontend Integration
- Add export button to attendance interface
- Month/year selector
- Download trigger

## Technical Specifications

### Export Parameters
- `course_id` (required): The course/section to export
- `month` (required): Month number (1-12)
- `year` (required): Year (e.g., 2026)
- `school_name` (optional): Override school name
- `school_id` (optional): Override school ID

### File Naming Convention
```
SF2_{YEAR}_{SECTION}_{MONTH}.xls
Example: SF2_2026_Grade 6 - RIZAL_January.xls
```

### Styling Requirements
- Exact font sizes and styles from template
- Merged cells for headers
- Borders and gridlines
- Cell alignment
- Page setup for printing (landscape, legal size)

## Next Steps
1. Install PHPSpreadsheet package
2. Create SF2ExportService
3. Implement export controller method
4. Add route
5. Test with sample data
6. Add frontend UI
