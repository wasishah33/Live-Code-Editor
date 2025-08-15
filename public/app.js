// Global variables
let editors = {};
let currentProject = null;
let currentUser = null;
let authToken = localStorage.getItem('authToken');
let isAuthenticated = false;
let saveTimeout = null;
let hasUnsavedChanges = false;
let autoRefreshEnabled = true;

// DOM elements
const loadingScreen = document.getElementById('loading-screen');
const app = document.getElementById('app');
const authModal = document.getElementById('auth-modal');
const projectModal = document.getElementById('project-modal');
const authForm = document.getElementById('auth-form');
const projectForm = document.getElementById('project-form');
const authTitle = document.getElementById('auth-title');
const authSwitchText = document.getElementById('auth-switch-text');
const authSwitchLink = document.getElementById('auth-switch-link');
const emailGroup = document.getElementById('email-group');
const currentProjectTitle = document.getElementById('current-project-title');
const saveStatus = document.getElementById('save-status');
const usernameDisplay = document.getElementById('username-display');
const userMenuBtn = document.getElementById('user-menu-btn');
const userDropdown = document.getElementById('user-dropdown');
const projectsSidebar = document.getElementById('projects-sidebar');
const projectsList = document.getElementById('projects-list');
const previewFrame = document.getElementById('preview-frame');
const runBtn = document.getElementById('run-btn');
const autoRefreshToggle = document.getElementById('auto-refresh-toggle');

// Initialize the application
async function init() {
    try {
        // Load Monaco Editor
        await loadMonacoEditor();
        
        // Check authentication
        if (authToken) {
            await checkAuth();
        }
        
        if (!isAuthenticated) {
            showAuthModal();
        } else {
            showApp();
            await loadProjects();
            createNewProject();
        }
        
        // Hide loading screen
        loadingScreen.style.display = 'none';
        
    } catch (error) {
        console.error('Initialization error:', error);
        alert('Failed to initialize the application. Please refresh the page.');
    }
}

// Load Monaco Editor
async function loadMonacoEditor() {
    return new Promise((resolve, reject) => {
        require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.44.0/min/vs' } });
        require(['vs/editor/editor.main'], function () {
            initializeEditors();
            resolve();
        });
    });
}

// Initialize Monaco editors
function initializeEditors() {
    const editorOptions = {
        theme: 'vs-dark',
        language: 'html',
        automaticLayout: true,
        minimap: { enabled: false },
        fontSize: 14,
        lineNumbers: 'on',
        roundedSelection: false,
        scrollBeyondLastLine: false,
        readOnly: false,
        cursorStyle: 'line',
        automaticLayout: true,
        wordWrap: 'on'
    };

    // HTML Editor
    editors.html = monaco.editor.create(document.getElementById('html-editor'), {
        ...editorOptions,
        language: 'html',
        value: getDefaultHTML()
    });

    // CSS Editor
    editors.css = monaco.editor.create(document.getElementById('css-editor'), {
        ...editorOptions,
        language: 'css',
        value: getDefaultCSS()
    });

    // JavaScript Editor
    editors.js = monaco.editor.create(document.getElementById('js-editor'), {
        ...editorOptions,
        language: 'javascript',
        value: getDefaultJS()
    });

    // PHP Editor
    editors.php = monaco.editor.create(document.getElementById('php-editor'), {
        ...editorOptions,
        language: 'php',
        value: getDefaultPHP()
    });

    // Set up change listeners
    Object.values(editors).forEach(editor => {
        editor.onDidChangeModelContent(() => {
            if (autoRefreshEnabled) {
                updatePreview();
            }
            markAsUnsaved();
            
            // Auto-save functionality
            if (saveTimeout) {
                clearTimeout(saveTimeout);
            }
            
            saveTimeout = setTimeout(() => {
                if (currentProject && hasUnsavedChanges) {
                    saveProject();
                }
            }, 2000); // Auto-save after 2 seconds of inactivity
        });
    });
}

// Default code templates
function getDefaultHTML() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Project</title>
</head>
<body>
    <h1>Hello World!</h1>
    <p>Welcome to CodingApp. Start building something amazing!</p>
