# 🇮🇳 India: Curated

An open-source, beautifully interactive bucket list of the most magical destinations across India. 

## 🌟 How It Works
The entire project is driven natively by **Markdown**! The system's intelligent AST (Abstract Syntax Tree) compiler locally parses standard `.md` files and seamlessly generates static HTML code ready for Web Deploy.

## 🤝 How to Contribute
You don't need to know *any* code to contribute! Just have a GitHub account and know how to type Markdown.
We warmly welcome new locations. To add a new location to the interactive map:

1. **Find the State**: Navigate to the `data/` directory and open the respective Indian State or Union Territory you wish to contribute to.
2. **Create a File**: Click **"Add File" -> "Create new file"** in GitHub and name it whatever you'd like (e.g. `taj-mahal.md`).
3. **Write the Content**: Write standard markdown! You can easily drag-and-drop a beautiful local image directly into the GitHub text editor to upload it securely and instantly!

### 📝 Markdown Template
Use this exact format for your markdown file to ensure the compiler reads your design correctly:

```markdown
# Name of the Place

![Drag and drop your image directly here!](https://github.com/user/project/assets/image.png)

A compelling description of the place. Tell us why we must visit it! Keep it contained to a single paragraph.

**Note:** Any special tips, best time to visit, or historical fun facts you'd like us to know.

[Google Maps link](https://maps.app.goo.gl/...)
```

### ⚙️ Local Development
If you want to run the map compiler locally to customize the CSS or engine logic:
1. Make sure you have NodeJS installed.
2. `npm install`
3. `npm run build`
4. Open the generated `index.html` locally in your web browser!
