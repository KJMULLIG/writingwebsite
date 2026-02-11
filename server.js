const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const app = express();
const PORT = 3000;

// Middleware to parse JSON
app.use(express.json());

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const archiveDir = path.join(__dirname, 'archive');
        if (!fs.existsSync(archiveDir)) {
            fs.mkdirSync(archiveDir);
        }
        cb(null, archiveDir);
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});

const chapterStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        const chaptersDir = path.join(__dirname, 'chapters');
        if (!fs.existsSync(chaptersDir)) {
            fs.mkdirSync(chaptersDir);
        }
        cb(null, chaptersDir);
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    fileFilter: function (req, file, cb) {
        if (path.extname(file.originalname) !== '.txt') {
            return cb(new Error('Only .txt files are allowed!'));
        }
        cb(null, true);
    }
});

const uploadChapter = multer({ 
    storage: chapterStorage,
    fileFilter: function (req, file, cb) {
        if (path.extname(file.originalname) !== '.txt') {
            return cb(new Error('Only .txt files are allowed!'));
        }
        // Validate filename is a number
        const filename = path.basename(file.originalname, '.txt');
        if (!/^\d+$/.test(filename)) {
            return cb(new Error('Chapter filename must be a number (e.g., 1.txt, 2.txt)'));
        }
        cb(null, true);
    }
});

// Create 'chapters' folder if it doesn't exist
const chaptersDir = path.join(__dirname, 'chapters');
if (!fs.existsSync(chaptersDir)) {
    fs.mkdirSync(chaptersDir);
}

// Create 'archive' folder if it doesn't exist
const archiveDir = path.join(__dirname, 'archive');
if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir);
}

const usersFilePath = path.join(__dirname, 'users.json');

// Load users data
function loadUsersData() {
    try {
        const data = fs.readFileSync(usersFilePath, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Error loading users:', err);
        return { users: [], turnOrder: [], currentTurnIndex: 0, storyComplete: false, signupEnabled: true };
    }
}

// Save users data
function saveUsersData(data) {
    try {
        fs.writeFileSync(usersFilePath, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Error saving users:', err);
    }
}

// Verify username and password
function verifyUser(username, password) {
    const usersData = loadUsersData();
    return usersData.users.find(user => user.username === username && user.password === password);
}

// Check if it's user's turn
function isUserTurn(username) {
    const usersData = loadUsersData();
    if (usersData.turnOrder.length === 0) {
        return true; // If no turn order, anyone can submit
    }
    return usersData.turnOrder[usersData.currentTurnIndex] === username;
}

// Generate new turn order, excluding a specific user from going first
function generateTurnOrder(excludeFirst = null) {
    const usersData = loadUsersData();
    
    // Get all usernames
    let usernames = usersData.users.map(user => user.username);
    
    // Shuffle using Fisher-Yates algorithm
    for (let i = usernames.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [usernames[i], usernames[j]] = [usernames[j], usernames[i]];
    }
    
    // If we need to exclude someone from going first, ensure they're not first
    if (excludeFirst && usernames[0] === excludeFirst && usernames.length > 1) {
        // Swap the first person with someone else
        const swapIndex = Math.floor(Math.random() * (usernames.length - 1)) + 1;
        [usernames[0], usernames[swapIndex]] = [usernames[swapIndex], usernames[0]];
    }
    
    return usernames;
}

// Advance to next turn (or regenerate if at end)
function advanceTurn() {
    const usersData = loadUsersData();
    if (usersData.turnOrder.length === 0) {
        return;
    }
    
    const currentUser = usersData.turnOrder[usersData.currentTurnIndex];
    const nextIndex = usersData.currentTurnIndex + 1;
    
    // Check if we've reached the end of the turn order
    if (nextIndex >= usersData.turnOrder.length) {
        // Regenerate turn order, excluding the last person who just went
        usersData.turnOrder = generateTurnOrder(currentUser);
        usersData.currentTurnIndex = 0;
        console.log('Turn order completed. New order generated:', usersData.turnOrder);
    } else {
        // Just move to next person
        usersData.currentTurnIndex = nextIndex;
    }
    
    saveUsersData(usersData);
}

// Mark story as complete
function completeStory() {
    const usersData = loadUsersData();
    usersData.storyComplete = true;
    saveUsersData(usersData);
    console.log('Story marked as complete');
}

// Serve your HTML files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/submit.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'submit.html'));
});

