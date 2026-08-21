# Manual Installation Instructions for SF2 Export

## Issue
The `composer require phpoffice/phpspreadsheet` command is experiencing network timeouts.

## Solution Options

### Option 1: Manual Composer.json Edit (RECOMMENDED)

1. Open `composer.json` in your editor

2. Add this line to the "require" section:
```json
"phpoffice/phpspreadsheet": "^2.0"
```

The require section should look like this:
```json
{
    "require": {
        "php": "^8.2",
        "google/apiclient": "^2.19",
        "google/apiclient-services": "*",
        "laravel/breeze": "^2.3",
        "laravel/framework": "^12.0",
        "laravel/socialite": "^5.24",
        "laravel/tinker": "^2.10.1",
        "openai-php/client": "^0.19.0",
        "php-openapi/openapi": "^2.1",
        "phpoffice/phpspreadsheet": "^2.0",
        "smalot/pdfparser": "^2.12"
    }
}
```

3. Run composer update:
```bash
composer update phpoffice/phpspreadsheet
```

Or update all packages:
```bash
composer update
```

### Option 2: Retry with Better Network

Wait for better internet connectivity and try:
```bash
composer require phpoffice/phpspreadsheet --prefer-dist
```

### Option 3: Download Package Manually

1. Download PHPSpreadsheet from GitHub:
   https://github.com/PHPOffice/PhpSpreadsheet/releases

2. Extract to `vendor/phpoffice/phpspreadsheet/`

3. Run:
```bash
composer dump-autoload
```

### Option 4: Use Alternative Export Method

I can create a simpler CSV export that can be opened in Excel, which doesn't require PHPSpreadsheet. Let me know if you want this alternative.

---

## GD Extension Issue

The error also mentions missing GD extension. To fix:

### Windows (XAMPP/WAMP):

1. Open `php.ini` file (usually in `C:\xampp\php\php.ini`)

2. Find this line:
```ini
;extension=gd
```

3. Remove the semicolon:
```ini
extension=gd
```

4. Restart Apache/PHP

### Windows (Other PHP installations):

1. Find your php.ini file:
```bash
php --ini
```

2. Edit the file and enable GD:
```ini
extension=gd
```

3. Restart your web server

---

## After Installation

Once PHPSpreadsheet is installed:

1. Run the migration:
```bash
php artisan migrate
```

2. Update student gender data (if needed):
```sql
UPDATE students SET gender = 'male' WHERE id IN (...);
UPDATE students SET gender = 'female' WHERE id IN (...);
```

3. Test the export:
```bash
curl -X GET "http://localhost:8000/api/attendance/export-sf2?course_id=1&month=8&year=2026" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  --output test_sf2.xls
```

---

## Verification

To verify PHPSpreadsheet is installed:
```bash
composer show phpoffice/phpspreadsheet
```

You should see version information like:
```
name     : phpoffice/phpspreadsheet
descrip. : PHPSpreadsheet - Read, Create and Write Spreadsheet documents in PHP
...
```

---

## Need Help?

If you continue to experience issues, let me know and I can provide:
1. A simpler CSV-based export (no external dependencies)
2. A pure PHP .xls writer (basic implementation)
3. Step-by-step troubleshooting for your specific environment
