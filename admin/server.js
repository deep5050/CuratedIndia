const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Directories
const dataDir = path.join(__dirname, '../data');
const assetsDir = path.join(__dirname, '../assets/images');

// Ensure assets dir exists
if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
}

// Multer Config
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, assetsDir);
    },
    filename: (req, file, cb) => {
        // We will assign a slugified name based on the place name sent in the form
        const slug = req.body.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const ext = path.extname(file.originalname);
        cb(null, `${slug}${ext}`);
    }
});

const upload = multer({ storage });

function objToYamlFrontmatter(metadata, body = "") {
    let yaml = "---\n";
    for (const [key, value] of Object.entries(metadata)) {
        if (value) {
            // Escape quotes inside value
            const safeValue = String(value).replace(/"/g, '\\"');
            yaml += `${key}: "${safeValue}"\n`;
        }
    }
    yaml += "---\n";
    if (body) {
        yaml += body + "\n";
    }
    return yaml;
}

app.post('/api/places', upload.single('image'), (req, res) => {
    try {
        const { state, name, description, note, google_link, body, isParent, parentPlaceName } = req.body;

        if (!state || !name) {
            return res.status(400).json({ error: "State and Name are required" });
        }

        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const imageUrl = req.file ? `assets/images/${req.file.filename}` : "";

        // Determine save path
        let saveDir = path.join(dataDir, state);
        if (parentPlaceName && parentPlaceName.trim() !== "") {
            // It's a sub-place
            saveDir = path.join(saveDir, parentPlaceName);
        } else if (isParent === 'true') {
            // It's a parent place (a folder)
            saveDir = path.join(saveDir, name);
        }

        if (!fs.existsSync(saveDir)) {
            fs.mkdirSync(saveDir, { recursive: true });
        }

        let mdFileName = `${slug}.md`;
        if (isParent === 'true' && !parentPlaceName) {
            mdFileName = 'index.md';
        }

        const mdFilePath = path.join(saveDir, mdFileName);

        const frontmatter = {
            name,
            image: imageUrl,
            description,
            note,
            google_link
        };

        const finalContent = objToYamlFrontmatter(frontmatter, body);

        fs.writeFileSync(mdFilePath, finalContent);

        res.json({ success: true, message: `Place created successfully at ${mdFilePath}` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to create entry" });
    }
});

app.listen(PORT, () => {
    console.log(`Backend Admin Server running at http://localhost:${PORT}`);
    console.log(`Access the control panel at http://localhost:${PORT}/index.html`);
});