app.get('/admin.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get('/archive.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'archive.html'));
});

app.get('/signup.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'signup.html'));
});

app.get('/information.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'information.html'));
});

app.get('/style.css', (req, res) => {
    res.sendFile(path.join(__dirname, 'style.css'));
});

app.get('/nav.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'nav.js'));
});

// Admin: Generate random turn order
app.post('/admin/generate-turns', (req, res) => {
    const usersData = loadUsersData();
    
    const turnOrder = generateTurnOrder();
    
    usersData.turnOrder = turnOrder;
    usersData.currentTurnIndex = 0;
    saveUsersData(usersData);
    
    res.json({ message: 'Turn order randomized successfully!', turnOrder: turnOrder });
});

// Admin: Manually update turn order
app.post('/admin/update-turn-order', (req, res) => {
    const turnOrder = req.body.turnOrder;
    const currentTurnIndex = req.body.currentTurnIndex;
    
    if (!Array.isArray(turnOrder) || turnOrder.length === 0) {
        return res.status(400).json({ error: 'Turn order must be a non-empty array!' });
    }
    
    if (typeof currentTurnIndex !== 'number' || currentTurnIndex < 0 || currentTurnIndex >= turnOrder.length) {
        return res.status(400).json({ error: 'Invalid turn index!' });
    }
    
    const usersData = loadUsersData();
    
    // Optional: Validate that all usernames in turn order exist
    const validUsernames = usersData.users.map(user => user.username);
    const invalidUsers = turnOrder.filter(username => !validUsernames.includes(username));
    
    if (invalidUsers.length > 0) {
        return res.status(400).json({ error: 'Unknown users in turn order: ' + invalidUsers.join(', ') });
    }
    
    usersData.turnOrder = turnOrder;
    usersData.currentTurnIndex = currentTurnIndex;
    saveUsersData(usersData);
    
    res.json({ message: 'Turn order updated successfully!' });
});

// Admin: Reopen story for new submissions
app.post('/admin/reopen-story', (req, res) => {
    const usersData = loadUsersData();
    usersData.storyComplete = false;
    saveUsersData(usersData);
    
    res.json({ message: 'Story reopened for new submissions!' });
});

// Admin: Close story submissions
app.post('/admin/close-story', (req, res) => {
    const usersData = loadUsersData();
    usersData.storyComplete = true;
    saveUsersData(usersData);
    
    res.json({ message: 'Story submissions closed!' });
});

// Admin: Get current turn order
app.get('/admin/turn-order', (req, res) => {
    const usersData = loadUsersData();
    res.json({
        turnOrder: usersData.turnOrder,
        currentTurnIndex: usersData.currentTurnIndex,
        storyComplete: usersData.storyComplete
    });
});

// Admin: Get list of users
app.get('/admin/users', (req, res) => {
    const usersData = loadUsersData();
    res.json({ users: usersData.users });
});

// Admin: Add new user
app.post('/admin/add-user', (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required!' });
    }
    
    // Validate username format
    if (username !== username.toLowerCase() || username.includes(' ')) {
        return res.status(400).json({ error: 'Username must be lowercase with no spaces!' });
    }
    
    const usersData = loadUsersData();
    
    // Check if username already exists
    if (usersData.users.find(user => user.username === username)) {
        return res.status(400).json({ error: 'Username already exists!' });
    }
    
    // Add new user
    usersData.users.push({ username: username, password: password });
    saveUsersData(usersData);
    
    res.json({ message: 'User "' + username + '" added successfully!' });
});

