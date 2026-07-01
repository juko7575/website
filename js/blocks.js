let content = null;

let tocContainer = null;


let headingCounter = 0;
function createAnchor(text) {

    headingCounter++;

    return (
        text
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            + "-"
            + headingCounter
    );

}

function collectTOC(blocks, depth = 1) {

    const toc = [];

    const titleBlock = blocks.find(
        block => block.type === "title"
    );

    if (titleBlock && depth === 1) {

        toc.push({
            title: titleBlock.text,
            anchor: "page-top",
            level: 1
        });

    }

    blocks.forEach(block => {

        if (block.type === "heading") {

            block.anchor = createAnchor(block.text);

            toc.push({
                title: block.text,
                anchor: block.anchor,
                level: depth
            });

        }

        if (block.type === "collapsible") {

            block.anchor = block.anchor || createAnchor(block.title);

            toc.push({
                title: block.title,
                anchor: block.anchor,
                level: depth
            });

            if (block.blocks && block.blocks.length > 0) {

                toc.push(
                    ...collectTOC(block.blocks, depth + 1)
                );

            }
        }

        if (block.type === "card" && block.toc === true) {

            block.anchor = createAnchor(block.title);

            toc.push({
                title: block.title,
                anchor: block.anchor,
                level: depth + 1
            });

        }

        if (block.type === "columns") {

            block.columns.forEach(column => {

                toc.push(
                    ...collectTOC(column, depth)
                );

            });

        }

    });

    return toc;
}
function renderTOC(entries) {

    if (entries.length === 0)
        return "";

    let html = `

        <div class="toc-widget">

            <div class="toc-collapsed">
    `;

    entries.forEach(entry => {

        html += `
            <div
                class="toc-line toc-line-level-${entry.level}"
                data-anchor="${entry.anchor}"
                title="${entry.title}"
            ></div>
        `;
    
    });

    html += `
            </div>

            <div class="toc-expanded">

                <strong>
                    Contents
                </strong>

                <ul>
    `;

    entries.forEach(entry => {

        html += `

            <li
                class="toc-level-${entry.level}"
                data-anchor="${entry.anchor}"
            >

                <a href="#${entry.anchor}">
                    ${entry.title}
                </a>

            </li>

        `;

    });

    html += `

                </ul>

            </div>

        </div>
    `;

    return html;

}



/* =====================================
   PAGE LOADING
===================================== */

async function loadPage(pageName, options = {}) {
    const {

        contentElement = content,
    
        tocElement = tocContainer,
    
        updateTitle = true
    
    } = options;

    try {

        const entity = {
            id: pageName,
            page: `data/${pageName}/index.json`
        };

        if (!entity) {
            throw new Error("Unknown page: " + pageName);
        }

        const response =
            await fetch(entity.page);

        const data =
            await response.json();

        if (updateTitle) {
            document.title =
            data.meta?.pageTitle ||
            data.meta?.title ||
            "Article";
        }
        
        data.meta?.image || "main.png"

        const tocEntries =
            collectTOC(data.blocks);

        if (tocElement) {

            tocElement.innerHTML =
                renderTOC(tocEntries);
        
        }

        contentElement.innerHTML =
        renderBlocks(
            data.blocks,
            pageName
        );

        initCollapsibles(contentElement);

        if (tocElement) {

            initializeTOCHighlighting();
        
        }

    }

    catch (error) {

        console.error(error);

        contentElement.innerHTML =
            "<p>Failed to load page.</p>";

    }
    

}

/* =====================================
   Wiki Links
===================================== */
function replaceEntities(text) {

    return text.replace(
        /\[\[([^|\]]+)(?:\|([^\]]+))?\]\]/g,
        (match, key, label) => {

            const isGlossary = !!getGlossaryEntry(key);
            const type = isGlossary ? "glossary" : "page";

            return `
                <span
                    class="wiki-link"
                    data-key="${key}"
                    data-type="${type}"
                >
                    ${label || key}
                </span>
            `;
        }
    );
}
/* =====================================
   Glossary Database
===================================== */

let GLOSSARY = {};

async function loadGlossary() {

    const response =
        await fetch(
            "data/glossary.json"
        );

    GLOSSARY =
        await response.json();

}
function getGlossaryEntry(key) {

    const entry = GLOSSARY?.[key];

    if (!entry) return null;

    return {
        title: entry.title || key,
        short: entry.short || "",
        text: entry.text || ""
    };
}


loadGlossary();

/* =====================================
   Popup
===================================== */

