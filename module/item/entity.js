import { CrucesignatiDice } from "../dice.js";
import {addChatMessageContextOptions} from "../chat.js";

/**
 * Override and extend the basic :class:`Item` implementation
 */
export class CrucesignatiItem extends Item {
  // Replacing default image */
  static get defaultIcons() {
    return {
      spell: "/systems/crucesignati/assets/default/spell.png",
      ability: "/systems/crucesignati/assets/default/ability.png",
      armor: "/systems/crucesignati/assets/default/armor.png",
      weapon: "/systems/crucesignati/assets/default/weapon.png",
      item: "/systems/crucesignati/assets/default/item.png",
      container: "/systems/crucesignati/assets/default/bag.png"
    };
  }

  static async create(data, context = {}) {
    if (data.img === undefined) {
      data.img = this.defaultIcons[data.type];
    }
    return super.create(data, context);
  }

  prepareData() {
    super.prepareData();
  }

  static chatListeners(html) {
    html.on("click", ".card-buttons button", this._onChatCardAction.bind(this));
    html.on("click", ".item-name", this._onChatCardToggleContent.bind(this));
  }

  getChatData(htmlOptions) {
    const data = duplicate(this.system);

    // console.log(htmlOptions);
    if (typeof(htmlOptions) === "object"){
      htmlOptions.async = false;
    } else {
      htmlOptions = {async: false};
    }

    // Rich text description
    data.description = TextEditor.enrichHTML(data.description, htmlOptions);

    // Item properties
    const props = [];

    if (this.type === "weapon") {
      data.tags.forEach((t) => props.push(t.value));
    }
    if (this.type === "spell") {
      props.push(`${data.class} ${data.lvl}`, data.range, data.duration);
    }
    if (data.hasOwnProperty("equipped")) {
      props.push(data.equipped ? "Equipped" : "Not Equipped");
    }

    // Filter properties and return
    data.properties = props.filter((p) => !!p);
    return data;
  }

  rollWeapon(options = {}) {
    let isNPC = this.actor.type !== "character";
    const targets = 5;
    const data = this.system;
    let type = isNPC ? "attack" : "melee";
    // console.log(this);
    const rollData = {
      item: this,
      actor: this.actor.system,
      roll: {
        save: this.system.save,
        target: null,
      },
    };

    if (data.missile && data.melee && !isNPC) {
      // Dialog
      new Dialog({
        title: "Scegli il tipo di attacco",
        content: "",
        buttons: {
          melee: {
            icon: '<i class="fas fa-fist-raised"></i>',
            label: "Mischia",
            callback: () => {
              this.actor.targetAttack(rollData, "melee", options);
            },
          },
          missile: {
            icon: '<i class="fas fa-bullseye"></i>',
            label: "Distanza",
            callback: () => {
              this.actor.targetAttack(rollData, "missile", options);
            },
          },
        },
        default: "melee",
      }).render(true);
      return true;
    } else if (data.missile && !isNPC) {
      type = "missile";
    }
    this.actor.targetAttack(rollData, type, options);
    return true;
  }

  async rollFormula(options = {}) {

    const data = this.system;
    if (!data.roll) {
      throw new Error("Questo oggetto non ha una formula per tirare!");
    }

    const label = `${this.name}`;
    const rollParts = [data.roll];

    let type = data.rollType;


    const newData = {
      actor: this.actor,
      item: this,
      roll: {
        type: type,
        target: data.rollTarget,
        blindroll: data.blindroll,
      },
    };

    // Roll and return
    return CrucesignatiDice.Roll({
      event: options.event,
      parts: rollParts,
      system: newData,
      skipDialog: true,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.format("CRUCESIGNATI.roll.formula", { label: label }),
      title: game.i18n.format("CRUCESIGNATI.roll.formula", { label: label }),
    });
  }

  spendSpell() {
    this.update({
      system: {
        cast: this.system.cast - 1,
      },
    }).then(() => {
      this.show({ skipDialog: true });
    });
  }

