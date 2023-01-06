import {CrucesignatiPartyXP} from "./party-xp.js";

export class CrucesignatiPartySheet extends FormApplication {
  
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["crucesignati", "dialog", "party-sheet"],
      template: "systems/crucesignati/templates/apps/party-sheet.html",
      width: 280,
      height: 400,
      resizable: true,
    });
  }

  /* -------------------------------------------- */

  /**
   * Add the Entity name into the window title
   * @type {String}
   */
  get title() {
    return game.i18n.localize("CRUCESIGNATI.dialog.partysheet");
  }

  /* -------------------------------------------- */

  /**
   * Construct and return the data object used to render the HTML template for this form application.
   * @return {Object}
   */
  getData() {
    const settings = {
      ascending: game.settings.get('crucesignati', 'ascendingAC')
    };

    return {
      system: this.object,
      config: CONFIG.CRUCESIGNATI,
      user: game.user,
      settings: settings
    };
  }

  _onDrop(event) {
    event.preventDefault();
    // WIP Drop Items
    let data;
    try {

      data = JSON.parse(event.dataTransfer.getData("text/plain"));

      if (data.type !== "Item") return;

    } catch (err) {
      return false;
    }
  }
  /* -------------------------------------------- */

  async _dealXP(ev) {
    new CrucesignatiPartyXP(this.object, {}).render(true);
  }

  async _selectActors(ev) {

    const entities = this.object.documents;
    /*
    const entities = this.object.documents.sort((a, b) => {
      if (b.token?.disposition && a.token?.disposition){
        return b.token.disposition - a.token.disposition
      } else {
        return 0
      }
    });

     */
    for(let i = 0; i<entities.length; i++) {
      if (entities[i].type === "character"){
        entities[i].isChar = true;
      } else {
        entities[i].isChar = false;
      }

    }
    const template = "/systems/crucesignati/templates/apps/party-select.html";
    const templateData = {
      actors: entities
    }
    const content = await renderTemplate(template, templateData);
    new Dialog({
      title: game.i18n.localize("CRUCESIGNATI.dialog.partyselect"),
      content: content,
      buttons: {
        set: {
          icon: '<i class="fas fa-save"></i>',
          label: game.i18n.localize("CRUCESIGNATI.Update"),
          callback: async (html) => {
            let checks = html.find("input[data-action='select-actor']");
            await Promise.all(checks.map(async (_, c) => {
              let key = c.getAttribute('name');
              await this.object.documents[key].setFlag('crucesignati', 'party', c.checked);
            }));
            this.render(true);
          },
        },
      },
    }, {
      height: "auto",
      width: 260,
      classes: ["crucesignati", "dialog", "party-select"]
    })
    .render(true);
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    html
      .find(".item-controls .item-control .select-actors")
      .click(this._selectActors.bind(this));
    
      html.find(".item-controls .item-control .deal-xp").click(this._dealXP.bind(this));
    
    html.find("a.resync").click(() => this.render(true));

    html.find(".field-img button[data-action='open-sheet']").click((ev) => {
      let actorId = ev.currentTarget.parentElement.parentElement.parentElement.dataset.actorId;
      game.actors.get(actorId).sheet.render(true);
    })
  }
}