const popup =

    document.getElementById(
        "entity-popup"
    );

let popupHideTimer = null;

function showPopup(html, target) {

    popup.innerHTML =
        html;

    popup.style.display =
        "block";

    requestAnimationFrame(() => {

        popup.classList.add(
            "visible"
        );

        positionPopup(
            target
        );

    });

}



function hidePopup() {

    popup.classList.remove(
        "visible"
    );

    setTimeout(() => {

        popup.style.display =
            "none";

    }, 180);

}

function positionPopup(target) {

    const rect =
        target.getBoundingClientRect();

    const popupRect =
        popup.getBoundingClientRect();

    let left =

        rect.left +

        rect.width / 2 -

        popupRect.width / 2;

    let top =

        rect.top -

        popupRect.height -

        10;

    /* Not enough room above? */

    if (top < 10) {

        top =

            rect.bottom +

            10;

    }

    /* Keep on screen */

    left = Math.max(

        10,

        Math.min(

            left,

            window.innerWidth -

            popupRect.width -

            10

        )

    );

    popup.style.left =
        left + "px";

    popup.style.top =
        top + "px";

}

/* =====================================
   Glossary Hover
===================================== */

document.addEventListener("mouseover", async (e) => {

    const link =
        e.target.closest(".wiki-link");

    if (!link)
        return;

    const key =
        link.dataset.key;

    /* Glossary entry */

    if (key in GLOSSARY) {

        const entry =
            GLOSSARY[key];

        showPopup(

            `

                <div class="preview-popup preview-popup-glossary">

                    <div class="preview-popup-content">

                        <div class="preview-popup-title">

                            ${entry.title}

                        </div>

                        <div class="preview-popup-description">

                            ${formatText(entry.text)}

                        </div>

                    </div>

                </div>

            `,

            link

        );

        return;

    }

    /* Wiki page */

    try {

        const response =
            await fetch(
                `data/${key}/index.json`
            );

        if (!response.ok)
            return;

        const data =
            await response.json();

        const lead =
            data.blocks.find(
                block => block.type === "lead"
            );

        const firstText =
            data.blocks.find(
                block => block.type === "text"
            );

        const image =
            data.meta?.popup_image ||
            "main.png";

        const title =
            data.meta?.popup_title ||
            data.meta?.title ||
            lead?.title ||
            key;

        const description =
            data.meta?.popup_desc ||
            lead?.text ||
            firstText?.text ||
            "";

        showPopup(

            `

                <div class="preview-popup">

                    <img
                        class="preview-popup-image"
                        src="data/${key}/${image}"
                        alt="${title}"
                    >

                    <div class="preview-popup-content">

                        <div class="preview-popup-title">

                            ${formatText(title)}

                        </div>

                        <div class="preview-popup-description">

                            ${formatText(description)}

                        </div>

                    </div>

                </div>

            `,

            link

        );

    }

    catch (error) {

        console.error(error);

    }

});

document.addEventListener("mouseout", (e) => {

    const link =
        e.target.closest(".wiki-link");

    if (!link)
        return;

    hidePopup();

});

function isGlossary(key) {

    return key in GLOSSARY;

}

/* =====================================
   TEXT FORMATTING
===================================== */

function formatText(text) {

    text = replaceEntities(text);

    if (!text)
        return "";

    text = replaceIcons(text);

    return text

        // links
        .replace(
            /\[([^\]]+)\]\(([^)]+)\)/g,
            '<a href="$2" target="_blank">$1</a>'
        )

        // bold
        .replace(
            /\*\*(.*?)\*\*/g,
            '<strong>$1</strong>'
        )

        // italic
        .replace(
            /\*(.*?)\*/g,
            '<em>$1</em>'
        )

        // strikethrough
        .replace(
            /~~(.*?)~~/g,
            '<del>$1</del>'
        )

        // inline code
        .replace(
            /`(.*?)`/g,
            '<code>$1</code>'
        )

        // line breaks
        .replace(
            /\n/g,
            '<br>'
        );

}

/* =====================================
   ICONS
===================================== */

function replaceIcons(text) {

    return text.replace(

        /:([a-zA-Z0-9_-]+):/g,

        (match, iconName) => {

            if (
                typeof ICONS === "undefined"
            ) {
                return match;
            }

            const icon =
                ICONS[iconName];

            if (!icon)
                return match;

            return `<a href="${icon.url}" target="_blank" class="inline-icon-link" title="${icon.title}"><img src="${icon.image}" alt="${icon.title}" class="inline-icon"></a>`;
        }

    );

}