</body>
</html>`;
}

function getDefaultCSS() {
    return `body {
    font-family: Arial, sans-serif;
    margin: 0;
    padding: 20px;
    background-color: #f0f0f0;
}

h1 {
    color: #333;
    text-align: center;
}

p {
    color: #666;
    text-align: center;
    font-size: 18px;
}`;
}

function getDefaultJS() {
    return `// Your JavaScript code here
console.log('Hello from CodingApp!');

// Example: Add some interactivity
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded successfully!');
});`;
}

function getDefaultPHP() {
    return `<?php
// Your PHP code here
echo "Hello from PHP!";

// Example: Basic PHP functionality
$name = "CodingApp";
$version = "1.0.0";

echo "<h2>Welcome to " . $name . " v" . $version . "</h2>";

// Example: Working with arrays
$colors = ["red", "green", "blue"];
echo "<ul>";
foreach ($colors as $color) {
    echo "<li style='color: " . $color . ";'>" . ucfirst($color) . "</li>";
}
echo "</ul>";

// Example: Date and time
echo "<p>Current time: " . date('Y-m-d H:i:s') . "</p>";
?>`;
}

// Authentication functions
async function checkAuth() {
    try {
        const response = await fetch('/api/projects', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (response.ok) {
            isAuthenticated = true;
            const userData = JSON.parse(localStorage.getItem('userData'));
            currentUser = userData;
            usernameDisplay.textContent = userData.username;
        } else {
            throw new Error('Invalid token');
        }
    } catch (error) {
        console.error('Auth check failed:', error);
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
        isAuthenticated = false;
    }
}

function showAuthModal() {
    authModal.style.display = 'block';
    setAuthMode('login');
}

function closeAuthModal() {
    authModal.style.display = 'none';
}

function setAuthMode(mode) {
    const isLogin = mode === 'login';
    authTitle.textContent = isLogin ? 'Login' : 'Register';
    authSwitchText.textContent = isLogin ? "Don't have an account?" : 'Already have an account?';
    authSwitchLink.textContent = isLogin ? 'Register' : 'Login';
    emailGroup.style.display = isLogin ? 'none' : 'block';
    
    // Update form action
    authForm.onsubmit = isLogin ? handleLogin : handleRegister;
}

// Event listeners for auth
authSwitchLink.addEventListener('click', (e) => {
    e.preventDefault();
    setAuthMode(authTitle.textContent === 'Login' ? 'register' : 'login');
});

async function handleLogin(e) {
    e.preventDefault();
    const formData = new FormData(authForm);
    const data = {
        username: formData.get('username'),
        password: formData.get('password')
    };

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();
        
        if (response.ok) {
            authToken = result.token;
            currentUser = result.user;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('userData', JSON.stringify(result.user));
            isAuthenticated = true;
            usernameDisplay.textContent = result.user.username;
            closeAuthModal();
            showApp();
            await loadProjects();
            createNewProject();
        } else {
            alert(result.error);
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Login failed. Please try again.');
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const formData = new FormData(authForm);
    const data = {
        username: formData.get('username'),
        email: formData.get('email'),
        password: formData.get('password')
    };

    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        const result = await response.json();
        
        if (response.ok) {
            authToken = result.token;
            currentUser = result.user;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('userData', JSON.stringify(result.user));
            isAuthenticated = true;
            usernameDisplay.textContent = result.user.username;
            closeAuthModal();
            showApp();
            await loadProjects();
            createNewProject();
        } else {
            alert(result.error);
        }
    } catch (error) {
        console.error('Registration error:', error);
        alert('Registration failed. Please try again.');
    }
}

// App display functions
function showApp() {
    app.style.display = 'flex';
}

// Project management
async function loadProjects() {
    try {
        const response = await fetch('/api/projects', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const projects = await response.json();
            displayProjects(projects);
        }
    } catch (error) {
        console.error('Failed to load projects:', error);
    }
}

function displayProjects(projects) {
    projectsList.innerHTML = '';
    
    projects.forEach(project => {
        const projectElement = document.createElement('div');
        projectElement.className = 'project-item';
        projectElement.innerHTML = `
            <h4>${project.title}</h4>
            <p>Updated: ${new Date(project.updated_at).toLocaleDateString()}</p>
        `;
        projectElement.addEventListener('click', () => loadProject(project.id));
        projectsList.appendChild(projectElement);
    });
}

async function loadProject(projectId) {
    try {
        const response = await fetch(`/api/projects/${projectId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const project = await response.json();
            currentProject = project;
            currentProjectTitle.textContent = project.title;
            
            editors.html.setValue(project.html || getDefaultHTML());
            editors.css.setValue(project.css || getDefaultCSS());
            editors.js.setValue(project.js || getDefaultJS());
            editors.php.setValue(project.php || getDefaultPHP());
            
            updatePreview();
            markAsSaved();
            
            // Update active project in sidebar
            document.querySelectorAll('.project-item').forEach(item => {
                item.classList.remove('active');
            });
            event.target.closest('.project-item').classList.add('active');
        }
    } catch (error) {
        console.error('Failed to load project:', error);
        alert('Failed to load project.');
    }
}

