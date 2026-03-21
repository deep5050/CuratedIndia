const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');
const marked = require('marked');

const dataDir = path.join(process.cwd(), 'data');
const templatePath = path.join(process.cwd(), 'src', 'template.html');
const placeTemplatePath = path.join(process.cwd(), 'src', 'place-template.html');
const outputPath = path.join(process.cwd(), 'index.html');
const pagesDir = path.join(process.cwd(), 'pages');

console.log('🚀 Starting build process...');

let template = fs.readFileSync(templatePath, 'utf8');
let placeTemplate = fs.readFileSync(placeTemplatePath, 'utf8');

const states = [];
const allPlaces = [];
const nationalParks = [];

if (!fs.existsSync(dataDir)) {
    console.error('❌ Data directory not found!');
    process.exit(1);
}

if (!fs.existsSync(pagesDir)) {
    fs.mkdirSync(pagesDir, { recursive: true });
}

// Ensure pages/ is cleared of old html
fs.readdirSync(pagesDir).forEach(f => {
    if (f.endsWith('.html')) fs.unlinkSync(path.join(pagesDir, f));
});

function parsePlaceFromPath(filePath, state, explicitName = null) {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const parsedContext = matter(fileContent);
    const placeData = parsedContext.data || {};

    const tokens = marked.lexer(parsedContext.content || '');

    let extName = null;
    let extImage = null;
    let extDesc = null;
    let extNote = null;
    let extLink = null;

    function searchTokens(tokenList) {
        for (const token of tokenList) {
            if (token.type === 'heading' && token.depth === 1 && !extName) extName = token.text;
            if (token.type === 'image' && !extImage) extImage = token.href;
            if (token.type === 'link' && !extLink && (token.text.toLowerCase().includes('google maps link') || token.href.includes('maps') || token.href.includes('goo.gl'))) extLink = token.href;

            if (token.type === 'paragraph') {
                const text = token.text;
                if (!extNote && (text.startsWith('**Note:**') || text.startsWith('Note:'))) {
                    extNote = text.replace(/^\*?\*?Note:\*?\*?\s*/i, '');
                } else if (!extDesc && !text.includes('![') && !text.startsWith('**Note:**') && !text.includes('[Google Maps link]')) {
                    // Extract first pure text paragraph as description
                    extDesc = text.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1'); // clean links from description
                }
            }
            if (token.tokens) searchTokens(token.tokens);
        }
    }

    searchTokens(tokens);

    // Choose frontmatter over extracted markdown if frontmatter exists
    const finalName = placeData.name || extName || explicitName || path.basename(filePath, '.md');
    const finalImage = placeData.image || extImage || 'https://github.com/user-attachments/assets/c830e493-64a1-4196-97e4-906d6df908f5';
    const finalDesc = placeData.description || extDesc || 'No description provided.';
    const finalNote = placeData.note || extNote || '';
    const finalLink = placeData.google_link || extLink || '#';

    // Clean up the markdown body so we don't duplicate the h1 and image in the UI hero
    let cleanedContent = parsedContext.content || '';
    if (extName) cleanedContent = cleanedContent.replace(new RegExp(`^#\\s+${extName.replace(/[.*+?^$\\{\\}()|[\\]\\\\]/g, '\\$&')}\\s*$`, 'm'), '');
    if (extImage) cleanedContent = cleanedContent.replace(/!\[.*?\]\(.*?\)/, '');
    if (extNote) cleanedContent = cleanedContent.replace(/^\*?\*?Note:\*?\*?\s*.*$/mi, '');
    if (extDesc) cleanedContent = cleanedContent.replace(extDesc, ''); // Simplistic removal
    if (extLink) cleanedContent = cleanedContent.replace(/\[.*?Google Maps link.*?\]\(.*?\)/i, '');

    // As a final safety check, if frontmatter existed, content is just the remaining body. 
    // If there was no frontmatter, it stripped the AST components from the full file content 
    // which was loaded into parsedContext.content by gray-matter anyway.

    const markdownBody = marked(cleanedContent.trim());

    return {
        state: state.replace(/-/g, ' '),
        name: finalName,
        slug: `${state.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${finalName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        image: finalImage,
        description: finalDesc,
        note: finalNote,
        google_link: finalLink,
        bodyHtml: markdownBody
    };
}
const stateFolders = fs.readdirSync(dataDir).filter(f => fs.statSync(path.join(dataDir, f)).isDirectory());

stateFolders.forEach(state => {
    states.push(state);
    const statePath = path.join(dataDir, state);
    const items = fs.readdirSync(statePath);

    items.forEach(item => {
        const itemPath = path.join(statePath, item);
        const stat = fs.statSync(itemPath);

        if (stat.isDirectory()) {
            if (item === 'National Parks') {
                const subItems = fs.readdirSync(itemPath).filter(f => f.endsWith('.md'));
                subItems.forEach(subItem => {
                    if (subItem === 'index.md') return;
                    const np = parsePlaceFromPath(path.join(itemPath, subItem), state);
                    np.isFolder = false;
                    nationalParks.push(np);
                });
            }
            // It's a Place folder with sub-places!
            const indexPath = path.join(itemPath, 'index.md');
            let parentPlace;

            if (!fs.existsSync(indexPath)) {
                console.warn(`⚠️ Warning: Folder ${itemPath} has no index.md. Creating a temporary parent card.`);
                parentPlace = {
                    state: state.replace(/-/g, ' '),
                    name: item,
                    image: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=1000&q=80',
                    description: `Explore the amazing destinations in ${item}.`,
                    note: '',
                    google_link: '#',
                    bodyHtml: ''
                };
            } else {
                parentPlace = parsePlaceFromPath(indexPath, state, item);
            }

            parentPlace.isFolder = true;
            // Overwrite parent slug with generic folder formatting just in case
            parentPlace.slug = `${state.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${item.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

            // Read sub-places
            const subPlaces = [];
            const subItems = fs.readdirSync(itemPath).filter(f => f.endsWith('.md') && f !== 'index.md');
            subItems.forEach(subItem => {
                subPlaces.push(parsePlaceFromPath(path.join(itemPath, subItem), state));
            });

            parentPlace.subPlaces = subPlaces;
            allPlaces.push(parentPlace);


        } else if (item.endsWith('.md')) {
            // It's a standard Place markdown file
            const place = parsePlaceFromPath(itemPath, state);
            place.isFolder = false;
            allPlaces.push(place);
        }
    });
});

