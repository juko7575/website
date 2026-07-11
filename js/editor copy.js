/* =====================================
   STATE
===================================== */

let CURRENT_JSON = null;
let CURRENT_PAGE = null;

const preview = document.getElementById("editor-preview");
const jsonEditor = document.getElementById("jsonEditor");
const palette = document.getElementById("blockPalette");

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

function ensureUuids(blocks = []) {

    blocks.forEach(block => {

        if (!block._id) block._id = uuid();

        if (block.blocks) ensureUuids(block.blocks);

        if (block.columns) {
            block.columns.forEach(col => ensureUuids(col));
        }
    });
}

/* =====================================
   LOAD
===================================== */

async function loadEditorPage(pageName) {

    CURRENT_PAGE = pageName;

    const res = await fetch(`data/${pageName}/index.json`);
    const data = await res.json();

    CURRENT_JSON = data;

    ensureUuids(CURRENT_JSON.blocks);

    renderEditor();
    renderPalette();
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
}

/* =====================================
   WRAPPER
===================================== */

function editorWrap(html, block) {

    return `
        <div class="editor-wrapper" data-id="${block.uuid}">
            <button class="editor-edit" data-edit-block="${block.uuid}">
                ✎
            </button>

            <button class="editor-delete" data-delete="${block.uuid}">
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

    // columns (IMPORTANT ADDITION)
    const columns = preview.querySelectorAll(".column");

    // root start zone
    preview.prepend(createZone("root", "start"));

    // block-level zones
    wrappers.forEach(wrapper => {

        const id = wrapper.dataset.id;

        wrapper.insertAdjacentElement(
            "afterend",
            createZone(id, "after")
        );
    });

    // COLUMN FIX: give each column its own internal insertion point
    columns.forEach(col => {

        const hasBlocks =
            col.querySelector(".editor-wrapper");
    
        // ONLY show empty column insert zone
        if (!hasBlocks) {
    
            const zone = createZone("column", "inside");
            zone.classList.add("column-zone");
    
            col.appendChild(zone);
        }
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

function renderBlocks(blocks) {

    let html = "";

    blocks.forEach(block => {

        let inner = "";

        if (block.type === "columns") {
            inner = renderColumns(block);
        } else {
            const renderer = BLOCKS[block.type];
            inner = renderer
                ? renderer(block, CURRENT_PAGE)
                : `<div>Unknown: ${block.type}</div>`;
        }

        html += editorWrap(inner, block);
    });

    return html;
}

/* =====================================
   COLUMNS
===================================== */

function renderColumns(block) {

    return `
        <div class="columns">
            ${block.columns.map(col => `
                <div class="column">
                    ${renderBlocks(col)}
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

    const del = e.target.closest("[data-delete]");
    if (del) {
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

        deactivateInsertMode();
        return;
    }

    // NEW: cancel insert mode on any non-zone click
    if (INSERT_MODE.active && !e.target.closest(".block-palette")) {
        deactivateInsertMode();
    }
});

/* =====================================
   INSERT
===================================== */

function insertBlock(targetId, position, type) {

    if (targetId === "column") {

        // find nearest column context from clicked zone
        const zone = document.querySelector(".insert-zone:hover");
        const col = zone?.closest(".column");
    
        if (!col) return;
    
        const columnIndex = Array.from(col.parentElement.children).indexOf(col);
        const wrapper = col.closest(".editor-wrapper");
    
        const found = findBlockListAndIndex(CURRENT_JSON.blocks, wrapper.dataset.id);
    
        if (!found) return;
    
        const columnBlock = found.block;
    
        const newBlock = createBlock(type);

        if (!newBlock._id) {
            newBlock._id = uuid();
        }
    
        if (!columnBlock.columns[columnIndex]) return;
    
        columnBlock.columns[columnIndex].push(newBlock);
    
        renderEditor();
        return;
    }

    const newBlock = createBlock(type);

    if (!newBlock._id) {
        newBlock._id = uuid();
    }

    if (targetId === "root") {

        if (position === "before" || position === "start") {
            CURRENT_JSON.blocks.unshift(newBlock);
        } else {
            CURRENT_JSON.blocks.push(newBlock);
        }

        renderEditor();
        return;
    }

    const found = findBlockListAndIndex(CURRENT_JSON.blocks, targetId);

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
    if (!jsonEditor) return;
    jsonEditor.value = JSON.stringify(CURRENT_JSON, null, 2);
}

/* =====================================
   START
===================================== */

loadEditorPage("panzerfaust");