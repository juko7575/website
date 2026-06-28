let META_CACHE = {};

const gridContainer =
    document.getElementById("grid");

const searchInput =
    document.getElementById("search");

let ALL_ITEMS = [];
let CURRENT_VIEW = "antiTank";

const activeTagsContainer =
    document.getElementById("search-tags");

let ACTIVE_TAGS = [];

const suggestionsContainer =
    document.getElementById(
        "tag-suggestions"
    );

const overlay =
    document.getElementById(
        "page-overlay"
    );
    const closeButton =
    document.getElementById(
        "page-close"
    );



const overlayContent =
    document.getElementById(
        "overlay-content"
    );

const overlayTOC =
    document.getElementById(
        "overlay-toc"
    );

function showSuggestions() {

    suggestionsContainer.style.display =
        "block";

}

function hideSuggestions() {

    suggestionsContainer.style.display =
        "none";

}

    

function renderSuggestions(query) {

    query = query.trim().toLowerCase();

    console.log("Query:", query);

    //
    // Browse mode
    //

    if (!query) {

        const groups = {};

        Object.entries(window.TAG_REGISTRY).forEach(([tagId, info]) => {

            if (!groups[info.category]) {
                groups[info.category] = [];
            }

            groups[info.category].push({
                id: tagId,
                label: info.label
            });

        });

        const categoryNames =
            Object.keys(groups)
                .sort();

        categoryNames.forEach(category => {

            groups[category].sort((a, b) =>
                a.label.localeCompare(b.label)
            );

        });

        suggestionsContainer.innerHTML = `

            <div class="tag-browser">

                <div class="tag-browser-groups">

                    ${categoryNames.map((category, index) => `

                        <div
                            class="tag-browser-group ${index === 0 ? "active" : ""}"
                            data-category="${category}"
                        >
                            ${category}
                        </div>

                    `).join("")}

                </div>

                <div class="tag-browser-tags">

                    ${categoryNames.map((category, index) => `

                        <div
                            class="tag-browser-panel"
                            data-category="${category}"
                            style="${index === 0 ? "" : "display:none"}"
                        >

                            ${groups[category].map(tag => `

                                <div
                                    class="tag-suggestion"
                                    data-tag="${tag.id}"
                                >

                                    ${ACTIVE_TAGS.includes(tag.id) ? "✓ " : ""}

                                    ${tag.label}

                                </div>

                            `).join("")}

                        </div>

                    `).join("")}

                </div>

            </div>

        `;

        showSuggestions();

        return;

    }

    //
    // Search mode
    //

    const matches =

        Object.entries(window.TAG_REGISTRY)

        .filter(([tagId, info]) => {

            const label =
                info.label.toLowerCase();

            const category =
                info.category.toLowerCase();

            return (

                label.includes(query)

                ||

                category.includes(query)

                ||

                tagId.toLowerCase().includes(query)

            );

        })

        .sort((a, b) =>
            a[1].label.localeCompare(b[1].label)
        )

        .slice(0, 20);

    suggestionsContainer.innerHTML =

        matches.map(([tagId, info]) => `

            <div
                class="tag-suggestion"
                data-tag="${tagId}"
            >

                ${ACTIVE_TAGS.includes(tagId) ? "✓ " : ""}

                ${info.label}

                <small>

                    (${info.category})

                </small>

            </div>

        `).join("");

        if (matches.length) {

            showSuggestions();
        
        }
        
        else {
        
            hideSuggestions();
        
        }

}

async function setView(viewId) {

    const view =
        window.VIEWS[viewId];

    if (!view)
        return;

    CURRENT_VIEW =
        viewId;
    
        document
        .querySelectorAll(".view-link")
        .forEach(link => {
    
            link.classList.toggle(
                "active",
                link.dataset.view === viewId
            );
    
        });

    ALL_ITEMS =
        view.entities;

    gridContainer.className =
        view.layout;

    ACTIVE_TAGS = [];

    renderActiveTags();

    searchInput.value = "";

    hideSuggestions();

 
    await renderGrid("");

}

async function loadGrid() {

    ALL_ITEMS =
    window.VIEWS[
        CURRENT_VIEW
    ].entities;

    await preloadMeta();

    await setView(
        CURRENT_VIEW
    );

    searchInput.addEventListener(
        "focus",
        () => {

            renderSuggestions(
                searchInput.value
            );

        }
    );

    searchInput.addEventListener(
        "input",
        (e) => {

            const query =
                e.target.value;

            renderGrid(query);

            renderSuggestions(query);

        }
    );

}

async function preloadMeta() {

    await Promise.all(
        ALL_ITEMS.map(async (id) => {

            const entity = {
                page: `data/${id}/index.json`
            };

            try {

                const res =
                    await fetch(entity.page);

                if (!res.ok) return;

                const data =
                    await res.json();

                META_CACHE[id] =
                    data.meta || {};

            }

            catch (err) {

                console.warn(
                    "Meta load failed:",
                    id
                );

            }

        })
    );

}

function getTagInfo(tagId) {

    return (
        window.TAG_REGISTRY?.[tagId]
        || {
            label: tagId,
            category: "unknown"
        }
    );

}

function renderActiveTags() {

    activeTagsContainer.innerHTML =

        ACTIVE_TAGS.map(tag => {

            const info =
                getTagInfo(tag);

            return `

                <span
                    class="active-tag"
                    data-tag="${tag}"
                >

                    ${info.label} ×

                </span>

            `;

        }).join("");

}

