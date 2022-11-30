export const preloadHandlebarsTemplates = async function () {
    const templatePaths = [
        //Character Sheets
        'systems/crucesignati/templates/actors/character-sheet.html',
        'systems/crucesignati/templates/actors/monster-sheet.html',
        //Actor partials
        //Sheet tabs
        'systems/crucesignati/templates/actors/partials/character-header.html',
        'systems/crucesignati/templates/actors/partials/character-attributes-tab.html',
        'systems/crucesignati/templates/actors/partials/character-abilities-tab.html',
        'systems/crucesignati/templates/actors/partials/character-spells-tab.html',
        'systems/crucesignati/templates/actors/partials/character-inventory-tab.html',
        'systems/crucesignati/templates/actors/partials/character-notes-tab.html',

        'systems/crucesignati/templates/actors/partials/monster-header.html',
        'systems/crucesignati/templates/actors/partials/monster-attributes-tab.html'
    ];
    return loadTemplates(templatePaths);
};