// Admin: Delete user
app.delete('/admin/delete-user/:username', (req, res) => {
    const username = req.params.username;
    const usersData = loadUsersData();
    
    // Find user index
    const userIndex = usersData.users.findIndex(user => user.username === username);
    
    if (userIndex === -1) {
        return res.status(404).json({ error: 'User not found!' });
    }
    
    // Remove user from users array
    usersData.users.splice(userIndex, 1);
    
    // Remove user from turnOrder if present
    const turnOrderIndex = usersData.turnOrder.indexOf(username);
    if (turnOrderIndex !== -1) {
        usersData.turnOrder.splice(turnOrderIndex, 1);
        
        // Adjust currentTurnIndex if needed
        if (usersData.currentTurnIndex >= usersData.turnOrder.length && usersData.turnOrder.length > 0) {
            usersData.currentTurnIndex = 0;
        }
    }
    
    saveUsersData(usersData);
    
    res.json({ message: 'User "' + username + '" deleted successfully!' });
});

// Public: User signup
app.post('/signup', (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    
    const usersData = loadUsersData();
    
    // Check if signups are enabled
    if (usersData.signupEnabled === false) {
        return res.status(403).json({ error: 'User signups are currently disabled. Please contact the administrator.' });
    }
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }
    
    // Validate username format
    if (username !== username.toLowerCase() || username.includes(' ')) {
        return res.status(400).json({ error: 'Username must be lowercase with no spaces.' });
    }
    
    // Validate password length
    if (password.length < 4) {
        return res.status(400).json({ error: 'Password must be at least 4 characters long.' });
    }
    
    // Check if username already exists
    if (usersData.users.find(user => user.username === username)) {
        return res.status(400).json({ error: 'Username already taken. Please choose a different username.' });
    }
    
    // Add the new user
    usersData.users.push({ username: username, password: password });
    saveUsersData(usersData);
    
    res.json({ message: 'Account created successfully.' });
});

// Admin: Get signup status
app.get('/admin/signup-status', (req, res) => {
    const usersData = loadUsersData();
    // Default to true if not set
    const signupEnabled = usersData.signupEnabled !== undefined ? usersData.signupEnabled : true;
    res.json({ signupEnabled: signupEnabled });
});

// Admin: Enable signups
app.post('/admin/enable-signup', (req, res) => {
    const usersData = loadUsersData();
    usersData.signupEnabled = true;
    saveUsersData(usersData);
    res.json({ message: 'User signups enabled.' });
});

// Admin: Disable signups
app.post('/admin/disable-signup', (req, res) => {
    const usersData = loadUsersData();
    usersData.signupEnabled = false;
    saveUsersData(usersData);
    res.json({ message: 'User signups disabled.' });
});

// Admin: Delete individual chapter
app.delete('/admin/delete-chapter/:number', (req, res) => {
    const chapterNumber = req.params.number;
    const filepath = path.join(chaptersDir, `${chapterNumber}.txt`);
    
    // Check if file exists
    if (!fs.existsSync(filepath)) {
        return res.status(404).json({ error: 'Chapter not found!' });
    }
    
    try {
        fs.unlinkSync(filepath);
        res.json({ message: 'Chapter ' + chapterNumber + ' deleted successfully!' });
    } catch (err) {
        console.error('Error deleting chapter:', err);
        res.status(500).json({ error: 'Error deleting chapter!' });
    }
});

