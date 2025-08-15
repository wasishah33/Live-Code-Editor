# Projects Folder

This folder is used to store user project files created through the CodingApp.

## Purpose

- **User Projects**: Contains HTML, CSS, JavaScript, and PHP files created by users
- **Project Organization**: Helps organize and manage user-created content
- **Backup Storage**: Provides a backup location for user projects

## Structure

The folder structure will be created automatically when users save projects:

```
projects/
├── user1/
│   ├── project1/
│   │   ├── index.html
│   │   ├── styles.css
│   │   ├── script.js
│   │   └── script.php
│   └── project2/
│       └── ...
└── user2/
    └── ...
```

## PHP Examples

Here are some examples of what you can do with PHP in CodingApp:

### Basic PHP Output
```php
<?php
echo "Hello from PHP!";
echo "<h2>Welcome to CodingApp</h2>";
?>
```

### Working with Variables
```php
<?php
$name = "CodingApp";
$version = "1.0.0";
echo "<h2>Welcome to " . $name . " v" . $version . "</h2>";
?>
```

### Arrays and Loops
```php
<?php
$colors = ["red", "green", "blue"];
echo "<ul>";
foreach ($colors as $color) {
    echo "<li style='color: " . $color . ";'>" . ucfirst($color) . "</li>";
}
echo "</ul>";
?>
```

### Date and Time
```php
<?php
echo "<p>Current time: " . date('Y-m-d H:i:s') . "</p>";
echo "<p>Day of week: " . date('l') . "</p>";
?>
```

### Form Processing
```php
<?php
if ($_POST) {
    $name = $_POST['name'] ?? 'Anonymous';
    echo "<h3>Hello, " . htmlspecialchars($name) . "!</h3>";
}
?>
<form method="post">
    <input type="text" name="name" placeholder="Enter your name">
    <button type="submit">Submit</button>
</form>
```

## Notes

- This folder is tracked by Git to ensure the directory structure exists
- The `.gitkeep` file ensures the folder is included in version control
- User project files will be stored here when the application is running
- PHP code is executed server-side and the output is displayed in the preview
