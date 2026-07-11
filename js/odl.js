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



let INSERT_MODE = {
    active: false,
    type: null
};

/* =====================================
   UTILS
===================================== */

function uuid() {
    return crypto.randomUUID();
}

/* =====================================
   ENSURE IDS (IMPORTANT)
===================================== */

function ensureUuids(blocks = []) {

    blocks.forEach(block => {

        if (!block._id) {
            block._id = uuid();
        }

        if (block.blocks) ensureUuids(block.blocks);

        if (block.columns) {
            block.columns.forEach(col => ensureUuids(col));
        }

    });
}

/* =====================================
   LOAD PAGE
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

    syncJson();
}

/* =====================================
   WRAPPER (SINGLE SYSTEM)
===================================== */

function editorWrap(html, block) {

    const id = block._id;

    return `
        <div class="editor-wrapper" data-id="${id}">

            <div class="insert-zone" data-target="${id}" data-position="before"></div>

            <button class="editor-delete" data-delete="${id}">
                ✕
            </button>

            ${html}

            <div class="insert-zone" data-target="${id}" data-position="after"></div>

        </div>
    `;
}

/* =====================================
   INSIDE INSERT ZONE
===================================== */

function editorInsertInside(target) {

    if (!isEditor) return "";

    const id = Array.isArray(target)
        ? target._id
        : target._id;

    return `
        <div
            class="insert-zone insert-inside"
            data-target="${id}"
            data-position="inside">
        </div>
    `;
}   

/* =====================================
   FIND BLOCK (UUID ONLY)
===================================== */

function findBlockListAndIndex(list, id) {

    for (let i = 0; i < list.length; i++) {

        const block = list[i];

        if (block._id === id) {
            return {
                list,
                index: i,
                block
            };
        }

        if (block.blocks) {
            const found = findBlockListAndIndex(block.blocks, id);
            if (found) return found;
        }

        if (block.columns) {
            for (const column of block.columns) {
                const found = findBlockListAndIndex(column, id);
                if (found) return found;
            }
        }
    }

    return null;
}

/* =====================================
   DELETE
===================================== */

/* =====================================
   DELETE
===================================== */

function deleteBlock(id) {

    const found = findBlockListAndIndex(CURRENT_JSON.blocks, id);

    if (!found) return;

    const { list, index } = found;

    list.splice(index, 1);

    renderEditor();
}

function createBlock(type) {

    const base = {
        type
    };

    switch (type) {

        case "title":
            return { ...base, text: "New Title" };

        case "heading":
            return { ...base, text: "New Heading" };

        case "text":
            return { ...base, text: "New text..." };

        case "quote":
            return { ...base, text: "Quote..." };

        case "callout":
            return { ...base, text: "Callout text", icon: "ℹ️" };

        case "image":
            return { ...base, src: "image.png", caption: "" };

        case "list":
            return { ...base, items: ["Item 1"] };

        case "card":
            return { ...base, text: "Card content" };

        case "columns":
            return { ...base, columns: [[], []], weights: [1, 1] };

        case "divider":
            return { ...base };

        case "button":
            return { ...base, text: "Button", url: "#" };

        case "collapsible":
            return { ...base, title: "Section", blocks: [] };

        case "lead":
            return {
                ...base,
                title: "Lead title",
                text: "",
                image: { src: "main.png" }
            };

        case "glossary_grid":
            return { ...base, items: [] };

        default:
            return { ...base };
    }
}


/* =====================================
   INSERT
===================================== */

function insertBlock(targetId, position, type) {

    const found = findBlockListAndIndex(CURRENT_JSON.blocks, targetId);

    if (!found) return;

    const { list, index, block } = found;

    const newBlock = createBlock(type);
    newBlock._id = uuid();

    switch (position) {

        case "before":
            list.splice(index, 0, newBlock);
            break;

        case "after":
            list.splice(index + 1, 0, newBlock);
            break;

        case "inside":

            if (!block.blocks)
                block.blocks = [];

            block.blocks.push(newBlock);
            break;
    }

    renderEditor();
}

/* =====================================
   BLOCK RENDER
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
        btn.textContent = type;

        btn.onclick = () => {

            INSERT_MODE.active = true;
            INSERT_MODE.type = type;

            highlightInsertTargets();
        };

        palette.appendChild(btn);
    });
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

        INSERT_MODE.active = false;
        removeInsertHighlights();
    }
});

/* =====================================
   HIGHLIGHT
===================================== */

function highlightInsertTargets() {
    document.querySelectorAll(".editor-wrapper")
        .forEach(el => el.classList.add("insert-target"));
}

function removeInsertHighlights() {
    document.querySelectorAll(".insert-target")
        .forEach(el => el.classList.remove("insert-target"));
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