// Admin: Delete all chapters
app.delete('/admin/delete-all-chapters', (req, res) => {
    try {
        const files = fs.readdirSync(chaptersDir);
        const chapterFiles = files.filter(file => /^\d+\.txt$/.test(file));
        
        if (chapterFiles.length === 0) {
            return res.json({ message: 'No chapters to delete.' });
        }
        
        let deletedCount = 0;
        chapterFiles.forEach(file => {
            const filepath = path.join(chaptersDir, file);
            fs.unlinkSync(filepath);
            deletedCount++;
        });
        
        res.json({ message: 'Successfully deleted ' + deletedCount + ' chapter(s)!' });
    } catch (err) {
        console.error('Error deleting all chapters:', err);
        res.status(500).json({ error: 'Error deleting chapters!' });
    }
});

// Admin: Upload file to archive
app.post('/admin/upload-archive', upload.single('archiveFile'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded!' });
    }
    
    res.json({ 
        message: 'File "' + req.file.originalname + '" uploaded successfully to archive!',
        filename: req.file.originalname
    });
});

// Admin: Upload chapter
app.post('/admin/upload-chapter', uploadChapter.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded!' });
    }
    
    res.json({ 
        message: 'Chapter "' + req.file.originalname + '" uploaded successfully!',
        filename: req.file.originalname
    });
});

// Admin: Get list of archive files
app.get('/admin/archive-files', (req, res) => {
    try {
        const archiveDir = path.join(__dirname, 'archive');
        
        // Check if archive directory exists
        if (!fs.existsSync(archiveDir)) {
            return res.json({ files: [] });
        }
        
        const files = fs.readdirSync(archiveDir);
        const txtFiles = files.filter(file => file.endsWith('.txt'));
        
        res.json({ files: txtFiles });
    } catch (err) {
        console.error('Error reading archive directory:', err);
        res.status(500).json({ error: 'Error reading archive files!' });
    }
});

// Admin: Download archive file
app.get('/admin/archive-download/:filename', (req, res) => {
    const filename = req.params.filename;
    const filepath = path.join(__dirname, 'archive', filename);
    
    // Security check: make sure the file is in the archive directory
    if (!filepath.startsWith(path.join(__dirname, 'archive'))) {
        return res.status(403).send('Access denied!');
    }
    
    // Check if file exists
    if (!fs.existsSync(filepath)) {
        return res.status(404).send('File not found!');
    }
    
    res.download(filepath);
});

// Admin: Delete archive file
app.delete('/admin/archive-delete/:filename', (req, res) => {
    const filename = req.params.filename;
    const filepath = path.join(__dirname, 'archive', filename);
    
    // Security check: make sure the file is in the archive directory
    if (!filepath.startsWith(path.join(__dirname, 'archive'))) {
        return res.status(403).json({ error: 'Access denied!' });
    }
    
    // Check if file exists
    if (!fs.existsSync(filepath)) {
        return res.status(404).json({ error: 'File not found!' });
    }
    
    try {
        fs.unlinkSync(filepath);
        res.json({ message: 'File "' + filename + '" deleted successfully!' });
    } catch (err) {
        console.error('Error deleting file:', err);
        res.status(500).json({ error: 'Error deleting file!' });
    }
});

// Public: Get list of archive stories
app.get('/archive/stories', (req, res) => {
    try {
        const archiveDir = path.join(__dirname, 'archive');
        
        // Check if archive directory exists
        if (!fs.existsSync(archiveDir)) {
            return res.json({ files: [] });
        }
        
        const files = fs.readdirSync(archiveDir);
        const txtFiles = files.filter(file => file.endsWith('.txt'));
        
        res.json({ files: txtFiles });
    } catch (err) {
        console.error('Error reading archive directory:', err);
        res.status(500).json({ error: 'Error reading archive files!' });
    }
});

// Public: Get content of a specific archive story
app.get('/archive/story/:filename', (req, res) => {
    const filename = req.params.filename;
    const filepath = path.join(__dirname, 'archive', filename);
    
    // Security check: make sure the file is in the archive directory
    if (!filepath.startsWith(path.join(__dirname, 'archive'))) {
        return res.status(403).send('Access denied!');
    }
    
    // Check if file exists
    if (!fs.existsSync(filepath)) {
        return res.status(404).send('Story not found!');
    }
    
    fs.readFile(filepath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading file:', err);
            return res.status(500).send('Error reading story!');
        }
        res.send(data);
    });
});