async function renderGrid(query) {

    const q =
        query.toLowerCase();

        const filtered =
        ALL_ITEMS.filter(id => {
    
            const meta =
                META_CACHE[id] || {};
    
            const title =
                (meta.title || id)
                    .toLowerCase();
    
            const pageTags =
                meta.tags || [];
    
            //
            // text search
            //
    
            const matchesText =
    
                title.includes(q)
    
                ||
    
                pageTags
                    .join(" ")
                    .toLowerCase()
                    .includes(q);
    
            //
            // tag search
            //
    
            const matchesTags =
    
                ACTIVE_TAGS.every(
                    tag =>
                        pageTags.includes(tag)
                );
    
            return (
                matchesText
                &&
                matchesTags
            );
    
        });

    const cards =
        await Promise.all(
            filtered.map(id =>
                loadCard(id).catch(err => {

                    console.error(
                        "Grid item failed:",
                        id,
                        err
                    );

                    return "";

                })
            )
        );

    gridContainer.innerHTML =
        cards.join("");

}


async function loadCard(id) {

    const entity =
        {
            id,
            page: `data/${id}/index.json`
        };

    const res =
        await fetch(entity.page);

    if (!res.ok) return "";

    const data =
        await res.json();

    const meta =
        data.meta || {};

    const title =
        meta.title || id;

    const image =
        meta.image || "main.png";

    const tags =
        meta.tags || [];

    const basePath =
        entity.page.replace("/index.json", "");

    const imagePath =
        `${basePath}/${image}`;

        return `
        <div
            class="grid-item"
            data-page="${id}"
        >
    
            <div class="grid-media">
                <img src="${imagePath}">
            </div>
    
            <div class="grid-placard">
    
                <div class="grid-placard-title">
                    ${title}
                </div>
    
                <div class="grid-placard-tags">
                    ${tags.map(tag => {
    
                        const info =
                            getTagInfo(tag);
    
                        return `
                            <span
                                class="tag"
                                data-tag="${tag}"
                            >
                                ${info.label}
                            </span>
                        `;
    
                    }).join("")}
                </div>
    
                <div class="grid-placard-desc">
                    Lorem ipsum dolor sit amet, museum-style description placeholder.
                </div>
    
            </div>
    
        </div>
    `;

}

async function openPage(id) {

    overlay.classList.add(
        "open"
    );

    overlayContent.innerHTML =
        "<p>Loading...</p>";

    await loadPage(id, {

        contentElement:
            overlayContent,

        tocElement:
            overlayTOC,

        updateTitle: false

    });

}

document.addEventListener("click", (e) => {

    const tag =
        e.target.closest(".tag");

    if (!tag)
        return;

    e.preventDefault();
    e.stopPropagation();

    const tagId =
        tag.dataset.tag;

    if (
        !ACTIVE_TAGS.includes(tagId)
    ) {

        ACTIVE_TAGS.push(tagId);

        renderActiveTags();

        renderGrid(
            searchInput.value
        );
        
        renderSuggestions(
            searchInput.value
        );

    }

});

document.addEventListener("click", (e) => {

    const tag =
        e.target.closest(".active-tag");

    if (!tag)
        return;

    const tagId =
        tag.dataset.tag;

    ACTIVE_TAGS =
        ACTIVE_TAGS.filter(
            t => t !== tagId
        );

    renderActiveTags();

    renderGrid(
        searchInput.value
    );

    renderSuggestions(
        searchInput.value
    );

});

document.addEventListener("click", (e) => {

    const card =
        e.target.closest(".grid-item");

    if (!card)
        return;

    if (
        e.target.closest(".tag")
        ||
        e.target.closest(".active-tag")
    )
        return;

    openPage(
        card.dataset.page
    );

});

closeButton.addEventListener(
    "click",
    () => {

        overlay.classList.remove(
            "open"
        );

        document
            .getElementById(
                "overlay-content"
            )
            .innerHTML = "";

        document
            .getElementById(
                "overlay-toc"
            )
            .innerHTML = "";

    }
);

document.addEventListener(
    "click",
    (e) => {

        const suggestion =
            e.target.closest(
                ".tag-suggestion"
            );

        if (!suggestion)
            return;

        const tagId =
            suggestion.dataset.tag;

        if (
            !ACTIVE_TAGS.includes(tagId)
        ) {

            ACTIVE_TAGS.push(tagId);

        }

        renderActiveTags();

        searchInput.value = "";

        renderGrid("");
        
        renderSuggestions("");

    }
);

document.addEventListener(
    "click",
    (e) => {

        if (
            e.target !== searchInput
            &&
            !e.target.closest(
                "#tag-suggestions"
            )
        ) {

            hideSuggestions();

            return;

        }

    }
);

document.addEventListener(
    "mouseover",
    (e) => {

        const group =
            e.target.closest(".tag-browser-group");

        if (!group)
            return;

        const category =
            group.dataset.category;

        document
            .querySelectorAll(".tag-browser-group")
            .forEach(el =>
                el.classList.remove("active")
            );

        group.classList.add("active");

        document
            .querySelectorAll(".tag-browser-panel")
            .forEach(panel => {

                panel.style.display =

                    panel.dataset.category === category
                        ? "block"
                        : "none";

            });

    }
);

document.addEventListener(
    "click",
    async (e) => {

        const link =
            e.target.closest(".view-link");

        if (!link)
            return;

        e.preventDefault();

        await setView(
            link.dataset.view
        );

    }
);

loadGrid();