# Fix GD Extension Issue

## Problem
```
phpoffice/phpspreadsheet requires ext-gd * -> it is missing from your system
```

## Solution: Enable GD Extension

### Step 1: Open php.ini
You already have it open: `C:\php\php.ini`

### Step 2: Find the GD Extension Line

Search for this line (usually around line 900-950):
```ini
;extension=gd
```

OR

```ini
;extension=php_gd2.dll
```

OR 

```ini
;extension=gd2
```

### Step 3: Remove the Semicolon

Change FROM:
```ini
;extension=gd
```

TO:
```ini
extension=gd
```

### Step 4: Save the File

Save `C:\php\php.ini`

### Step 5: Restart Your Web Server

If using Apache, restart it. Or if using `php artisan serve`, stop it (Ctrl+C) and start again.

### Step 6: Verify GD is Loaded

Run this command:
```bash
php -m | findstr gd
```

You should see:
```
gd
```

### Step 7: Try Installing PHPSpreadsheet Again

```bash
composer update phpoffice/phpspreadsheet
```

---

## Alternative: Ignore GD Requirement (Temporary)

If you can't enable GD right now, you can temporarily ignore it:

```bash
composer update phpoffice/phpspreadsheet --ignore-platform-req=ext-gd
```

**Note:** This will install PHPSpreadsheet, but some image-related features won't work. For SF2 export (which is mostly text and formatting), this should be fine.

---

## Quick Steps (Copy-Paste)

1. Open `C:\php\php.ini` (you already have it open!)
2. Press `Ctrl+F` and search for `gd`
3. Find the line with `;extension=gd`
4. Remove the `;` at the beginning
5. Save the file
6. Run: `composer update phpoffice/phpspreadsheet --ignore-platform-req=ext-gd`

---

## Verification

After installation, verify:
```bash
composer show phpoffice/phpspreadsheet
```

You should see package information.