async function createNewProject() {
    currentProject = null;
    currentProjectTitle.textContent = 'Untitled Project';
    
    editors.html.setValue(getDefaultHTML());
    editors.css.setValue(getDefaultCSS());
    editors.js.setValue(getDefaultJS());
    editors.php.setValue(getDefaultPHP());
    
    updatePreview();
    markAsSaved();
}

async function saveProject() {
    if (!currentProject) {
        showProjectModal();
        return;
    }

    try {
        const projectData = {
            title: currentProject.title,
            html: editors.html.getValue(),
            css: editors.css.getValue(),
            js: editors.js.getValue(),
            php: editors.php.getValue()
        };

        const response = await fetch(`/api/projects/${currentProject.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(projectData)
        });

        if (response.ok) {
            markAsSaved();
            await loadProjects(); // Refresh project list
        } else {
            alert('Failed to save project.');
        }
    } catch (error) {
        console.error('Save error:', error);
        alert('Failed to save project.');
    }
}

async function saveNewProject(title) {
    try {
        const projectData = {
            title: title,
            html: editors.html.getValue(),
            css: editors.css.getValue(),
            js: editors.js.getValue(),
            php: editors.php.getValue()
        };

        const response = await fetch('/api/projects', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(projectData)
        });

        if (response.ok) {
            const newProject = await response.json();
            currentProject = newProject;
            currentProjectTitle.textContent = newProject.title;
            markAsSaved();
            await loadProjects();
            closeProjectModal();
        } else {
            alert('Failed to create project.');
        }
    } catch (error) {
        console.error('Create project error:', error);
        alert('Failed to create project.');
    }
}

// Preview functions
async function updatePreview() {
    const html = editors.html.getValue();
    const css = editors.css.getValue();
    const js = editors.js.getValue();
    const php = editors.php.getValue();

    // Check if PHP code is present
    if (php && php.trim() !== '' && php.includes('<?php')) {
        // Execute PHP code on server
        await executePHP(html, css, js, php);
    } else {
        // Regular HTML preview
        const fullHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Preview</title>
    <style>${css}</style>
</head>
<body>
    ${html}
    <script>${js}</script>
</body>
</html>`;

        const blob = new Blob([fullHTML], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        previewFrame.src = url;
    }
}

// Execute PHP code on server
async function executePHP(html, css, js, php) {
    try {
        const response = await fetch('/api/execute-php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                html: html,
                css: css,
                js: js,
                php: php
            })
        });

        if (response.ok) {
            const result = await response.text();
            const blob = new Blob([result], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            previewFrame.src = url;
        } else {
            const error = await response.text();
            console.error('PHP execution error:', error);
            // Show error in preview
            const errorHTML = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>PHP Error</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
        .error { background: #ffebee; border: 1px solid #f44336; padding: 15px; border-radius: 4px; color: #c62828; }
        pre { background: #fafafa; padding: 10px; border-radius: 4px; overflow-x: auto; }
    </style>
</head>
<body>
    <h2>PHP Execution Error</h2>
    <div class="error">
        <pre>${error}</pre>
    </div>
</body>
</html>`;
            const blob = new Blob([errorHTML], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            previewFrame.src = url;
        }
    } catch (error) {
        console.error('PHP execution failed:', error);
        // Show error in preview
        const errorHTML = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>PHP Error</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
        .error { background: #ffebee; border: 1px solid #f44336; padding: 15px; border-radius: 4px; color: #c62828; }
    </style>
</head>
<body>
    <h2>PHP Execution Failed</h2>
    <div class="error">
        <p>Failed to execute PHP code. Please check your syntax and try again.</p>
        <p>Error: ${error.message}</p>
    </div>
</body>
</html>`;
        const blob = new Blob([errorHTML], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        previewFrame.src = url;
    }
}

// Save status management
function markAsUnsaved() {
    hasUnsavedChanges = true;
    saveStatus.textContent = 'Unsaved';
    saveStatus.className = 'save-status unsaved';
}

function markAsSaved() {
    hasUnsavedChanges = false;
    saveStatus.textContent = 'Saved';
    saveStatus.className = 'save-status';
}

// Export function
async function exportProject() {
    if (!currentProject) {
        alert('No project to export.');
        return;
    }

    try {
        const response = await fetch(`/api/projects/${currentProject.id}/export`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${currentProject.title}.html`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } else {
            alert('Failed to export project.');
        }
    } catch (error) {
        console.error('Export error:', error);
        alert('Failed to export project.');
    }
}

// Modal functions
function showProjectModal() {
    projectModal.style.display = 'block';
}

function closeProjectModal() {
    projectModal.style.display = 'none';
    document.getElementById('project-title').value = '';
}

// Event listeners
document.addEventListener('DOMContentLoaded', init);

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Update editors
        document.querySelectorAll('.editor').forEach(editor => editor.classList.remove('active'));
        document.getElementById(`${tab}-editor`).classList.add('active');
        
        // Update editor language
        const editor = editors[tab];
        if (editor) {
            const language = tab === 'html' ? 'html' : tab === 'css' ? 'css' : 'javascript';
            monaco.editor.setModelLanguage(editor.getModel(), language);
        }
    });
});

// Form submissions
projectForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('project-title').value.trim();
    if (title) {
        saveNewProject(title);
    }
});

// Button event listeners
document.getElementById('new-project-btn').addEventListener('click', createNewProject);
document.getElementById('save-btn').addEventListener('click', saveProject);
document.getElementById('export-btn').addEventListener('click', exportProject);

// User menu
userMenuBtn.addEventListener('click', () => {
    userDropdown.classList.toggle('show');
});

document.getElementById('projects-link').addEventListener('click', (e) => {
    e.preventDefault();
    toggleProjectsSidebar();
    userDropdown.classList.remove('show');
});

document.getElementById('logout-link').addEventListener('click', (e) => {
    e.preventDefault();
    logout();
    userDropdown.classList.remove('show');
});

// Sidebar toggle
function toggleProjectsSidebar() {
    projectsSidebar.classList.toggle('show');
}

// Logout function
function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('userData');
    authToken = null;
    currentUser = null;
    isAuthenticated = false;
    currentProject = null;
    
    app.style.display = 'none';
    showAuthModal();
}

// Preview controls
document.getElementById('refresh-preview').addEventListener('click', updatePreview);
document.getElementById('fullscreen-preview').addEventListener('click', () => {
    previewFrame.requestFullscreen();
});

// Run button
runBtn.addEventListener('click', updatePreview);

// Auto-refresh toggle
autoRefreshToggle.addEventListener('change', (e) => {
    autoRefreshEnabled = e.target.checked;
    console.log('Auto-refresh:', autoRefreshEnabled ? 'enabled' : 'disabled');
});

// Close dropdowns when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.user-menu')) {
        userDropdown.classList.remove('show');
    }
});



// Handle beforeunload to warn about unsaved changes
window.addEventListener('beforeunload', (e) => {
    if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
    }
});
