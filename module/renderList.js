export const RenderCompendium = async function(object, html, d) {
    // console.log(object);
    if (object.metadata.entity !== "Item") {
        return;
    }
    const render = html[0].querySelectorAll(".item");
    const docs = await d.collection.getDocuments()
    render.forEach(function(item, i) {
        const id = render[i].dataset.documentId;
        const element = docs.filter(d => d.id === id)[0];
        const tagList = document.createElement("ol");
        tagList.classList.add("tag-list");
        tagList.innerHTML = element.getTags();
        item.appendChild(tagList);
    })
}

export const RenderDirectory = async function(object, html) {
    if (object.id !== "items") {
        return;
    }
    const render = html[0].querySelectorAll(".item");
    const content = object.documents;
    render.forEach(function(item) {
        const tagList = document.createElement("ol");
        tagList.classList.add("tag-list");
        const entity = content.find((e) => e.id === item.dataset.documentId);
        tagList.innerHTML = entity.getTags();
        item.appendChild(tagList);
    })
}