/* =====================================
   BLOCK REGISTRY
===================================== */

const BLOCKS = {

    title(block) {

        return `
            <section
                id="page-top"
                class="block block-title"
            >
                <h1>
                    ${formatText(block.text || "")}
                </h1>
            </section>
        `;
    
    },

    heading(block) {

        return `
            <section
                id="${block.anchor || ""}"
                class="block block-heading"
            >
    
                <h2>
                    ${formatText(block.text || "")}
                </h2>
    
            </section>
        `;
    
    },

    text(block) {

        return `
            <section class="block block-text">
                <p>
                    ${formatText(block.text || "")}
                </p>
            </section>
        `;

    },

    quote(block) {

        return `
            <section class="block block-quote">
                ${formatText(block.text || "")}
            </section>
        `;

    },

    callout(block) {

        return `
            <section class="block block-callout">

                <div class="callout-icon">
                    ${block.icon || "ℹ️"}
                </div>

                <div class="callout-content">
                    ${formatText(block.text || "")}
                </div>

            </section>
        `;

    },

    image(block, pageName) {

        const width =
            block.width || "100%";
    
        const align =
            block.align || "center";
    
        return `
            <figure
                class="block block-image image-align-${align}"
            >
    
                <img
                    src="data/${pageName}/${block.src}"
                    alt="${block.caption || ""}"
                    style="width:${width};"
                >
    
                ${
                    block.caption
                    ? `
                    <figcaption>
                        ${formatText(block.caption)}
                    </figcaption>
                    `
                    : ""
                }
    
            </figure>
        `;
    
    },

    collapsible(block, pageName, level = 1) {

        const isOpen = block.open === true;
    
        block.anchor = block.anchor || createAnchor(block.title);
    
        return `
            <section
                id="${block.anchor}"
                class="collapsible ${isOpen ? "open" : ""}"
                data-level="${level}"
            >
    
                <div class="collapsible-header">
    
                    <div class="collapsible-title">
                        ${formatText(block.title || "")}
                    </div>
    
                    <div class="collapsible-toggle">
                        ${isOpen ? "−" : "+"}
                    </div>
    
                </div>
    
                <div class="collapsible-content">
                    ${renderBlocks(block.blocks || [], pageName, level + 1)}
                </div>
    
            </section>
        `;
    },

    lead(block, pageName) {

        const width =
            block.image?.width || "100%";
    
        return `
            <section class="block block-lead">
    
                <figure class="lead-image">
    
                    <img
                        src="data/${pageName}/${block.image.src}"
                        alt="${block.image.caption || ""}"
                        style="width:${width};"
                    >
    
                    ${
                        block.image.caption
                        ? `
                            <figcaption>
                                ${formatText(block.image.caption)}
                            </figcaption>
                        `
                        : ""
                    }
    
                </figure>
    
                <section
                    id="page-top"
                    class="block block-title"
                >
                    <h1>
                        ${formatText(block.title || "")}
                    </h1>
                </section>
                <div class="lead-text">
    
                    ${formatText(block.text || "")}
    
                </div>
    
            </section>
        `;
    
    },

    list(block) {

        return `
            <section class="block block-list">

                <ul>

                    ${
                        block.items
                            .map(
                                item =>
                                    `<li>${formatText(item)}</li>`
                            )
                            .join("")
                    }

                </ul>

            </section>
        `;

    },

    card(
        block,
        pageName
    ) {

        return `
            <section
                id="${block.anchor || ""}"
                class="block-card"
            >
    
                <div class="card-header">
    
                    <div class="card-icon">
                        ${formatText(block.icon || "")}
                    </div>
    
                    <div class="card-title">
                        ${formatText(block.title || "")}
                    </div>
    
                </div>
    
                <div class="card-body">
    
                    ${
                        block.text
                            ? formatText(block.text)
                            : ""
                    }
    
                    ${
                        block.blocks
                            ? renderBlocks(
                                block.blocks,
                                pageName
                            )
                            : ""
                    }
    
                </div>
    
            </section>
        `;
    
    },

    glossary_grid(block) {

        const items = Array.isArray(block.items)
            ? block.items
            : Object.entries(block.items || {}).map(([key, value]) => ({
                key,
                ...value
            }));
    
        return `
            <section class="block block-glossary-grid">
    
                <div class="glossary-grid">
    
                    ${items.map(item => {
    
                        const entry =
                            GLOSSARY?.[item.key] || {};
    
                        const short =
                            item.short ?? entry.short ?? null;
    
                        const title =
                            item.title ?? entry.title ?? null;
    
                        const text =
                            item.text ?? entry.text ?? "";
    
                        let header = "";
    
                        if (short && title) {
                            header = `
                                <div class="glossary-card-key">
                                    ${short} - ${title}
                                </div>
                            `;
                        }
    
                        else if (short) {
                            header = `
                                <div class="glossary-card-key">
                                    ${short}
                                </div>
                            `;
                        }
    
                        else if (title) {
                            header = `
                                <div class="glossary-card-key">
                                    ${title}
                                </div>
                            `;
                        }
    
                        return `
                            <div class="glossary-card block-card">
    
                                ${header}
    
                                <div class="glossary-card-value">
                                    ${formatText(text)}
                                </div>
    
                            </div>
                        `;
    
                    }).join("")}
    
                </div>
    
            </section>
        `;
    },


    divider() {

        return `
            <section class="block block-divider">
                <hr>
            </section>
        `;

    },

    button(block, pageName) {

        const width =
            block.width || "auto";
    
        const image =
    
            block.image
    
            ? (
                block.image.startsWith("/")
                    ? block.image.slice(1)
                    : `data/${pageName}/${block.image}`
            )
    
            : null;
    
        const content =
    
            image
    
            ? `
                <img
                    src="${image}"
                    alt="${block.text || ""}"
                >
            `
    
            : formatText(
                block.text || "Button"
            );
    
        return `
            <section class="block">
    
                <a
                    class="block-button"
                    href="${block.url || "#"}"
    
                    style="width:${width};"
    
                    ${
                        block.download
                            ? `download="${block.download}"`
                            : ""
                    }
                >
    
                    ${content}
    
                </a>
    
            </section>
        `;
    
    }

};

