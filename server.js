const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Database setup
const db = new sqlite3.Database('codingapp.db');

// Initialize database tables
db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Projects table
  db.run(`CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    title TEXT NOT NULL,
    html TEXT DEFAULT '',
    css TEXT DEFAULT '',
    js TEXT DEFAULT '',
    php TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
  )`);

  // Create projects directory if it doesn't exist
  if (!fs.existsSync('projects')) {
    fs.mkdirSync('projects');
  }
});

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Routes

// Register user
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    db.run(
      'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
      [username, email, hashedPassword],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Username or email already exists' });
          }
          return res.status(500).json({ error: 'Database error' });
        }
        
        const token = jwt.sign({ id: this.lastID, username }, JWT_SECRET);
        res.json({ token, user: { id: this.lastID, username, email } });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Login user
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
    res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
  });
});

// Get user projects
app.get('/api/projects', authenticateToken, (req, res) => {
  db.all(
    'SELECT id, title, created_at, updated_at FROM projects WHERE user_id = ? ORDER BY updated_at DESC',
    [req.user.id],
    (err, projects) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(projects);
    }
  );
});

// Get single project
app.get('/api/projects/:id', authenticateToken, (req, res) => {
  db.get(
    'SELECT * FROM projects WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.id],
    (err, project) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      res.json(project);
    }
  );
});

// Create new project
app.post('/api/projects', authenticateToken, (req, res) => {
  const { title, html, css, js, php } = req.body;
  
  if (!title) {
    return res.status(400).json({ error: 'Project title is required' });
  }

  db.run(
    'INSERT INTO projects (user_id, title, html, css, js, php) VALUES (?, ?, ?, ?, ?, ?)',
    [req.user.id, title, html || '', css || '', js || '', php || ''],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ id: this.lastID, title, html, css, js, php });
    }
  );
});

// Update project
app.put('/api/projects/:id', authenticateToken, (req, res) => {
  const { title, html, css, js, php } = req.body;
  const projectId = req.params.id;

  db.run(
    'UPDATE projects SET title = ?, html = ?, css = ?, js = ?, php = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
    [title, html, css, js, php, projectId, req.user.id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }
      res.json({ id: projectId, title, html, css, js, php });
    }
  );
});

// Delete project
app.delete('/api/projects/:id', authenticateToken, (req, res) => {
  db.run(
    'DELETE FROM projects WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }
      res.json({ message: 'Project deleted successfully' });
    }
  );
});

// Execute PHP code
app.post('/api/execute-php', authenticateToken, (req, res) => {
  const { html, css, js, php } = req.body;
  
  // Create a temporary PHP file
  const tempDir = path.join(__dirname, 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }
  
  const tempFile = path.join(tempDir, `temp_${Date.now()}.php`);
  
  // Create the complete PHP file with HTML, CSS, JS, and PHP
  const phpContent = `<?php
// PHP code execution
${php || ''}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PHP Preview</title>
    <style>
${css || ''}
    </style>
</head>
<body>
${html || ''}
    <script>
${js || ''}
    </script>
</body>
</html>`;

  try {
    fs.writeFileSync(tempFile, phpContent);
    
    // Debug: Log the PHP content for troubleshooting
    console.log('Generated PHP file content:');
    console.log(phpContent);
    
    // Execute PHP file
    const { exec } = require('child_process');
    exec(`php "${tempFile}"`, { timeout: 10000 }, (error, stdout, stderr) => {
      // Clean up temp file
      try {
        fs.unlinkSync(tempFile);
      } catch (cleanupError) {
        console.error('Failed to cleanup temp file:', cleanupError);
      }
      
      if (error) {
        console.error('PHP execution error:', error);
        console.error('PHP stdout:', stdout);
        console.error('PHP stderr:', stderr);
        return res.status(500).send(`PHP Execution Error: ${error.message}\n\nOutput: ${stdout}\n\nErrors: ${stderr}`);
      }
      
      if (stderr && stderr.trim() !== '') {
        console.error('PHP stderr:', stderr);
        // Only treat as error if stderr contains actual errors (not just warnings)
        if (stderr.includes('Parse error') || stderr.includes('Fatal error') || stderr.includes('Warning:')) {
          return res.status(500).send(`PHP Error: ${stderr}\n\nOutput: ${stdout}`);
        }
      }
      
      res.setHeader('Content-Type', 'text/html');
      res.send(stdout);
    });
  } catch (error) {
    // Clean up temp file if it exists
    try {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    } catch (cleanupError) {
      console.error('Failed to cleanup temp file:', cleanupError);
    }
    
    console.error('File write error:', error);
    res.status(500).send(`File Error: ${error.message}`);
  }
});

// Export project as ZIP
app.get('/api/projects/:id/export', authenticateToken, (req, res) => {
  db.get(
    'SELECT * FROM projects WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.id],
    (err, project) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Create HTML file content
      const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${project.title}</title>
    <style>
${project.css}
    </style>
</head>
<body>
${project.html}
    <script>
${project.js}
    </script>
</body>
</html>`;

      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Disposition', `attachment; filename="${project.title}.html"`);
      res.send(htmlContent);
    }
  );
});

// Serve the main application
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`CodingApp server running on http://localhost:${PORT}`);
});
