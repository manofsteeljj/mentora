# SF2 Export - Quick Reference Card

## 🚀 Quick Start

### Export via Browser (Logged in):
```
http://localhost:8000/api/attendance/export-sf2?course_id=1&month=8&year=2026
```

### Export via JavaScript:
```javascript
window.location.href = `/api/attendance/export-sf2?course_id=1&month=8&year=2026`;
```

---

## 📋 API Parameters

| Parameter | Required | Type | Example |
|-----------|----------|------|---------|
| `course_id` | ✅ Yes | integer | `1` |
| `month` | ✅ Yes | integer (1-12) | `8` |
| `year` | ✅ Yes | integer | `2026` |
| `school_name` | ❌ No | string | `"ABC School"` |
| `school_id` | ❌ No | string | `"123456"` |
| `grade_level` | ❌ No | string | `"Grade 7"` |
| `adviser_name` | ❌ No | string | `"JUAN CRUZ"` |
| `school_head` | ❌ No | string | `"MARIA SANTOS"` |

---

## 💻 Code Examples

### React Component:
```jsx
function ExportButton({ courseId }) {
    const handleExport = async () => {
        const response = await fetch(
            `/api/attendance/export-sf2?course_id=${courseId}&month=8&year=2026`
        );
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'SF2.xls';
        a.click();
    };
    
    return <button onClick={handleExport}>Export SF2</button>;
}
```

### Plain HTML:
```html
<a href="/api/attendance/export-sf2?course_id=1&month=8&year=2026" 
   class="btn btn-primary" download>
    📥 Export SF2 Report
</a>
```

---

## 🔧 Maintenance Commands

### Update Student Gender:
```sql
UPDATE students SET gender = 'female' WHERE id IN (2,4,6);
```

### Create Test Attendance:
```bash
php create_sample_attendance.php
```

### Test Export:
```bash
php test_sf2_export.php
```

### Verify Installation:
```bash
composer show phpoffice/phpspreadsheet
```

---

## 📊 Database

### Students Table:
- Added field: `gender` enum('male', 'female')

### Attendance Table:
- Status values: `present`, `absent`, `late`, `excused`
- SF2 Display: (blank), x, ▴, (blank)

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| `app/Services/SF2ExportService.php` | Main generator |
| `app/Http/Controllers/AttendanceController.php` | API endpoint |
| `routes/web.php` | Route definition |
| `SF2_Test_Export.xls` | Generated test file |

---

## ✅ Features

- ✅ Gender-separated sections (Male/Female)
- ✅ Weekend auto-detection
- ✅ Print-ready format (Landscape, Legal)
- ✅ Exact DepEd format compliance
- ✅ Customizable school info
- ✅ Auto-calculates totals

---

## 🐛 Troubleshooting

### "Class not found" error:
```bash
composer dump-autoload
```

### No students appear:
```sql
UPDATE students SET gender = 'male';
```

### Export fails:
Check: PHPSpreadsheet installed, migration ran, students have course_id

---

## 📖 Full Documentation

- **Complete Guide:** `SF2_ATTENDANCE_README.md`
- **Setup Instructions:** `ATTENDANCE_SF2_SETUP.md`
- **Success Report:** `SUCCESS_DEPLOYMENT_COMPLETE.md`

---

## 🎯 Status

✅ **DEPLOYED & TESTED**

Test file: `C:\Users\miri\Documents\mentora\SF2_Test_Export.xls`

**Open to verify format!**
