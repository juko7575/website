/* =====================================
   STATE
===================================== */

let CURRENT_JSON = null;
let CURRENT_PAGE = null;

// Files selected from the folder picker
let LOCAL_FILES = new Map();

// Currently selected asset from the Assets panel
let SELECTED_ASSET = null;

let ACTIVE_FIELD = null;
let ACTIVE_WRAPPER = null;
let ACTIVE_EDITOR = null;

let IMAGE_RESIZE = null;

/* =====================================
   HISTORY
===================================== */

const HISTORY = [];
let HISTORY_INDEX = -1;

const MAX_HISTORY = 100;

/* =====================================
   TEXT COLORS
===================================== */

/* =====================================
   TEXT COLORS
===================================== */

const TEXT_COLORS = [

    { name: "Red",        class: "text-red-light",       color: "#A85A5A" },
    { name: "Red Dark",   class: "text-red-dark",        color: "#6D2C2C" },

    { name: "Orange",     class: "text-orange-light",    color: "#B47A4A" },
    { name: "Orange Dark",class: "text-orange-dark",     color: "#7A4E28" },

    { name: "Gold",       class: "text-gold-light",      color: "#C8B34E" },
    { name: "Gold Dark",  class: "text-gold-dark",       color: "#8E7930" },

    { name: "Green",      class: "text-green-light",     color: "#6E8453" },
    { name: "Green Dark", class: "text-green-dark",      color: "#4C6039" },

    { name: "Blue",       class: "text-blue-light",      color: "#5F7994" },
    { name: "Blue Dark",  class: "text-blue-dark",       color: "#40566D" },

    { name: "Purple",     class: "text-purple-light",    color: "#7A648E" },
    { name: "Purple Dark",class: "text-purple-dark",     color: "#554268" },

    { name: "Burgundy",   class: "text-burgundy-light",  color: "#8D586E" },
    { name: "Burgundy Dark",class:"text-burgundy-dark",  color: "#603847" }

];


const preview = document.getElementById("editor-preview");
const jsonEditor = document.getElementById("jsonEditor");
const palette = document.getElementById("blockPalette");

const folderPicker = document.getElementById("folderPicker");
const selectFolderBtn = document.getElementById("selectFolderBtn");
const selectedFolder = document.getElementById("selectedFolder");

/* =====================================
   CONFIG
===================================== */

const AVAILABLE_BLOCKS = [
    "title",
    "heading",
    "text",
    "quote",
    "callout",
    "image",
    "list",
    "card",
    "columns",
    "divider",
    "button",
    "collapsible",
    "lead",
    "glossary_grid"
];

/* =====================================
   INSERT MODE (STATE MACHINE)
===================================== */

let INSERT_MODE = {
    active: false,
    type: null,
    activeButton: null
};

/* =====================================
   UTILS
===================================== */

function uuid() {
    return crypto.randomUUID();
}

/* =====================================
   ENSURE IDS
===================================== */

function ensureIds(blocks = []) {

    blocks.forEach(block => {

        if (!block._id) block._id = uuid();

        if (block.blocks) ensureIds(block.blocks);

        if (block.columns) {
            block.columns.forEach(col => ensureIds(col));
        }
    });
}

/* =====================================
   LOAD
===================================== */

selectFolderBtn.onclick = () => {

    folderPicker.click();

};

folderPicker.addEventListener("change", () => {

    if (!folderPicker.files.length) {

        selectedFolder.textContent = "No folder selected";
        return;

    }

    const first = folderPicker.files[0];

    selectedFolder.textContent =
        first.webkitRelativePath.split("/")[0];

    // Build lookup of every file in the selected folder
    LOCAL_FILES.clear();

    for (const file of folderPicker.files) {

        LOCAL_FILES.set(file.webkitRelativePath, file);

    }

    console.log(LOCAL_FILES);

    renderAssets();

});

/* =====================================
   ASSETS
===================================== */