// Function to get the next chapter number
function getNextChapterNumber() {
    const files = fs.readdirSync(chaptersDir);
    
    // Filter for files that match the pattern (number).txt
    const chapterNumbers = files
        .filter(file => /^\d+\.txt$/.test(file))
        .map(file => parseInt(file.replace('.txt', '')));
    
    // If no chapters exist, start at 1
    if (chapterNumbers.length === 0) {
        return 1;
    }
    
    // Return the highest number + 1
    return Math.max(...chapterNumbers) + 1;
}

// Handle save requests
app.post('/save', (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    const title = req.body.title;
    const text = req.body.text;
    const isConclusion = req.body.isConclusion || false;
    
    // Check if story is complete
    const usersData = loadUsersData();
    if (usersData.storyComplete) {
        return res.status(403).json({ error: 'The story has been marked as complete. No more submissions allowed.' });
    }
    
    // Verify username and password
    if (!verifyUser(username, password)) {
        return res.status(401).json({ error: 'Invalid username or password.' });
    }
    
    // Check if it's user's turn
    if (!isUserTurn(username)) {
        const currentUser = usersData.turnOrder[usersData.currentTurnIndex];
        return res.status(403).json({ error: 'It is not your turn. Current turn: ' + currentUser });
    }
    
    // Format the content with username and title at the top
    const content = `Author: ${username}\nTitle: ${title}\n\n${text}`;
    
    // Get the next chapter number
    const chapterNumber = getNextChapterNumber();
    const filename = `${chapterNumber}.txt`;
    const filepath = path.join(chaptersDir, filename);
    
    // Write the file
    fs.writeFile(filepath, content, (err) => {
        if (err) {
            console.error('Error writing file:', err);
            return res.status(500).json({ error: 'Error saving file!' });
        }
        console.log('File saved:', filename);
        
        // If this is the conclusion, mark story as complete
        if (isConclusion) {
            completeStory();
            res.json({ message: 'Chapter saved successfully. The story has been marked as complete.' });
        } else {
            // Advance to next turn (will regenerate if needed)
            advanceTurn();
            res.json({ message: 'Chapter saved successfully.' });
        }
    });
});

// Get list of all chapters with metadata
app.get('/chapters', (req, res) => {
    const files = fs.readdirSync(chaptersDir);
    
    const chapters = files
        .filter(file => /^\d+\.txt$/.test(file))
        .map(file => {
            const chapterNumber = parseInt(file.replace('.txt', ''));
            const filepath = path.join(chaptersDir, file);
            
            // Read the file to get author and title
            try {
                const content = fs.readFileSync(filepath, 'utf8');
                const lines = content.split('\n');
                
                let author = 'Unknown';
                let title = 'Untitled';
                
                // Extract author and title from first two lines
                if (lines[0] && lines[0].startsWith('Author: ')) {
                    author = lines[0].replace('Author: ', '').trim();
                }
                if (lines[1] && lines[1].startsWith('Title: ')) {
                    title = lines[1].replace('Title: ', '').trim();
                }
                
                return {
                    number: chapterNumber,
                    author: author,
                    title: title
                };
            } catch (err) {
                return {
                    number: chapterNumber,
                    author: 'Unknown',
                    title: 'Untitled'
                };
            }
        })
        .sort((a, b) => a.number - b.number); // Sort numerically
    
    res.json({ chapters: chapters });
});

// Get content of a specific chapter
app.get('/chapter/:number', (req, res) => {
    const chapterNumber = req.params.number;
    const filepath = path.join(chaptersDir, `${chapterNumber}.txt`);
    
    fs.readFile(filepath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading file:', err);
            return res.status(404).send('Chapter not found!');
        }
        res.send(data);
    });
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});