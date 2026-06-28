const pageName =

    new URLSearchParams(
        window.location.search
    )

    .get("page");

if (!pageName) {

    content.innerHTML =
        "<p>No page selected.</p>";

}
else {
    
    content =
    document.getElementById(
        "content"
    );

    tocContainer =
        document.getElementById(
            "toc-container"
        );
    loadPage(pageName);

}