console.log(`✅ Loaded ${allPlaces.length} top-level places from ${states.length} states.`);

// -------------------------------------------------------------
// 1. Generate Sub-Pages for folders and individual locations
// -------------------------------------------------------------
const subplaceTemplate = fs.readFileSync('src/subplace-template.html', 'utf8');

function generateIndividualPage(place) {
    let heroResolvedImage = place.image;
    if (heroResolvedImage && !heroResolvedImage.startsWith('http')) {
        heroResolvedImage = `../${heroResolvedImage}`;
    }

    const heroHtml = `
        <img src="${heroResolvedImage}" alt="${place.name}" loading="lazy">
        <div class="hero-content">
            <h1>${place.name}</h1>
            <p style="font-size: 1.15rem; color: #ddd; margin-bottom: 2rem;">${place.description}</p>
            ${place.note ? `<div class="card-note"><span>💡</span> ${place.note}</div>` : ''}
            ${place.bodyHtml ? `<div style="font-size: 1.05rem; line-height: 1.7; color: #e6edf3; margin-top: 1.5rem; border-top: 1px dotted rgba(255,255,255,0.1); padding-top: 1.5rem;">${place.bodyHtml}</div>` : ''}
            <br>
            <div class="card-actions" style="justify-content: flex-start; margin-top: 1rem;">
                <a href="${place.google_link}" target="_blank" rel="noopener noreferrer" class="btn-google">
                    <svg viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                    View ${place.name} on Google Maps
                </a>
            </div>
        </div>
    `;

    let localHtml = subplaceTemplate
        .replace('<!-- INJECT_TITLE -->', `<title>${place.name} | See My India</title>`)
        .replace('<!-- INJECT_PLACE_HERO -->', heroHtml);

    fs.writeFileSync(path.join(pagesDir, `${place.slug}.html`), localHtml);
    console.log(`📄 Generated detail page: ${place.slug}.html`);
}

allPlaces.forEach(place => {
    if (place.isFolder && place.subPlaces.length > 0) {
        const subCardsHtml = place.subPlaces.map(sp => generateCardHtml(sp, true)).join('');

        let heroResolvedImage = place.image;
        if (heroResolvedImage && !heroResolvedImage.startsWith('http')) {
            heroResolvedImage = `../${heroResolvedImage}`;
        }

        const heroHtml = `
            <img src="${heroResolvedImage}" alt="${place.name}" loading="lazy">
            <div class="hero-content">
                <h1>${place.name}</h1>
                <p>${place.description}</p>
                ${place.note ? `<div class="card-note"><span>💡</span> ${place.note}</div>` : ''}
            </div>
        `;

        let localHtml = placeTemplate
            .replace('<!-- INJECT_TITLE -->', `<title>${place.name} | See My India</title>`)
            .replace('<!-- INJECT_PLACE_NAME -->', place.name)
            .replace('<!-- INJECT_PLACE_HERO -->', heroHtml)
            .replace('<!-- INJECT_SUB_CARDS -->', subCardsHtml);

        fs.writeFileSync(path.join(pagesDir, `${place.slug}.html`), localHtml);
        console.log(`📁 Generated folder overview: ${place.slug}.html`);
        
        // Also physically generate individual pages for subPlaces
        place.subPlaces.forEach(sp => generateIndividualPage(sp));
    } else {
        generateIndividualPage(place);
    }
});