/* =====================================
   BLOCK RENDERER
===================================== */

function expandBlockTemplates(blocks) {

    return blocks.map(block => {

        let result = block;

        if (
            block.type &&
            block.type.startsWith("card-")
        ) {

            const template =
                window.BLOCK_TEMPLATES?.[block.type];

            if (template) {

                result =
                    template(block);

            }

        }

        if (
            result.blocks
        ) {

            result.blocks =
                expandBlockTemplates(
                    result.blocks
                );

        }

        return result;

    });

}

function renderBlocks(blocks, pageName, level = 1) {

    blocks = expandBlockTemplates(blocks);

    let html = "";

    blocks.forEach(block => {

        if (block.type === "columns") {

            html += renderColumns(
                block,
                pageName
            );

            return;
        }

        const renderer =
            BLOCKS[block.type];

        if (!renderer) {

            console.warn("Unknown block:", block.type);
            return;
        }

        html += renderer(
            block,
            pageName,
            level
        );

    });

    return html;
}

/* =====================================
   COLUMNS
===================================== */

function renderColumns(
    block,
    pageName
) {

    let html =
        '<div class="columns">';

    block.columns.forEach(
        (column, index) => {

            const weight =
                block.weights?.[index] || 1;

            html += `
                <div
                    class="column"
                    style="flex:${weight};"
                >
                    ${renderBlocks(
                        column,
                        pageName
                    )}
                </div>
            `;

        }
    );

    html += '</div>';

    return html;

}

/* =====================================
   Section Highlighting
===================================== */
function initializeTOCHighlighting() {

    const sections = document.querySelectorAll(

        "#page-top, .block-heading"

    );

    const observer = new IntersectionObserver(

        entries => {

            entries.forEach(entry => {

                if (!entry.isIntersecting)
                    return;

                const id =
                    entry.target.id;

                setActiveTOC(id);

            });

        },

        {
            rootMargin:
                "-25% 0px -60% 0px"
        }

    );

    sections.forEach(section => {

        observer.observe(section);

    });

}

function setActiveTOC(anchor) {

    document

        .querySelectorAll(
            ".toc-active"
        )

        .forEach(el => {

            el.classList.remove(
                "toc-active"
            );

        });

    document

        .querySelectorAll(
            `[data-anchor="${anchor}"]`
        )

        .forEach(el => {

            el.classList.add(
                "toc-active"
            );

        });

}

function initCollapsibles(root = document) {

    root.querySelectorAll(".collapsible-header").forEach(header => {

        header.onclick = () => {

            const block =
                header.closest(".collapsible");

            if (!block) return;

            block.classList.toggle("open");

        };

    });

}