function renderAssets() {

    const list = document.getElementById("assetList");
    if (!list) return;

    list.innerHTML = "";

    const imageTypes = [
        ".png",
        ".jpg",
        ".jpeg",
        ".gif",
        ".webp",
        ".bmp",
        ".svg",
        ".avif"
    ];

    for (const file of folderPicker.files) {

        const lower = file.name.toLowerCase();

        if (!imageTypes.some(ext => lower.endsWith(ext)))
            continue;

        const item = document.createElement("div");
        item.className = "asset-item";

        const thumb = document.createElement("img");
        thumb.className = "asset-thumb";

        thumb.src = URL.createObjectURL(file);

        const name = document.createElement("div");
        name.className = "asset-name";
        name.textContent = file.name;

        item.appendChild(thumb);
        item.appendChild(name);

        // Select this asset
        item.onclick = (e) => {

            // Stop document click handler from cancelling selection
            e.stopPropagation();
        
            // Remember selected asset
            SELECTED_ASSET = file;
        
            // Update highlight
            list.querySelectorAll(".asset-item")
                .forEach(i => i.classList.remove("active"));
        
            item.classList.add("active");
        
            console.log("Selected asset:", file.name);
        
        };

        list.appendChild(item);

    }

}

document.getElementById("loadBtn").addEventListener("click", async () => {

    if (!folderPicker.files.length) {
        alert("Select a folder first.");
        return;
    }

    // Folder name (e.g. "panzerfaust")
    const pageName =
        folderPicker.files[0].webkitRelativePath.split("/")[0];

    await loadEditorPage(pageName);

});


async function loadEditorPage(pageName) {

    // Try loading browser save
    const saved = loadLocal();

    if (saved) {
    
        const useSave = confirm(
            "A local saved version exists. Load it?"
        );
    
        if (useSave) {
            CURRENT_JSON = saved;
        }
    
    }
    

    CURRENT_PAGE = pageName;

    const res = await fetch(`data/${pageName}/index.json`);
    const data = await res.json();

    CURRENT_JSON = data;




    ensureIds(CURRENT_JSON.blocks);

    renderEditor();
    renderPalette();
    saveHistory("Loaded page");

}

/* =====================================
   RENDER
===================================== */

function renderEditor() {

    preview.innerHTML = renderBlocks(CURRENT_JSON.blocks);

    if (INSERT_MODE.active) {
        injectInsertZones();
    }

    syncJson();
    // Enable inline editing after render
    enableInlineEditing();
    enableImageResize();
}

/* =====================================
   WRAPPER
===================================== */

/* =====================================
   WRAPPER
===================================== */

function editorWrap(html, block) {

    return `
        <div class="editor-wrapper" data-id="${block._id}">

            <div class="editor-toolbar">

                <div class="editor-tools"></div>

                <!-- Pop-out menu (colors, links, etc.) -->
                <div class="editor-submenu"></div>

            </div>

            <!-- DELETE (same system, same layer concept) -->
            <button class="editor-delete" data-delete="${block._id}">
                ✕
            </button>

            ${html}

        </div>
    `;
}
/* =====================================
   INSERT ZONES (ONLY WHEN ACTIVE)
===================================== */

function injectInsertZones() {

    const preview = document.getElementById("editor-preview");

    // remove old zones
    preview.querySelectorAll(".insert-zone").forEach(z => z.remove());

    // wrappers (normal blocks)
    const wrappers = preview.querySelectorAll(".editor-wrapper");

    // empty columns
    const columns = preview.querySelectorAll(".column");

    // empty child containers
    const childContainers = preview.querySelectorAll(".block-children");

    // root start zone
    const rootZone = createZone("root", "start");

    rootZone.style.top = "0";

    preview.appendChild(rootZone);

    // block-level zones
    wrappers.forEach(wrapper => {

        const id = wrapper.dataset.id;

        const zone = createZone(id, "after");

        
        wrapper.appendChild(zone);
    });

    // Empty column insertion zones
    columns.forEach(col => {

        if (col.querySelector(".editor-wrapper"))
            return;

        const zone = createZone("column", "inside");
        zone.classList.add("column-zone");

        col.appendChild(zone);

    });

    // Empty child insertion zones
    childContainers.forEach(children => {

        if (children.querySelector(".editor-wrapper"))
            return;

        const wrapper = children.closest(".editor-wrapper");
        if (!wrapper)
            return;

        const zone = createZone(wrapper.dataset.id, "inside");
        zone.classList.add("child-zone");

        children.appendChild(zone);

    });

}
function clearInsertZones() {
    document.querySelectorAll(".insert-zone").forEach(z => z.remove());
}

