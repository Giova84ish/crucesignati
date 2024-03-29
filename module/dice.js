export class CrucesignatiDice {

  static async sendRoll({
    parts = [],
    system = {},
    title = null,
    flavor = null,
    speaker = null,
    form = null,
	chatMessage = true
  } = {}) {

    // console.log({system})
    const template = "systems/crucesignati/templates/chat/roll-result.html";

    let chatData = {
      user: game.user.id,
      speaker: speaker,
    };

    const templateData = {
      title: title,
      flavor: flavor,
      system: system,
    };

    // Optionally include a situational bonus
    if (form !== null && form.bonus.value) {
      parts.push(form.bonus.value);
    }

    //;
    const roll = new Roll(parts.join("+"), system).evaluate({async: false});

    // Convert the roll to a chat message and return the roll
    let rollMode = game.settings.get("core", "rollMode");
    rollMode = form ? form.rollMode.value : rollMode;

    // Force blind roll (ability formulas)
    if (!form && system.roll.blindroll) {
      rollMode = game.user.isGM ? "selfroll" : "blindroll";
    }

    if (["gmroll", "blindroll"].includes(rollMode))
      chatData["whisper"] = ChatMessage.getWhisperRecipients("GM");
    if (rollMode === "selfroll") chatData["whisper"] = [game.user._id];
    if (rollMode === "blindroll") {
      chatData["blind"] = true;
      system.roll.blindroll = true;
    }

    templateData.result = CrucesignatiDice.digestResult(system, roll);

    return new Promise((resolve) => {
      roll.render().then((r) => {
        templateData.rollCRUCESIGNATI = r;
        renderTemplate(template, templateData).then((content) => {
          chatData.content = content;
          // Dice So Nice
          if (game.dice3d) {
            game.dice3d
              .showForRoll(
                roll,
                game.user,
                true,
                chatData.whisper,
                chatData.blind
              )
              .then((displayed) => {
				if(chatMessage !== false)
					ChatMessage.create(chatData);
                resolve(roll);
              });
          } else {
            chatData.sound = CONFIG.sounds.dice;
			if(chatMessage !== false)
				ChatMessage.create(chatData);
            resolve(roll);
          }
        });
      });
    });
  }

  static digestResult(data, roll) {
    let result = {
      isSuccess: false,
      isFailure: false,
      target: data.roll.target,
      total: roll.total,
    };

    let die = roll.terms[0].total;
    if (data.roll.type === "above") {
      // SAVING THROWS
      if (roll.total >= result.target) {
        result.isSuccess = true;
      } else {
        result.isFailure = true;
      }
    } else if (data.roll.type === "below") {
      // MORALE, EXPLORATION
      if (roll.total <= result.target) {
        result.isSuccess = true;
      } else {
        result.isFailure = true;
      }
    } else if (data.roll.type === "check") {
      // SCORE CHECKS (1s and 20s)
      if (die === 1 || (roll.total <= result.target && die < 20)) {
        result.isSuccess = true;
      } else {
        result.isFailure = true;
      }
    } else if (data.roll.type === "table") {
      // Reaction
      let table = data.roll.table;
      let output = Object.values(table)[0];
      for (let i = 0; i <= roll.total; i++) {
        if (table[i]) {
          output = table[i];
        }
      }
      result.details = output;
    }
    return result;
  }

  static attackIsSuccess(roll, thac0, ac) {
    if (roll.total === 1 || roll.terms[0].results[0] === 1) {
      return false;
    }
    if (roll.total >= 20 || roll.terms[0].results[0] === 20) {
      return true;
    }
    return roll.total + ac >= thac0;
  }

  static digestAttackResult(data, roll) {
    let result = {
      isSuccess: false,
      isFailure: false,
      target: "",
      total: roll.total,
    };
    result.target = data.roll.thac0;

    // console.log(data);
    const targetAc = data.roll.target
      ? data.roll.target.actor.system.ac.value
      : 9;
    const targetAac = data.roll.target
      ? data.roll.target.actor.system.aac.value
      : 0;
    result.victim = data.roll.target ? data.roll.target.data.name : null;

    if (game.settings.get("crucesignati", "ascendingAC")) {
      if ((roll.terms[0] !== 20 && (roll.total < targetAac) || roll.terms[0] === 1)) {
        result.details = game.i18n.format(
          "CRUCESIGNATI.messages.AttackAscendingFailure",
          {
            bonus: result.target,
          }
        );
        return result;
      }
      result.details = game.i18n.format("CRUCESIGNATI.messages.AttackAscendingSuccess", {
        result: roll.total,
      });
      result.isSuccess = true;
    } else {
      if (!this.attackIsSuccess(roll, result.target, targetAc)) {
        result.details = game.i18n.format("CRUCESIGNATI.messages.AttackFailure", {
          bonus: result.target,
        });
        return result;
      }
      result.isSuccess = true;
      let value = Math.clamped(result.target - roll.total, -3, 9);
      result.details = game.i18n.format("CRUCESIGNATI.messages.AttackSuccess", {
        result: value,
        bonus: result.target,
      });
    }
    return result;
  }

  static async sendAttackRoll({
    parts = [],
    system = {},
    title = null,
    flavor = null,
    speaker = null,
    form = null,
  } = {}) {
    const template = "systems/crucesignati/templates/chat/roll-attack.html";

    let chatData = {
      user: game.user.id,
      speaker: speaker,
    };

    let templateData = {
      title: title,
      flavor: flavor,
      system: system,
      config: CONFIG.CRUCESIGNATI,
    };



    // Optionally include a situational bonus
    if (form !== null && form.bonus.value) parts.push(form.bonus.value);

    const roll = new Roll(parts.join("+"), system).evaluate({async: false});
    const dmgRoll = new Roll(system.roll.dmg.join("+"), system).evaluate({async: false});

    // Convert the roll to a chat message and return the roll
    let rollMode = game.settings.get("core", "rollMode");
    rollMode = form ? form.rollMode.value : rollMode;

    // Force blind roll (ability formulas)
    if (system.roll.blindroll) {
      rollMode = game.user.isGM ? "selfroll" : "blindroll";
    }

    if (["gmroll", "blindroll"].includes(rollMode))
      chatData["whisper"] = ChatMessage.getWhisperRecipients("GM");
    if (rollMode === "selfroll") chatData["whisper"] = [game.user._id];
    if (rollMode === "blindroll") {
      chatData["blind"] = true;
      system.roll.blindroll = true;
    }

    templateData.result = CrucesignatiDice.digestAttackResult(system, roll);

    return new Promise((resolve) => {
      roll.render().then((r) => {
        templateData.rollCRUCESIGNATI = r;
        dmgRoll.render().then((dr) => {
          templateData.rollDamage = dr;
          renderTemplate(template, templateData).then((content) => {
            chatData.content = content;
            // 2 Step Dice So Nice
            if (game.dice3d) {
              game.dice3d
                .showForRoll(
                  roll,
                  game.user,
                  true,
                  chatData.whisper,
                  chatData.blind
                )
                .then(() => {
                  if (templateData.result.isSuccess) {
                    templateData.result.dmg = dmgRoll.total;
                    game.dice3d
                      .showForRoll(
                        dmgRoll,
                        game.user,
                        true,
                        chatData.whisper,
                        chatData.blind
                      )
                      .then(() => {
                        ChatMessage.create(chatData);
                        resolve(roll);
                      });
                  } else {
                    ChatMessage.create(chatData);
                    resolve(roll);
                  }
                });
            } else {
              chatData.sound = CONFIG.sounds.dice;
              ChatMessage.create(chatData);
              resolve(roll);
            }
          });
        });
      });
    });
  }

  static async RollSave({
    parts = [],
    system = {},
    skipDialog = false,
    speaker = null,
    flavor = null,
    title = null,
	chatMessage = true
  } = {}) {
    let rolled = false;
    const template = "systems/crucesignati/templates/chat/roll-dialog.html";
    let dialogData = {
      formula: parts.join(" "),
      system: system,
      rollMode: game.settings.get("core", "rollMode"),
      rollModes: CONFIG.Dice.rollModes,
    };

    let rollData = {
      parts: parts,
      system: system,
      title: title,
      flavor: flavor,
      speaker: speaker,
	  chatMessage: chatMessage
    };
    if (skipDialog) { return CrucesignatiDice.sendRoll(rollData); }

    let buttons = {
      ok: {
        label: game.i18n.localize("CRUCESIGNATI.Roll"),
        icon: '<i class="fas fa-dice-d20"></i>',
        callback: (html) => {
          rolled = true;
          rollData.form = html[0].querySelector("form");
          roll = CrucesignatiDice.sendRoll(rollData);
        },
      },
      magic: {
        label: game.i18n.localize("CRUCESIGNATI.saves.magic.short"),
        icon: '<i class="fas fa-magic"></i>',
        callback: (html) => {
          // console.log(rollsystem)
          rolled = true;
          rollData.form = html[0].querySelector("form");
          rollData.parts.push(`${rollsystem.data.roll.magic}`);
          rollData.title += ` ${game.i18n.localize("CRUCESIGNATI.saves.magic.short")} (${rollsystem.data.roll.magic})`;
          roll = CrucesignatiDice.sendRoll(rollData);
        },
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: game.i18n.localize("CRUCESIGNATI.Cancel"),
        callback: (html) => { },
      },
    };

    const html = await renderTemplate(template, dialogData);
    let roll;

    //Create Dialog window
    return new Promise((resolve) => {
      new Dialog({
        title: title,
        content: html,
        buttons: buttons,
        default: "ok",
        close: () => {
          resolve(rolled ? roll : false);
        },
      }).render(true);
    });
  }

  static async Roll({
    parts = [],
    system = {},
    skipDialog = false,
    speaker = null,
    flavor = null,
    title = null,
	chatMessage = true
  } = {}) {
    let rolled = false;
    const template = "systems/crucesignati/templates/chat/roll-dialog.html";
    // console.log(system);
    let dialogData = {
      formula: parts.join(" "),
      system: system,
      rollMode: system.roll?.blindroll ? "blindroll" : game.settings.get("core", "rollMode"),
      rollModes: CONFIG.Dice.rollModes,
    };

    let rollData = {
      parts: parts,
      system: system,
      title: title,
      flavor: flavor,
      speaker: speaker,
	  chatMessage: chatMessage
    };

    if (skipDialog) {
      return ["melee", "missile", "attack"].includes(system.roll.type)
        ? CrucesignatiDice.sendAttackRoll(rollData)
        : CrucesignatiDice.sendRoll(rollData);
    }

    let buttons = {
      ok: {
        label: game.i18n.localize("CRUCESIGNATI.Roll"),
        icon: '<i class="fas fa-dice-d20"></i>',
        callback: (html) => {
          rolled = true;
          rollData.form = html[0].querySelector("form");
          roll = ["melee", "missile", "attack"].includes(system.roll.type)
            ? CrucesignatiDice.sendAttackRoll(rollData)
            : CrucesignatiDice.sendRoll(rollData);
        },
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: game.i18n.localize("CRUCESIGNATI.Cancel"),
        callback: (html) => { },
      },
    };

    const html = await renderTemplate(template, dialogData);
    let roll;

    //Create Dialog window
    return new Promise((resolve) => {
      new Dialog({
        title: title,
        content: html,
        buttons: buttons,
        default: "ok",
        close: () => {
          resolve(rolled ? roll : false);
        },
      }).render(true);
    });
  }
}