  getTagList() {
    const tagList = [];
    const data = this.system;
    switch (this.type) {
      case "container":
        return [];
      case "weapon":
        tagList.push({label: data.damage, icon: "fa-tint"});
        data.tags.forEach((t) => {
          tagList.push({label: t.value});
        });
        tagList.push({label: CONFIG.CRUCESIGNATI.saves_long[data.save], icon: "fa-skull"});
        if (data.missile) {
          tagList.push({label: `${data.range.short}/${data.range.medium}/${data.range.long}`, icon: "fa-bullseye"});
        }
        return tagList;
      case "armor":
        return [{label: CONFIG.CRUCESIGNATI.armor[data.type], icon: "fa-tshirt"}];
      case "class":
        return [{label: CONFIG.CRUCESIGNATI.class[data.type]}];
      case "item":
        return [];
      case "spell":
        tagList.push({label: data.class}, {label: data.range}, {label: data.duration}, {label: data.roll})
        if (data.save) {
          tagList.push({label: CONFIG.CRUCESIGNATI.saves_long[data.save], icon:"fa-skull"});
        }
        return tagList;
      case "ability":
        let roll = "";
        roll += data.roll ? data.roll : "";
        roll += data.rollTarget ? CONFIG.CRUCESIGNATI.roll_type[data.rollType] : "";
        roll += data.rollTarget ? data.rollTarget : "";
        const reqs = data.requirements.split(",");
        reqs.forEach((r) => (tagList.push({label: r})));
        if (data.roll) {
          tagList.push({label: `${game.i18n.localize("CRUCESIGNATI.items.Roll")} ${roll}`});
        }
        if (data.save) {
          tagList.push({label: `${game.i18n.localize("CRUCESIGNATI.spells.Save")} vs ${CONFIG.CRUCESIGNATI.saves_long[data.save]}`});
        }
        return tagList;
    }
  }

  getTags() {
    let formatTag = (tag, icon) => {
      if (!tag) return "";
      tag = tag.trim();
      let fa = "";
      if (icon) {
        fa = `<i class="fas ${icon}"></i> `;
      }
      return `<li class='tag'>${fa}${tag}</li>`;
    };
    return this.getTagList().reduce((acc, v) => {return `${acc}${formatTag(v.label, v.icon)}`}, "");
  }

