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

function collectTOC(blocks) {

    const toc = [];

    const titleBlock = blocks.find(
        block => block.type === "title"
    );
    
    if (titleBlock) {
    
        toc.push({
    
            title: titleBlock.text,
    
            anchor: "page-top",
    
            level: 1
    
        });
    
    }

    blocks.forEach(block => {

        if (block.type === "heading") {

            block.anchor =
                createAnchor(
                    block.text
                );

            toc.push({

                title: block.text,
            
                anchor: block.anchor,
            
                level: 1
            
            });

        }

        if (
            block.type === "card" &&
            block.toc === true
        ) {
        
            block.anchor =
                createAnchor(
                    block.title
                );
        
            toc.push({
        
                title: block.title,
        
                anchor: block.anchor,
        
                level: 2
        
            });
        
        }

        if (block.type === "columns") {

            block.columns.forEach(
                column => {

                    toc.push(
                        ...collectTOC(column)
                    );

                }
            );

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
   Page popupper
===================================== */
function replaceEntities(text) {

    return text.replace(
        /\[\[([^\]]+)\]\]/g,
        (match, key) => {

            const entity =
                window.ENTITIES?.[key];

            if (!entity)
                return key;

            return `<span class="entity" data-entity="${key}">${entity.title}</span>`;

        }
    );

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

    divider() {

        return `
            <section class="block block-divider">
                <hr>
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

function renderBlocks(
    blocks,
    pageName
) {

    blocks = expandBlockTemplates(blocks);
    

    let html = "";

    blocks.forEach(block => {

        if (
            block.type === "columns"
        ) {

            html += renderColumns(
                block,
                pageName
            );

            return;
        }

        const renderer =
            BLOCKS[block.type];

        if (!renderer) {

            console.warn(
                "Unknown block:",
                block.type
            );

            return;
        }

        html += renderer(
            block,
            pageName
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


/* =====================================
   Glossary
===================================== */


/* Hover Lock */
let activeEntityEl = null;




let popupHideTimer = null;
document.addEventListener("mouseover", (e) => {

    const el =
        e.target.closest(".entity");

    const popup =
        document.getElementById("entity-popup");

    if (popupHideTimer) {
        clearTimeout(popupHideTimer);
        popupHideTimer = null;
    }

    if (!el) return;

    const key =
        el.dataset.entity;

    const entity =
        window.ENTITIES?.[key];

    if (!entity) return;

    showEntityPopup(entity, el);

});

document.addEventListener("mousemove", (e) => {

    const popup =
        document.getElementById("entity-popup");

    if (!popup) return;

    const rect =
        popup.getBoundingClientRect();

    const insidePopup =
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom;

    const el =
        e.target.closest(".entity");

    const insideEntity =
        !!el;

    if (insidePopup || insideEntity) {

        if (popupHideTimer) {
            clearTimeout(popupHideTimer);
            popupHideTimer = null;
        }

        return;
    }

    if (!popupHideTimer) {

        popupHideTimer = setTimeout(() => {

            popup.style.display = "none";

        }, 150);

    }

});


document.addEventListener("click", (e) => {

    const el =
        e.target.closest(".entity");

    if (!el) return;

    const key =
        el.dataset.entity;

    const entity =
        window.ENTITIES?.[key];

    if (!entity) return;

    window.location.href =
        `page.html?page=${key}`;

});

function showEntityPopup(entity, target) {

    const popup =
        document.getElementById("entity-popup");

    popup.style.display = "block";

    const rect =
        target.getBoundingClientRect();

    popup.style.left =
        (rect.right + 10) + "px";

    popup.style.top =
        rect.top + "px";

    fetch(entity.page)
        .then(r => r.json())
        .then(data => {

            popup.innerHTML =
                renderBlocks(data.blocks);

        });

}

