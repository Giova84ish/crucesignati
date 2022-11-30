import { CrucesignatiPartySheet } from "./dialog/party-sheet.js";

export const addControl = (object, html) => {
    let control = `<button class='crucesignati-party-sheet' type="button" title='${game.i18n.localize('CRUCESIGNATI.dialog.partysheet')}'><i class='fas fa-users'></i></button>`;
    html.find(".fas.fa-search").replaceWith($(control))
    html.find('.crucesignati-party-sheet').click(ev => {
        showPartySheet(object);
    })
}

export const showPartySheet = (object) => {
    new CrucesignatiPartySheet(object, {
      top: window.screen.height / 2 - 180,
      left:window.screen.width / 2 - 140,
    }).render(true);
}

export const update = (actor, data) => {
    if (actor.getFlag('crucesignati', 'party')) {
        Object.values(ui.windows).forEach(w => {
            if (w instanceof CrucesignatiPartySheet) {
                w.render(true);
            }
        })
    }
}