  pushTag(values) {
    const data = this.system;
    let update = [];
    if (data.tags) {
      update = duplicate(data.tags);
    }
    let newData = {};
    var regExp = /\(([^)]+)\)/;
    if (update) {
      values.forEach((val) => {
        // Catch infos in brackets
        var matches = regExp.exec(val);
        let title = "";
        if (matches) {
          title = matches[1];
          val = val.substring(0, matches.index).trim();
        } else {
          val = val.trim();
          title = val;
        }
        // Auto fill checkboxes
        switch (val) {
          case CONFIG.CRUCESIGNATI.tags.melee:
            newData.melee = true;
            break;
          case CONFIG.CRUCESIGNATI.tags.slow:
            newData.slow = true;
            break;
          case CONFIG.CRUCESIGNATI.tags.missile:
            newData.missile = true;
            break;
        }
        update.push({ title: title, value: val });
      });
    } else {
      update = values;
    }
    newData.tags = update;
    return this.update({ system: newData });
  }

  popTag(value) {
    const data = this.system;
    let update = data.tags.filter((el) => el.value != value);
    let newData = {
      tags: update,
    };
    return this.update({ system: newData });
  }

  roll() {
    switch (this.type) {
      case "weapon":
        this.rollWeapon();
        break;
      case "spell":
        this.spendSpell();
        break;
      case "ability":
        if (this.system.roll) {
          this.rollFormula();
        } else {
          this.show();
        }
        break;
      case "item":
      case "armor":
        this.show();
    }
  }

  /**
   * Show the item to Chat, creating a chat card which contains follow up attack or damage roll options
   * @return {Promise}
   */
  async show() {
    // Basic template rendering data
    const token = this.actor.token;
    const templateData = {
      actor: this.actor,
      tokenId: token ? `${token.parent.id}.${token.id}` : null,
      item: foundry.utils.duplicate(this),
      system: this.getChatData(),
      labels: this.labels,
      isHealing: this.isHealing,
      hasDamage: this.hasDamage,
      isSpell: this.type === "spell",
      hasSave: this.hasSave,
      config: CONFIG.CRUCESIGNATI,
    };
    templateData.system.properties = this.getTagList();

    // Render the chat card template
    const template = `systems/crucesignati/templates/chat/item-card.html`;
    const html = await renderTemplate(template, templateData);

    // Basic chat message data
    const chatData = {
      user: game.user.id,
      type: CONST.CHAT_MESSAGE_TYPES.OTHER,
      content: html,
      speaker: {
        actor: this.actor.id,
        token: this.actor.token,
        alias: this.actor.name,
      },
    };

    // Toggle default roll mode
    let rollMode = game.settings.get("core", "rollMode");
    if (["gmroll", "blindroll"].includes(rollMode))
      chatData["whisper"] = ChatMessage.getWhisperRecipients("GM");
    if (rollMode === "selfroll") chatData["whisper"] = [game.user.id];
    if (rollMode === "blindroll") chatData["blind"] = true;

    // Create the chat message
    return ChatMessage.create(chatData);
  }

  /**
   * Handle toggling the visibility of chat card content when the name is clicked
   * @param {Event} event   The originating click event
   * @private
   */
  static _onChatCardToggleContent(event) {
    event.preventDefault();
    const header = event.currentTarget;
    const card = header.closest(".chat-card");
    const content = card.querySelector(".card-content");
    if (content.style.display == "none") {
      $(content).slideDown(200);
    } else {
      $(content).slideUp(200);
    }
  }

  static async _onChatCardAction(event) {
    event.preventDefault();

    // Extract card data
    const button = event.currentTarget;
    button.disabled = true;
    const card = button.closest(".chat-card");
    const messageId = card.closest(".message").dataset.messageId;
    const message = game.messages.get(messageId);
    const action = button.dataset.action;

    // Validate permission to proceed with the roll
    const isTargetted = action === "save";
    if (!(isTargetted || game.user.isGM || message.isAuthor)) return;

    // Get the Actor from a synthetic Token
    const actor = this._getChatCardActor(card);
    if (!actor) return;

    // Get the Item
    const item = actor.items.get(card.dataset.itemId);
    if (!item) {
      return ui.notifications.error(
        `Hai richiesto un oggetto ${card.dataset.itemId} che non esiste su questo Attore ${actor.name}`
      );
    }

    // Get card targets
    let targets = [];
    if (isTargetted) {
      targets = this._getChatCardTargets(card);
    }

    // Attack and Damage Rolls
    if (action === "damage"){
      await item.rollDamage({ event });
    } else if (action === "formula") {
      await item.rollFormula({ event });
    }
    // Saving Throws for card targets
    else if (action == "save") {
      if (!targets.length) {
        ui.notifications.warn(
          `Devi avere uno o più Tokens selezionati per scegliere questa opzione.`
        );
        return (button.disabled = false);
      }
      for (let t of targets) {
        await t.rollSave(button.dataset.save, { event });
      }
    }

    // Re-enable the button
    button.disabled = false;
  }

  static _getChatCardActor(card) {
    // Case 1 - a synthetic actor from a Token
    const tokenKey = card.dataset.tokenId;
    if (tokenKey) {
      const [sceneId, tokenId] = tokenKey.split(".");
      const scene = game.scenes.get(sceneId);
      if (!scene) return null;
      const tokenData = scene.getEmbeddedDocument("Token", tokenId);
      if (!tokenData) return null;
      const token = new Token(tokenData);
      return token.actor;
    }

    // Case 2 - use Actor ID directory
    const actorId = card.dataset.actorId;
    return game.actors.get(actorId) || null;
  }

  static _getChatCardTargets(card) {
    const character = game.user.character;
    const controlled = canvas.tokens.controlled;
    const targets = controlled.reduce(
      (arr, t) => (t.actor ? arr.concat([t.actor]) : arr),
      []
    );
    if (character && controlled.length === 0) targets.push(character);
    return targets;
  }
}