// -------------------------------------------------------------
// 2. Generate Home index.html
// -------------------------------------------------------------
function generateCardHtml(place, isExternal = false) {
    let resolvedImage = place.image;
    if (resolvedImage && !resolvedImage.startsWith('http')) {
        resolvedImage = isExternal ? `../${resolvedImage}` : resolvedImage;
    }

    const linkPath = isExternal ? `${place.slug}.html` : `pages/${place.slug}.html`;
    const buttonHtml = `<a href="${linkPath}" class="btn-google" style="background:var(--accent-color); color:#fff;">Explore Details →</a>`;

    return `
        <article class="place-card" data-state="${place.state}">
            <div class="card-image">
                <img src="${resolvedImage}" alt="${place.name}" loading="lazy">
            </div>
            <div class="card-content">
                <h2 class="card-title">${place.name}</h2>
                <p class="card-description">${place.description}</p>
                ${place.note ? `<div class="card-note"><span>💡</span> ${place.note}</div>` : ''}
                <div class="card-actions" style="margin-top: 1rem;">
                    ${buttonHtml}
                </div>
            </div>
        </article>
    `;
}

const cardsHtml = allPlaces.map(place => generateCardHtml(place, false)).join('');

let generatedHtml = template.replace('<!-- INJECT_CARDS -->', cardsHtml);

fs.writeFileSync('places.html', generatedHtml);
console.log('🎉 Successfully generated places.html!');

// BUILD INTERACTIVE MAP
const mapTemplate = fs.readFileSync('src/map-template.html', 'utf8');
const svgMap = fs.readFileSync('node_modules/@svg-maps/india/india.svg', 'utf8');
fs.writeFileSync('index.html', mapTemplate.replace('{{MAP_SVG}}', svgMap));
console.log('🗺️ Successfully generated index.html!');

// BUILD NATIONAL PARKS
const parksTemplate = fs.readFileSync('src/parks-template.html', 'utf8');
const parksJson = JSON.stringify(nationalParks.map((p) => ({
    name: p.name,
    state: p.state,
    image: p.image,
    desc: p.description,
    note: p.note,
    link: p.google_link
})));
fs.writeFileSync('national-parks.html', parksTemplate.replace(/{{\s*MAP_SVG\s*}}/g, svgMap).replace(/{{\s*PARKS_JSON\s*}}/g, parksJson));
console.log('🌳 Successfully generated national-parks.html!');

// BUILD CURATED HOME
const curatedTemplate = fs.readFileSync('src/curated-template.html', 'utf8');
fs.writeFileSync('curated.html', curatedTemplate);
console.log('✨ Successfully generated curated.html!');

// BUILD TREKS
const treksTemplate = fs.readFileSync('src/treks-template.html', 'utf8');
const popularTreks = [
    { name: "Roopkund Trek", state: "Uttarakhand", image: "https://images.unsplash.com/photo-1615554851411-bdc2c62c2f42?w=800", desc: "Famous for the mysterious skeletal remains found at the glacial lake.", altitude: 5029 },
    { name: "Kedarkantha Trek", state: "Uttarakhand", image: "https://images.unsplash.com/photo-1544372561-5cc7137f8842?w=800", desc: "A classic winter trek with magnificent views of Himalayan peaks.", altitude: 3810 },
    { name: "Chadar Trek", state: "Ladakh", image: "https://images.unsplash.com/photo-1613536293931-64d1f271acfa?w=800", desc: "A thrilling winter trek over the frozen Zanskar River.", altitude: 3390 },
    { name: "Valley of Flowers", state: "Uttarakhand", image: "https://images.unsplash.com/photo-1628126235206-5260b9ea6441?w=800", desc: "A colorful valley with hundreds of species of wildflowers.", altitude: 4329 },
    { name: "Sandakphu Trek", state: "West Bengal", image: "https://images.unsplash.com/photo-1588614601111-e6fb3d4b65e2?w=800", desc: "Offers stunning views of four of the world's five highest peaks.", altitude: 3636 },
    { name: "Goechala Trek", state: "Sikkim", image: "https://images.unsplash.com/photo-1621648039121-1798e4f51457?w=800", desc: "Breathtaking views of Mt. Kanchenjunga.", altitude: 4940 },
    { name: "Hampta Pass Trek", state: "Himachal Pradesh", image: "https://images.unsplash.com/photo-1596765796068-07db1855a822?w=800", desc: "A dramatic crossover from lush Kullu valley to arid Lahaul.", altitude: 4270 }
];
fs.writeFileSync('treks.html', treksTemplate.replace(/{{\s*TREKS_JSON\s*}}/g, JSON.stringify(popularTreks)));
console.log('⛰️ Successfully generated treks.html!');