function createZone(targetId, position) {

    const zone = document.createElement("div");

    zone.className = "insert-zone";
    zone.dataset.target = targetId;
    zone.dataset.position = position;

    return zone;
}

/* =====================================
   RENDER BLOCKS
===================================== */

function renderBlocks(blocks, pageName = CURRENT_PAGE) {

    let html = "";

    blocks.forEach(block => {

        let inner = "";

        if (block.type === "columns") {
            inner = renderColumns(block, pageName);
        } else {

            const renderer = BLOCKS[block.type];

            inner = renderer
                ? renderer(block, pageName)
                : `<div>Unknown: ${block.type}</div>`;
        }

        html += editorWrap(inner, block);
    });

    return html;
}

/* =====================================
   COLUMNS
===================================== */

function renderColumns(block, pageName) {

    return `
        <div class="columns">
            ${block.columns.map(col => `
                <div class="column">
                    ${renderBlocks(col, pageName)}
                </div>
            `).join("")}
        </div>
    `;
}

/* =====================================
   PALETTE
===================================== */

function renderPalette() {

    palette.innerHTML = "";

    AVAILABLE_BLOCKS.forEach(type => {

        const btn = document.createElement("button");

        btn.className = "palette-item";
        btn.dataset.type = type;
        btn.textContent = type;

        document.querySelectorAll(".palette-item")
                .forEach(btn => btn.classList.remove("active"));

        btn.onclick = () => {

            if (INSERT_MODE.active && INSERT_MODE.type === type) {
                deactivateInsertMode();
                return;
            }

     

            btn.classList.add("active");

            
            activateInsertMode(type, btn);
        };

        palette.appendChild(btn);
    });
}

/* =====================================
   INSERT MODE CONTROL
===================================== */

function activateInsertMode(type, button) {

    INSERT_MODE.active = true;
    INSERT_MODE.type = type;
    INSERT_MODE.activeButton = button;

    document.querySelectorAll(".palette-item")
        .forEach(b => b.classList.remove("active"));

    button.classList.add("active");

    renderEditor();
}

function deactivateInsertMode() {

    INSERT_MODE.active = false;
    INSERT_MODE.type = null;

    if (INSERT_MODE.activeButton) {
        INSERT_MODE.activeButton.classList.remove("active");
    }

    document.querySelectorAll(".palette-item")
    .forEach(btn => btn.classList.remove("active"));

    INSERT_MODE.activeButton = null;

    clearInsertZones();
}

/* =====================================
   CLICK HANDLER
===================================== */

