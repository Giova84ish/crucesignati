export class CrucesignatiCombat {
  static STATUS_SLOW = -789;
  static STATUS_DIZZY = -790;

  static rollInitiative(combat, data) {
    // Check groups
    data.combatants = [];
    let groups = {};
    combat.combatants.forEach((cbt) => {
      const group = cbt.getFlag("crucesignati", "group");
      groups[group] = { present: true };
      data.combatants.push(cbt);
    });

    // Roll init
    Object.keys(groups).forEach((group) => {
      let roll = new Roll("1d10").evaluate({async: false});
      roll.toMessage({
        flavor: game.i18n.format('CRUCESIGNATI.roll.initiative', { group: CONFIG["CRUCESIGNATI"].colors[group] }),
      });
      groups[group].initiative = roll.total;
    });

    // Set init
    for (let i = 0; i < data.combatants.length; ++i) {
      if (!data.combatants[i].actor) {
        return;
      }

      const group = data.combatants[i].getFlag("crucesignati", "group");
      data.combatants[i].update({initiative: groups[group].initiative});

    }
    combat.setupTurns();
  }

  static async resetInitiative(combat, data) {
    let reroll = game.settings.get("crucesignati", "rerollInitiative");
    if (!["reset", "reroll"].includes(reroll)) {
      return;
    }
    combat.resetAll();
  }

  static async individualInitiative(combat, data) {
    let updates = [];
    let messages = [];
    combat.combatants.forEach((c, i) => {
      // This comes from foundry.js, had to remove the update turns thing
      // Roll initiative
      const cf = c._getInitiativeFormula(c);
      const roll = c.getInitiativeRoll(cf);
      let value = roll.total;
      if (combat.settings.skipDefeated && c.defeated) {
        value = CrucesignatiCombat.STATUS_DIZZY;
      }
      updates.push({ _id: c.id, initiative: value });

      // Determine the roll mode
      let rollMode = game.settings.get("core", "rollMode");;
      if ((c.token.hidden || c.hidden) && (rollMode === "roll")) rollMode = "gmroll";

      // Construct chat message data
      let messageData = foundry.utils.mergeObject({
        speaker: {
          scene: combat.scene.id,
          actor: c.actor?.id,
          token: c.token?.id,
          alias: c.name
        },
        flavor: game.i18n.format('CRUCESIGNATI.roll.individualInit', { name: c.token.name }),
        flags: {"crucesignati.initiativeRoll": true}
      }, {});
      const chatData = roll.toMessage(messageData, { rollMode: c.hidden && (rollMode === "roll") ? "gmroll" : rollMode, create: false });

      if (i > 0) chatData.sound = null;   // Only play 1 sound for the whole set
      messages.push(chatData);
    });

    await combat.updateEmbeddedDocuments("Combatant", updates);

    await ChatMessage.implementation.create(messages);
    data.turn = 0;
  }

  static format(object, html, user) {
    html.find(".initiative").each((_, span) => {
      span.innerHTML =
        span.innerHTML === `${CrucesignatiCombat.STATUS_SLOW}`
          ? '<i class="fas fa-weight-hanging"></i>'
          : span.innerHTML;
      span.innerHTML =
        span.innerHTML === `${CrucesignatiCombat.STATUS_DIZZY}`
          ? '<i class="fas fa-dizzy"></i>'
          : span.innerHTML;
    });

    html.find(".combatant").each((_, ct) => {
      // Append spellcast and retreat
      const controls = $(ct).find(".combatant-controls .combatant-control");
      const cmbtant = object.viewed.combatants.get(ct.dataset.combatantId);
      const moveInCombat = cmbtant.getFlag("crucesignati", "moveInCombat");
      const preparingSpell = cmbtant.getFlag("crucesignati", "prepareSpell");
      const moveActive = moveInCombat ? "active" : "";
      controls.eq(1).after(
        `<a class='combatant-control move-combat ${moveActive}'><i class='fas fa-walking'></i></a>`
      );
      const spellActive = preparingSpell ? "active" : "";
      controls.eq(1).after(
        `<a class='combatant-control prepare-spell ${spellActive}'><i class='fas fa-magic'></i></a>`
      );
    });
    CrucesignatiCombat.announceListener(html);

    let init = game.settings.get("crucesignati", "initiative") === "group";
    if (!init) {
      return;
    }

    html.find('.combat-control[data-control="rollNPC"]').remove();
    html.find('.combat-control[data-control="rollAll"]').remove();
    let trash = html.find(
      '.encounters .combat-control[data-control="endCombat"]'
    );
    $(
      '<a class="combat-control" data-control="reroll"><i class="fas fa-dice"></i></a>'
    ).insertBefore(trash);

    html.find(".combatant").each((_, ct) => {
      // Can't roll individual inits
      $(ct).find(".roll").remove();

      // Get group color
      const cmbtant = object.viewed.combatants.get(ct.dataset.combatantId);
      let color = cmbtant.getFlag("crucesignati", "group");

      // Append colored flag
      let controls = $(ct).find(".combatant-controls");
      controls.prepend(
        `<a class='combatant-control flag' style='color:${color}' title="${CONFIG.CRUCESIGNATI.colors[color]}"><i class='fas fa-flag'></i></a>`
      );
    });
    CrucesignatiCombat.addListeners(html);
  }

  static updateCombatant(combatant, data) {
    let init = game.settings.get("crucesignati", "initiative");
    // Why do you reroll ?
    if (data.initiative && init === "group") {
      let groupInit = data.initiative;
      const cmbtGroup = combatant.getFlag("crucesignati", "group");
      // Check if there are any members of the group with init
      game.combats.viewed.combatants.forEach((ct) => {
        const group = ct.getFlag("crucesignati", "group");
        if (
          ct.initiative &&
          ct.initiative !== "-789.00" &&
          ct.id !== data.id &&
          group === cmbtGroup
        ) {
          // Set init
          combatant.update({initiative: parseInt(ct.initiative)});
        }
      });
    }
  }

  static announceListener(html) {
    html.find(".combatant-control.prepare-spell").click((ev) => {
      ev.preventDefault();
      // Toggle spell announcement
      let id = $(ev.currentTarget).closest(".combatant")[0].dataset.combatantId;
      let isActive = ev.currentTarget.classList.contains('active');
      const combatant = game.combat.combatants.get(id);
      combatant.setFlag("crucesignati", "prepareSpell", !isActive);
    });
    html.find(".combatant-control.move-combat").click((ev) => {
      ev.preventDefault();
      // Toggle spell announcement
      let id = $(ev.currentTarget).closest(".combatant")[0].dataset.combatantId;
      let isActive = ev.currentTarget.classList.contains('active');
      const combatant = game.combat.combatants.get(id);
      combatant.setFlag("crucesignati", "moveInCombat", !isActive);
    })
  }

  static addListeners(html) {
    // Cycle through colors
    html.find(".combatant-control.flag").click((ev) => {
      if (!game.user.isGM) {
        return;
      }
      let currentColor = ev.currentTarget.style.color;
      let colors = Object.keys(CONFIG.CRUCESIGNATI.colors);
      let index = colors.indexOf(currentColor);
      if (index + 1 == colors.length) {
        index = 0;
      } else {
        index++;
      }
      let id = $(ev.currentTarget).closest(".combatant")[0].dataset.combatantId;
      const combatant = game.combat.combatants.get(id);
      combatant.setFlag("crucesignati", "group", colors[index]);
    });

    html.find('.combat-control[data-control="reroll"]').click((ev) => {
      if (!game.combat) {
        return;
      }
      let data = {};
      CrucesignatiCombat.rollInitiative(game.combat, data);
      game.combat.update({ system: data }).then(() => {
        game.combat.setupTurns();
      });
    });
  }

  static addCombatant(combat, data, options, id) {
    let token = canvas.tokens.get(data.tokenId);
    // console.log(token);
    let color = "black";
    switch (token.system.disposition) {
      case -1:
        color = "red";
        break;
      case 0:
        color = "yellow";
        break;
      case 1:
        color = "green";
        break;
    }
    data.flags = {
      crucesignati: {
        group: color,
      },
    };
  }

  static activateCombatant(li) {
    const turn = game.combat.turns.findIndex(turn => turn.id === li.data('combatant-id'));
    game.combat.update({ turn: turn })
  }

  static addContextEntry(html, options) {
    options.unshift({
      name: "Set Active",
      icon: '<i class="fas fa-star-of-life"></i>',
      callback: CrucesignatiCombat.activateCombatant
    });
  }

  static async preUpdateCombat(combat, data, diff, id) {
    let init = game.settings.get("crucesignati", "initiative");
    let reroll = game.settings.get("crucesignati", "rerollInitiative");
    if (!data.round) {
      return;
    }
    if (data.round !== 1) {
      if (reroll === "reset") {
        await CrucesignatiCombat.resetInitiative(combat, data, diff, id);
        return;
      } else if (reroll === "keep") {
        return;
      }
    }
    if (init === "group") {
      CrucesignatiCombat.rollInitiative(combat, data, diff, id);
    } else if (init === "individual") {
      await CrucesignatiCombat.individualInitiative(combat, data, diff, id);
    }
  }
}