document.addEventListener("click", (e) => {

    if (e.target.closest(".editor-toolbar")) {
        e.stopPropagation();
    }


    const image = e.target.closest(
        '[data-edit="src"], [data-edit="image.src"]'
    );

    if (image && SELECTED_ASSET) {

        applySelectedAsset(image);

        return;
    }

    /* =====================================
    CANCEL IMAGE SELECTION
    ===================================== */

    // Clicked somewhere that wasn't an image
    if (SELECTED_ASSET) {

        SELECTED_ASSET = null;

        document.querySelectorAll(".asset-item")
            .forEach(i => i.classList.remove("active"));

    }
    

    const del = e.target.closest("[data-delete]");
    if (del) {
        saveHistory("Delete block");
        deleteBlock(del.dataset.delete);
        return;
    }

    const zone = e.target.closest(".insert-zone");

    if (zone && INSERT_MODE.active) {

        insertBlock(
            zone.dataset.target,
            zone.dataset.position,
            INSERT_MODE.type
        );

        saveHistory("Insert");
        console.log(zone.dataset.target,)

        deactivateInsertMode();
        return;
    }

    // NEW: cancel insert mode on any non-zone click
    if (INSERT_MODE.active && !e.target.closest(".block-palette")) {
        deactivateInsertMode();
    }

    /* =====================================
    EDIT START
    ===================================== */

    function activateEditor(field) {

        if (!field) return;
    
        ACTIVE_EDITOR = field;
    
        const wrapper = field.closest(".editor-wrapper");
        if (!wrapper) return;
    
        ACTIVE_WRAPPER = wrapper;
    
        setToolbar(wrapper, TOOLBAR_TEXT);
    }

    preview.addEventListener("focusin", (e) => {

        const field = e.target.closest("[data-edit]");
        if (!field) return;
    
        activateEditor(field);
    
    }, true);

    /* =====================================
    INLINE EDIT SAVE 
    ===================================== */

    preview.addEventListener("blur", (e) => {

        const field = e.target.closest("[data-edit]");
        if (!field) return;
    
        const wrapper = field.closest(".editor-wrapper");
        if (!wrapper) return;
    
        const related = e.relatedTarget;
    
        // IMPORTANT: if blur is caused by toolbar interaction, ignore
        if (related && related.closest(".editor-toolbar")) {
            return;
        }
    
        const blockId = wrapper.dataset.id;
        if (!blockId) return;
    
        const block = findBlockByUUID(CURRENT_JSON.blocks, blockId);
        if (!block) return;
    
        const key = field.dataset.edit;
    
        const newValue = serializeEditable(field);

        if (block[key] !== newValue) {

            block[key] = newValue;

            syncJson();

            saveHistory("Edited text");

        }

        ACTIVE_EDITOR = null;
        clearToolbar(wrapper);
    
    }, true);
    

});




function serializeEditable(el) {

    // Clone so we never touch the live editor
    const clone = el.cloneNode(true);

    /* =====================================
       NORMALIZE CHROME CONTENTEDITABLE
    ===================================== */

    clone.querySelectorAll("div").forEach(div => {

        div.replaceWith(
            ...div.childNodes,
            document.createElement("br")
        );

    });

    /* =====================================
       REMOVE EMPTY SPANS
    ===================================== */

    clone.querySelectorAll("span").forEach(span => {

        if (
            !span.attributes.length &&
            !span.textContent.trim()
        ) {
            span.remove();
        }

    });

    let html = clone.innerHTML;

    /* =====================================
       NORMALIZE TAGS
    ===================================== */

    html = html

        // Bold
        .replace(/<\/?(b|strong)>/gi, m =>
            m.startsWith("</")
                ? "</strong>"
                : "<strong>"
        )

        // Italic
        .replace(/<\/?(i|em)>/gi, m =>
            m.startsWith("</")
                ? "</em>"
                : "<em>"
        );

    /* =====================================
       REMOVE CONTENTEDITABLE JUNK
    ===================================== */

    html = html

        // remove newlines/tabs
        .replace(/[\r\n\t]/g, "")

        // collapse spaces between tags
        .replace(/>\s+</g, "><")

        // collapse multiple spaces
        .replace(/\s{2,}/g, " ")

        // collapse repeated <br>
        .replace(/(<br\s*\/?>\s*){2,}/gi, "<br>")

        // remove leading <br>
        .replace(/^(<br\s*\/?>)+/gi, "")

        // remove trailing <br>
        .replace(/(<br\s*\/?>)+$/gi, "")

        // trim whitespace
        .trim();

    return html;

}

/* =====================================
   WRAP CURRENT SELECTION
===================================== */

/* =====================================
   APPLY STYLE TO CURRENT SELECTION
===================================== */

function applySelectionStyle(style) {

    if (!ACTIVE_EDITOR) return;

    const selection = window.getSelection();

    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);

    if (range.collapsed) return;

    // Create wrapper
    const span = document.createElement("span");

    Object.assign(span.style, style);

    span.appendChild(range.extractContents());

    range.insertNode(span);

    // Restore selection
    selection.removeAllRanges();

    const newRange = document.createRange();

    newRange.selectNodeContents(span);

    selection.addRange(newRange);

    // Save immediately
    saveCurrentEditor();

}

/* =====================================
   SAVE CURRENT EDITOR
===================================== */

function saveCurrentEditor() {

    if (!ACTIVE_EDITOR) return;

    const wrapper = ACTIVE_EDITOR.closest(".editor-wrapper");
    if (!wrapper) return;

    const block = findBlockByUUID(
        CURRENT_JSON.blocks,
        wrapper.dataset.id
    );

    if (!block) return;

    const key = ACTIVE_EDITOR.dataset.edit;

    block[key] = serializeEditable(ACTIVE_EDITOR);

    syncJson();

    saveHistory("Edited text");

}

/* =====================================
   APPLY SELECTED IMAGE
===================================== */

function applySelectedAsset(img) {

    const wrapper = img.closest(".editor-wrapper");
    if (!wrapper) return;

    const block = findBlockByUUID(
        CURRENT_JSON.blocks,
        wrapper.dataset.id
    );

    if (!block) return;

    // Image block
    if (img.dataset.edit === "src") {

        block.src = SELECTED_ASSET.name;

    }

    // Lead block
    else if (img.dataset.edit === "image.src") {

        block.image.src = SELECTED_ASSET.name;

    }

    saveHistory("Changed image");

    renderEditor();

    // Exit image selection mode
    SELECTED_ASSET = null;

    document.querySelectorAll(".asset-item")
        .forEach(i => i.classList.remove("active"));

}





/* =====================================
   TOOLBAR
===================================== */

function setToolbar(wrapper, tools) {

    const container = wrapper.querySelector(".editor-tools");
    const submenu = wrapper.querySelector(".editor-submenu");

    if (!container || !submenu) return;

    // Clear previous toolbar
    container.innerHTML = "";
    submenu.innerHTML = "";

    tools.forEach(tool => {
        const btn = document.createElement("button");

        btn.className = "editor-tool-btn";
        btn.innerHTML = tool.icon;
        btn.title = tool.title;

        btn.onclick = (e) => {

            e.preventDefault();
            e.stopPropagation();

            // Toggle submenu
            if (tool.submenu) {

                // Close if already open
                if (submenu.childElementCount) {

                    submenu.innerHTML = "";
                    return;

                }

                tool.submenu().forEach(child => {
                    submenu.appendChild(child);
                    console.log("Hello0");
                });

                return;

            }

            tool.onclick?.();

        };

        container.appendChild(btn);

    });

    wrapper.classList.add("is-editing");

}

function clearToolbar(wrapper) {

    wrapper.classList.remove("is-editing");

    wrapper
        .querySelector(".editor-submenu")
        ?.replaceChildren();

}

/* function clearToolbar(wrapper) {
    wrapper.classList.remove("is-editing");
} */

/* =====================================
   COLOR MENU
===================================== */

function createColorMenu() {

    return TEXT_COLORS.map(color => {

        const button = document.createElement("button");

        button.className = "editor-color";
        button.title = color.name;

        button.style.backgroundColor = color.color;

        button.onclick = (e) => {

            e.preventDefault();

            if (!ACTIVE_EDITOR) return;

            ACTIVE_EDITOR.focus();

            wrapSelection({

                color: color.color

            });

        };

        return button;

    });

}

/* =====================================
   HIGHLIGHT MENU
===================================== */

/* =====================================
   HIGHLIGHT MENU
===================================== */
/* =====================================
   HIGHLIGHT MENU
===================================== */

function createHighlightMenu() {

    return TEXT_COLORS.map(color => {

        const button = document.createElement("button");

        button.className = "editor-color";

        button.title = color.name;

        // Show the highlight color
        button.style.backgroundColor = color.color;

        button.onclick = (e) => {

            e.preventDefault();
            e.stopPropagation();

            if (!ACTIVE_EDITOR) return;

            // Restore focus before applying the style
            ACTIVE_EDITOR.focus();

            applySelectionStyle({

                backgroundColor: color.color

            });

        };

        return button;

    });

}

/* =====================================
   WRAP CURRENT SELECTION
===================================== */

function wrapSelection(style) {

    const selection = window.getSelection();

    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);

    if (range.collapsed) return;

    // Create a span
    const span = document.createElement("span");

    // Apply every supplied CSS property
    Object.assign(span.style, style);

    // Move the selected contents inside it
    span.appendChild(range.extractContents());

    range.insertNode(span);

    // Restore selection
    selection.removeAllRanges();

    const newRange = document.createRange();

    newRange.selectNodeContents(span);

    selection.addRange(newRange);

}

/* =====================================
   TOOLBAR PRESETS
===================================== */
const TOOLBAR_TEXT = [

    {
        icon: "<b>B</b>",
        title: "Bold",
    
        onclick() {
    
            if (!ACTIVE_EDITOR) return;
    
            ACTIVE_EDITOR.focus();
    
            document.execCommand("bold");
    
            saveCurrentEditor();
    
        }
    
    },

    {
        icon: "<i>I</i>",
        title: "Italic",
    
        onclick() {
    
            if (!ACTIVE_EDITOR) return;
    
            ACTIVE_EDITOR.focus();
    
            document.execCommand("italic");
    
            saveCurrentEditor();
    
        }
    
    },

    {
        icon: "A",
        title: "Text Color",

        submenu() {

            return createColorMenu();

        }

    },

    {
        icon: "🖍",
        title: "Highlight",

        submenu() {

            return createHighlightMenu();

        }

    }

];

/* =====================================
   IMAGE TOOLBAR
===================================== */

const TOOLBAR_IMAGE = [

    {
        icon: "⬅",
        title: "Align Left",

        onclick() {

            setImageAlign("left");

        }
    },

    {
        icon: "↔",
        title: "Align Center",

        onclick() {

            setImageAlign("center");

        }
    },

    {
        icon: "➡",
        title: "Align Right",

        onclick() {

            setImageAlign("right");

        }
    }

];

/* =====================================
   IMAGE ALIGNMENT
===================================== */

function setImageAlign(align) {

    if (!ACTIVE_WRAPPER) return;

    const block = findBlockByUUID(
        CURRENT_JSON.blocks,
        ACTIVE_WRAPPER.dataset.id
    );

    if (!block) return;

    block.align = align;

    saveHistory("Image alignment");

    renderEditor();

}


/* =====================================
   INSERT
===================================== */

function insertBlock(targetId, position, type) {

    const newBlock = createBlock(type);

    if (!newBlock._id) {
        newBlock._id = uuid();
    }

    /* -----------------------------
       INSERT INTO COLUMN
    ----------------------------- */

    if (targetId === "column") {

        const zone = document.querySelector(".insert-zone:hover");
        const col = zone?.closest(".column");

        if (!col) return;

        const columnIndex =
            Array.from(col.parentElement.children).indexOf(col);

        const wrapper = col.closest(".editor-wrapper");

        const found =
            findBlockListAndIndex(CURRENT_JSON.blocks, wrapper.dataset.id);

        if (!found) return;

        found.block.columns[columnIndex].push(newBlock);

        renderEditor();
        return;
    }

    /* -----------------------------
       INSERT AS CHILD OF A BLOCK
    ----------------------------- */

    if (position === "inside") {

        const found =
            findBlockListAndIndex(CURRENT_JSON.blocks, targetId);

        if (!found) return;

        if (!found.block.blocks) {
            found.block.blocks = [];
        }

        found.block.blocks.push(newBlock);

        renderEditor();
        return;
    }

    /* -----------------------------
       ROOT INSERT
    ----------------------------- */

    if (targetId === "root") {

        if (position === "before" || position === "start") {
            CURRENT_JSON.blocks.unshift(newBlock);
        } else {
            CURRENT_JSON.blocks.push(newBlock);
        }

        renderEditor();
        return;
    }

    /* -----------------------------
       NORMAL BEFORE / AFTER INSERT
    ----------------------------- */

    const found =
        findBlockListAndIndex(CURRENT_JSON.blocks, targetId);

    if (!found) return;

    const { list, index } = found;

    if (position === "before") {
        list.splice(index, 0, newBlock);
    } else {
        list.splice(index + 1, 0, newBlock);
    }

    renderEditor();
}   

/* =====================================
   DELETE
===================================== */

function deleteBlock(id) {

    const found = findBlockListAndIndex(CURRENT_JSON.blocks, id);

    if (!found) return;

    found.list.splice(found.index, 1);

    renderEditor();
}

/* =====================================
   FIND BLOCK
===================================== */

function findBlockListAndIndex(list, id) {

    for (let i = 0; i < list.length; i++) {

        const block = list[i];

        if (block._id === id) {
            return { list, index: i, block };
        }

        if (block.blocks) {
            const found = findBlockListAndIndex(block.blocks, id);
            if (found) return found;
        }

        if (block.columns) {
            for (const col of block.columns) {
                const found = findBlockListAndIndex(col, id);
                if (found) return found;
            }
        }
    }

    return null;
}

/* =====================================
   FIND BLOCK BY ID (READ ONLY)
===================================== */

function findBlockByUUID(list, id) {

    for (const block of list) {

        // FIX: use _id everywhere
        if (block._id === id) return block;

        if (block.blocks) {
            const found = findBlockByUUID(block.blocks, id);
            if (found) return found;
        }

        if (block.columns) {
            for (const col of block.columns) {
                const found = findBlockByUUID(col, id);
                if (found) return found;
            }
        }
    }

    return null;
}

/* =====================================
   BLOCK FACTORY
===================================== */

function createBlock(type) {

    const base = { type };

    switch (type) {

        case "title": return { ...base, text: "New Title" };
        case "heading": return { ...base, text: "New Heading" };
        case "text": return { ...base, text: "New text..." };
        case "quote": return { ...base, text: "Quote..." };
        case "callout": return { ...base, text: "Callout text", icon: "ℹ️" };
        case "image": return { ...base, src: "image.png", caption: "" };
        case "list": return { ...base, items: ["Item 1"] };
        case "card": return { ...base, text: "Card content" };
        case "columns": return { ...base, columns: [[], []], weights: [1, 1] };
        case "divider": return { ...base };
        case "button": return { ...base, text: "Button", url: "#" };
        case "collapsible": return { ...base, title: "Section", blocks: [] };
        case "lead": return { ...base, title: "Lead", text: "", image: { src: "main.png" } };
        case "glossary_grid": return { ...base, items: [] };

        default: return { ...base };
    }
}

/* =====================================
   JSON SYNC
===================================== */

function syncJson() {

    console.log("sync");

    if (!jsonEditor)
        return;

    jsonEditor.value =
        JSON.stringify(CURRENT_JSON, null, 2);


    // Save browser copy
    saveLocal();

}

/* =====================================
   LOCAL SAVE
===================================== */

function saveLocal() {

    if (!CURRENT_JSON || !CURRENT_PAGE)
        return;

    localStorage.setItem(
        "editor_" + CURRENT_PAGE,
        JSON.stringify(CURRENT_JSON)
    );

}


function loadLocal() {

    if (!CURRENT_PAGE)
        return null;

    const saved = localStorage.getItem(
        "editor_" + CURRENT_PAGE
    );

    if (!saved)
        return null;

    return JSON.parse(saved);

}



/* =====================================
   INLINE EDITING (STEP 1: ENABLE ONLY)
===================================== */

function enableInlineEditing() {

    // Find all editable fields in rendered blocks
    // Only text fields should become contenteditable
    const fields = preview.querySelectorAll(
        '[data-edit="text"], [data-edit="caption"], [data-edit="title"]'
    );

    fields.forEach(el => {

        // turn on editing
        el.setAttribute("contenteditable", "true");

        // prevent browser spell/format interference
        el.setAttribute("spellcheck", "false");

        // IMPORTANT: stop editor clicks from triggering insert/delete logic
        el.addEventListener("mousedown", (e) => {
            e.stopPropagation();
        });

    });
}

/* =====================================
   IMAGE HOVER TOOLBAR
===================================== */

preview.addEventListener("mouseover", (e) => {

    const image = e.target.closest(".block-image");

    if (!image)
        return;

    const wrapper = image.closest(".editor-wrapper");

    if (!wrapper)
        return;

    ACTIVE_WRAPPER = wrapper;

    setToolbar(wrapper, TOOLBAR_IMAGE);

});


/* =====================================
   DOWNLOAD JSON
===================================== */

document.getElementById("downloadJson")?.addEventListener("click", () => {

    if (!CURRENT_JSON) return;

    const json = JSON.stringify(CURRENT_JSON, null, 2);

    const blob = new Blob(
        [json],
        { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");

    a.href = url;
    a.download = "index.json";

    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);

});

/* =====================================
   HISTORY
===================================== */

function saveHistory(label = "Change") {

    // remove redo states
    HISTORY.splice(HISTORY_INDEX + 1);

    HISTORY.push({
        label,
        json: structuredClone(CURRENT_JSON)
    });

    // limit history
    if (HISTORY.length > MAX_HISTORY) {
        HISTORY.shift();
    }

    HISTORY_INDEX = HISTORY.length - 1;

    renderHistory();

}

function renderHistory() {

    const list = document.getElementById("historyList");
    if (!list) return;

    list.innerHTML = "";

    HISTORY.forEach((entry, index) => {

        const button = document.createElement("button");

        button.className = "history-item";

        if (index === HISTORY_INDEX) {
            button.classList.add("active");
        }

        button.textContent = `${index}. ${entry.label}`;

        button.onclick = () => {

            HISTORY_INDEX = index;

            CURRENT_JSON = structuredClone(entry.json);

            renderEditor();
            renderHistory();

        };

        list.appendChild(button);

    });

    // Keep the active snapshot visible
    const active = list.querySelector(".history-item.active");

    active?.scrollIntoView({
        block: "nearest"
    });


}


/* =====================================
   IMAGE RESIZE
===================================== */

function enableImageResize() {

    preview.querySelectorAll(".image-resize-handle").forEach(handle => {

        handle.onmousedown = (e) => {

            e.preventDefault();
            e.stopPropagation();

            const figure = handle.closest(".block-image");
            const img = figure.querySelector("img");

            IMAGE_RESIZE = {

                img,

                startX: e.clientX,

                startWidth: img.offsetWidth,

                figureWidth: figure.clientWidth

            };

        };

    });

}

document.addEventListener("mousemove", (e) => {

    if (!IMAGE_RESIZE) return;

    const delta = e.clientX - IMAGE_RESIZE.startX;

    let widthPx = IMAGE_RESIZE.startWidth + delta;

    let percent =
        widthPx / IMAGE_RESIZE.figureWidth * 100;

    // Clamp
    percent = Math.max(15, Math.min(100, percent));

    IMAGE_RESIZE.img.style.width = percent + "%";

});

document.addEventListener("mouseup", () => {

    if (!IMAGE_RESIZE) return;

    const img = IMAGE_RESIZE.img;

    const wrapper = img.closest(".editor-wrapper");

    const block = findBlockByUUID(
        CURRENT_JSON.blocks,
        wrapper.dataset.id
    );

    if (block) {

        block.width = img.style.width;

        syncJson();
        saveHistory("Resize image");

    }

    IMAGE_RESIZE = null;

});



/* =====================================
   START
===================================== */


/* loadEditorPage("panzerfaust"); */