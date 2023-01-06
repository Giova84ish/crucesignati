import { CrucesignatiDice } from "../dice.js";
import { CrucesignatiItem } from "../item/entity.js";

export class CrucesignatiActor extends Actor {
  /**
   * Extends data from base Actor class
   */

  prepareData() {
    super.prepareData();
    const data = this.system;

    // Compute modifiers from actor scores
    this.computeModifiers();
    this.computeAC();
    this.computeEncumbrance();
    this.computeTreasure();

    // Determine Initiative
    if (this.type == "character") {
      if (data.initiative){
        data.initiative.value = data.scores.dex.mod2;
      } else {
        data.initiative = {value: 0};
      }

    } else {
      if (data.initiative){
        data.initiative.value = 0;
      } else {
        data.initiative = {value: 0}
      }
    }

    data.movement.encounter = data.movement.base;
  }

  static async update(data, options = {}) {
    // Compute AAC from AC
    if (data.system?.ac?.value) {
      data.system.aac = { value: 19 - data.system.ac.value };
    } else if (data.system?.aac?.value) {
      data.system.ac = { value: 19 - data.system.aac.value };
    }

    // Compute Attacco from BBA
    if (data.system?.thac0?.value) {
      data.system.thac0.bba = 19 - data.system.thac0.value;
    } else if (data.system?.thac0?.bba) {
      data.system.thac0.value = 19 - data.system.thac0.bba;
    }

    super.update(data, options);
  }

  async createEmbeddedDocuments(embeddedName, data = [], context = {}) {
    data.map((item) => {
      if (item.img === undefined) {
        item.img = CrucesignatiItem.defaultIcons[item.type];
      }
    });
    return super.createEmbeddedDocuments(embeddedName, data, context);
  }

  /* -------------------------------------------- */
  /*  Socket Listeners and Handlers
    /* -------------------------------------------- */
  getExperience(value, options = {}) {
    if (this.type !== "character") {
      return;
    }
    let modified = Math.floor(
      value + (this.system.details.xp.bonus * value) / 100
    );
    return this.update({
      "data.details.xp.value": modified + this.system.details.xp.value,
    }).then(() => {
      const speaker = ChatMessage.getSpeaker({ actor: this });
      ChatMessage.create({
        content: game.i18n.format("CRUCESIGNATI.messages.GetExperience", {
          name: this.name,
          value: modified,
        }),
        speaker,
      });
    });
  }

  isNew() {
    const data = this.system;
    if (this.type === "character") {
      let ct = 0;
      Object.values(data.scores).forEach((el) => {
        ct += el.value;
      });
      return ct === 0 ? true : false;
    } else if (this.type === "monster") {
      let ct = 0;
      Object.values(data.saves).forEach((el) => {
        ct += el.value;
      });
      return ct === 0 ? true : false;
    }
  }

  generateSave(hd) {
    let saves = {};
    for (let i = 0; i <= hd; i++) {
      let tmp = CONFIG.CRUCESIGNATI.monster_saves[i];
      if (tmp) {
        saves = tmp;
      }
    }
    // Compute Attacco
    let thac0 = 20;
    Object.keys(CONFIG.CRUCESIGNATI.monster_thac0).forEach((k) => {
      if (parseInt(hd) < parseInt(k)) {
        return;
      }
      thac0 = CONFIG.CRUCESIGNATI.monster_thac0[k];
    });
    this.update({
      "data.thac0.value": thac0,
      "data.saves": {
        death: {
          value: saves.d,
        },
        wand: {
          value: saves.w,
        },
        paralysis: {
          value: saves.p,
        },
        breath: {
          value: saves.b,
        },
        spell: {
          value: saves.s,
        },
      },
    });
  }

  /* -------------------------------------------- */
  /*  Rolls                                       */
  /* -------------------------------------------- */

  rollHP(options = {}) {
    let roll = new Roll(this.system.hp.hd).roll({ async: false });
    return this.update({
      system: {
        hp: {
          max: roll.total,
          value: roll.total,
        },
      },
    });
  }

  rollSave(save, options = {}) {
    const label = game.i18n.localize(`CRUCESIGNATI.saves.${save}.long`);
    const rollParts = ["1d20"];

    const data = {
      actor: this,
      roll: {
        type: "above",
        target: this.system.saves[save].value,
        magic:
          this.type === "character" ? this.system.scores.wis.mod : 0,
      },
      details: game.i18n.format("CRUCESIGNATI.roll.details.save", { save: label }),
    };

    let skip = options?.event?.ctrlKey || options.fastForward;

    const rollMethod =
      this.type === "character" ? CrucesignatiDice.RollSave : CrucesignatiDice.Roll;

    // Roll and return
    return rollMethod({
      event: options.event,
      parts: rollParts,
      system: data,
      skipDialog: skip,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.format("CRUCESIGNATI.roll.save", { save: label }),
      title: game.i18n.format("CRUCESIGNATI.roll.save", { save: label }),
      chatMessage: options.chatMessage,
    });
  }

  rollMorale(options = {}) {
    const rollParts = ["1d20"];

    const data = {
      actor: this,
      roll: {
        type: "below",
        target: this.system.details.morale,
      },
    };

    // Roll and return
    return CrucesignatiDice.Roll({
      event: options.event,
      parts: rollParts,
      system: data,
      skipDialog: true,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.localize("CRUCESIGNATI.roll.morale"),
      title: game.i18n.localize("CRUCESIGNATI.roll.morale"),
    });
  }

  rollLoyalty(options = {}) {
    const label = game.i18n.localize(`CRUCESIGNATI.roll.loyalty`);
    const rollParts = ["2d6"];

    const data = {
      actor: this,
      roll: {
        type: "below",
        target: this.system.retainer.loyalty,
      },
    };

    // Roll and return
    return CrucesignatiDice.Roll({
      event: options.event,
      parts: rollParts,
      system: data,
      skipDialog: true,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: label,
      title: label,
    });
  }

  rollReaction(options = {}) {
    const rollParts = ["2d6"];

    const data = {
      actor: this,
      roll: {
        type: "table",
        table: {
          2: game.i18n.format("CRUCESIGNATI.reaction.Hostile", {
            name: this.name,
          }),
          3: game.i18n.format("CRUCESIGNATI.reaction.Unfriendly", {
            name: this.name,
          }),
          6: game.i18n.format("CRUCESIGNATI.reaction.Neutral", {
            name: this.name,
          }),
          9: game.i18n.format("CRUCESIGNATI.reaction.Indifferent", {
            name: this.name,
          }),
          12: game.i18n.format("CRUCESIGNATI.reaction.Friendly", {
            name: this.name,
          }),
        },
      },
    };

    let skip = options.event && options.event.ctrlKey;

    // Roll and return
    return CrucesignatiDice.Roll({
      event: options.event,
      parts: rollParts,
      system: data,
      skipDialog: skip,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.localize("CRUCESIGNATI.reaction.check"),
      title: game.i18n.localize("CRUCESIGNATI.reaction.check"),
    });
  }

  rollCheck(score, options = {}) {
    const label = game.i18n.localize(`CRUCESIGNATI.scores.${score}.long`);
    const rollParts = ["1d20"];

    const data = {
      actor: this,
      roll: {
        type: "check",
        target: this.system.scores[score].value,
      },

      details: game.i18n.format("CRUCESIGNATI.roll.details.attribute", {
        score: label,
      }),
    };

    let skip = options?.event?.ctrlKey || options.fastForward;

    // Roll and return
    return CrucesignatiDice.Roll({
      event: options.event,
      parts: rollParts,
      system: data,
      skipDialog: skip,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.format("CRUCESIGNATI.roll.attribute", { attribute: label }),
      title: game.i18n.format("CRUCESIGNATI.roll.attribute", { attribute: label }),
      chatMessage: options.chatMessage,
    });
  }

  rollHitDice(options = {}) {
    const label = game.i18n.localize(`CRUCESIGNATI.roll.hd`);
    const rollParts = [this.system.hp.hd];
    if (this.type === "character") {
      rollParts.push(this.system.scores.con.mod);
    }

    const data = {
      actor: this,
      roll: {
        type: "hitdice",
      },
    };

    // Roll and return
    return CrucesignatiDice.Roll({
      event: options.event,
      parts: rollParts,
      system: data,
      skipDialog: true,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: label,
      title: label,
    });
  }

  rollAppearing(options = {}) {
    const rollParts = [];
    let label = "";
    if (options.check === "wilderness") {
      rollParts.push(this.system.details.appearing.w);
      label = "(2)";
    } else {
      rollParts.push(this.system.details.appearing.d);
      label = "(1)";
    }
    const data = {
      actor: this,
      roll: {
        type: {
          type: "appearing",
        },
      },
    };

    // Roll and return
    return CrucesignatiDice.Roll({
      event: options.event,
      parts: rollParts,
      system: data,
      skipDialog: true,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.format("CRUCESIGNATI.roll.appearing", { type: label }),
      title: game.i18n.format("CRUCESIGNATI.roll.appearing", { type: label }),
    });
  }

  rollExploration(expl, options = {}) {
    const label = game.i18n.localize(`CRUCESIGNATI.exploration.${expl}.long`);
    const rollParts = ["1d6"];

    const data = {
      actor: this,
      roll: {
        type: "below",
        target: this.system.exploration[expl],
        blindroll: true,
      },
      details: game.i18n.format("CRUCESIGNATI.roll.details.exploration", {
        expl: label,
      }),
    };

    let skip = options.event && options.event.ctrlKey;

    // Roll and return
    return CrucesignatiDice.Roll({
      event: options.event,
      parts: rollParts,
      system: data,
      skipDialog: skip,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.format("CRUCESIGNATI.roll.exploration", { exploration: label }),
      title: game.i18n.format("CRUCESIGNATI.roll.exploration", { exploration: label }),
    });
  }

  rollDamage(attData, options = {}) {
    const data = this.system;

    const rollData = {
      actor: this,
      item: attData.item,
      roll: {
        type: "damage",
      },
    };

    let dmgParts = [];
    if (!attData.roll.dmg) {
      dmgParts.push("1d3");
    } else {
      dmgParts.push(attData.roll.dmg);
    }

    // Add Str to damage


    // Damage roll
    CrucesignatiDice.Roll({
      event: options.event,
      parts: dmgParts,
      system: rollData,
      skipDialog: true,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: `${attData.label} - ${game.i18n.localize("CRUCESIGNATI.Damage")}`,
      title: `${attData.label} - ${game.i18n.localize("CRUCESIGNATI.Damage")}`,
    });
  }

  async targetAttack(data, type, options) {
    if (game.user.targets.size > 0) {
      for (let t of game.user.targets.values()) {
        data.roll.target = t;
        await this.rollAttack(data, {
          type: type,
          skipDialog: options.skipDialog,
        });
      }
    } else {
      this.rollAttack(data, { type: type, skipDialog: options.skipDialog });
    }
  }

  rollAttack(attData, options = {}) {
    const data = this.system;
    const rollParts = ["1d20"];
    const dmgParts = [];
    let label = game.i18n.format("CRUCESIGNATI.roll.attacks", {
      name: this.name,
    });
    if (!attData.item) {
      dmgParts.push("1d3");
    } else {
      label = game.i18n.format("CRUCESIGNATI.roll.attacksWith", {
        name: attData.item.name,
      });
      dmgParts.push(attData.item.system.damage);
    }

    let ascending = game.settings.get("crucesignati", "ascendingAC");
    if (ascending) {
      rollParts.push(data.thac0.bba.toString());
    }
    if (options.type === "missile") {
      rollParts.push(
        data.scores.dex.mod.toString(),
        data.thac0.mod.missile.toString()
      );
    } else if (options.type === "melee") {
      rollParts.push(
        data.scores.str.mod.toString(),
        data.thac0.mod.melee.toString()
      );
    }
    // console.log(attData.item)
    if (attData.item && attData.item.system.bonus) {
      rollParts.push(attData.item.system.bonus);
    }
    // aggiungi il modificatore forza al danno
    let thac0 = data.thac0.value;
    if (options.type === "melee") {
      dmgParts.push(data.scores.str.mod2);
    }
    const rollData = {
      actor: this,
      item: attData.item,
      roll: {
        type: options.type,
        thac0: thac0,
        dmg: dmgParts,
        save: attData.roll.save,
        target: attData.roll.target,
      },
    };

    // Roll and return
    return CrucesignatiDice.Roll({
      event: options.event,
      parts: rollParts,
      system: rollData,
      skipDialog: options.skipDialog,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: label,
      title: label,
    });
  }

  async applyDamage(amount = 0, multiplier = 1) {
    amount = Math.floor(parseInt(amount) * multiplier);
    const hp = this.system.hp;

    // Remaining goes to health
    const dh = Math.clamped(hp.value - amount, 0, hp.max);

    // Update the Actor
    return this.update({
      "data.hp.value": dh,
    });
  }

  static _valueFromTable(table, val) {
    let output;
    for (let i = 0; i <= val; i++) {
      if (table[i] != undefined) {
        output = table[i];
      }
    }
    return output;
  }

  computeEncumbrance() {
    if (this.type != "character") {
      return;
    }
    const data = this.system;
    let option = game.settings.get("crucesignati", "encumbranceOption");
    const items = [...this.items.values()];
    // Compute encumbrance
    const hasItems = items.every((item) => {
      return item.type !== "item" && !item.system.treasure;
    });

    let totalWeight = items.reduce((acc, item) => {
      if (
        item.type === "item" &&
        (["complete", "disabled"].includes(option) || item.system.treasure)
      ) {
        return acc + item.system.quantity.value * item.system.weight;
      }
      if (["weapon", "armor", "container"].includes(item.type) && option !== "basic") {
        return acc + item.system.weight;
      }
      return acc;
    }, 0);
   
    const max = data.scores.str.mod3;

    let steps = [0.8 / max, 0.6 / max, 0.4 / max]


    data.encumbrance = {
      pct: Math.clamped((100 * parseFloat(totalWeight)) / max, 0, 100),
      max: max,
      encumbered: totalWeight > data.scores.str.mod3,
      value: totalWeight,
      steps: steps,
    };

    if (data.config.movementAuto && option != "disabled") {
      this._calculateMovement();
    }
  }

  _calculateMovement() {
    const data = this.system;
    let weight = data.encumbrance.value;
    let leggero = data.scores.str.mod4;
    let medio = data.scores.str.mod5;
    let pesante = data.scores.str.mod6;
    let severo = data.scores.str.mod3;
    if (data.details.race == "halfling" || data.details.race == "nano") {
      if (weight < leggero) {
        data.movement.base = 9
      } else if (weight > leggero && weight < medio) {
        data.movement.base = 8
      } else if (weight > medio && weight < pesante) {
        data.movement.base = 6
      } else if (weight > pesante && weight < severo) {
        data.movement.base = 4
      } else if (weight >= severo) {
        data.movement.base = 2
      }
      } else { 
        if (weight < leggero) {
          data.movement.base = 12
        } else if (weight > leggero && weight < medio) {
          data.movement.base = 11
        } else if (weight > medio && weight < pesante) {
          data.movement.base = 8
        } else if (weight > pesante && weight < severo) {
          data.movement.base = 5
        } else if (weight >= severo) {
          data.movement.base = 2
        }
      } 
  }

  computeTreasure() {
    if (this.type !== "character") {
      return;
    }
    const data = this.system;
    // Compute treasure
    let total = 0;
    let treasure = this.items.filter(
      (i) => i.type === "item" && i.system.treasure
    );
    treasure.forEach((item) => {
      total += item.system.quantity.value * item.system.cost;
    });
    data.treasure = Math.round(total * 100) / 100.0;
  }

  computeAC() {
    if (this.type !== "character") {
      return;
    }
    const data = this.system;

// Compute AC
let baseAc = 10;
let baseAac = 10;
let AcShield = 0;
let AacShield = 0;

data.aac.naked = baseAac + data.scores.dex.mod;
data.ac.naked = baseAc + data.scores.dex.mod2;
const armors = this.items.filter((i) => i.type === "armor");
armors.forEach((a) => {
  const armorData = a.system;
  if (!armorData.equipped) return;
  if (armorData.type === "shield") {
    AcShield = armorData.ac.value;
    AacShield = armorData.aac.value;
    return
  }
  baseAc = armorData.ac.value;
  baseAac = armorData.aac.value;
});
data.aac.value = baseAac + data.scores.dex.mod + AacShield + data.aac.mod;
data.ac.value = baseAc + data.scores.dex.mod2 - AcShield - data.ac.mod;
data.ac.shield = AcShield;
data.aac.shield = AacShield;
}

  computeModifiers() {
    if (this.type !== "character") {
      return;
    }
    const data = this.system;
    //Non la uso perchè ho modificato manualmente
    const standard = {
      0: -3,
      3: -3,
      4: -2,
      6: -1,
      9: 0,
      13: 1,
      16: 2,
      18: 3,
    };
//Modifica al colpire in mischia
if (data.details.straordinaryStrenght === 0) {
  data.scores.str.mod = CrucesignatiActor._valueFromTable(
    {
      1: -5,
      2: -3,
      3: -3,
      4: -2,
      6: -1,
      8: 0,
      13: 1,
      18: 1,
    },
    data.scores.str.value
  );
}  else {
  data.scores.str.mod = CrucesignatiActor._valueFromTable(
    {
      1: 1,
      51: 2,
      100: 3,
    },
    data.details.straordinaryStrenght
  );
};
//Modifica ai danni in mischia
if (data.details.straordinaryStrenght === 0) {
  data.scores.str.mod2 = CrucesignatiActor._valueFromTable(
    {
      1: -2,
      2: -2,
      3: -1,
      6: 0,
      16: 1,
      18: 2,
    },
    data.scores.str.value
  );
}  else {
  data.scores.str.mod2 = CrucesignatiActor._valueFromTable(
    {
      1: 3,
      76: 4,
      91: 5,
      100: 6,
    },
    data.details.straordinaryStrenght
  );
};

//Ingombro leggero in base alla For
if (data.details.straordinaryStrenght === 0) {
  data.scores.str.mod4 = CrucesignatiActor._valueFromTable(
    {
      1: 5,
      6: 10,
      8: 18,
      10: 20,
      12: 23,
      14: 29,
      16: 36,
      17: 43,
      18: 55
    },
    data.scores.str.value
  );
}  else {
  data.scores.str.mod4 = CrucesignatiActor._valueFromTable(
    {
      1: 67,
      51: 78,
      76: 89,
      91: 112,
      100: 157
    },
    data.details.straordinaryStrenght
  );
};

//Ingombro medio in base alla For
if (data.details.straordinaryStrenght === 0) {
  data.scores.str.mod5 = CrucesignatiActor._valueFromTable(
    {
      1: 6,
      6: 15,
      8: 24,
      10: 29,
      12: 34,
      14: 43,
      16: 49,
      17: 60,
      18: 73
    },
    data.scores.str.value
  );
}  else {
  data.scores.str.mod5 = CrucesignatiActor._valueFromTable(
    {
      1: 84,
      51: 96,
      76: 107,
      91: 130,
      100: 157
    },
    data.details.straordinaryStrenght
  );
};

//Ingombro pesante in base alla For
if (data.details.straordinaryStrenght === 0) {
  data.scores.str.mod6 = CrucesignatiActor._valueFromTable(
    {
      1: 8,
      6: 19,
      8: 27,
      10: 37,
      12: 46,
      14: 57,
      16: 63,
      17: 77,
      18: 91
    },
    data.scores.str.value
  );
}  else {
  data.scores.str.mod6 = CrucesignatiActor._valueFromTable(
    {
      1: 102,
      51: 114,
      76: 125,
      91: 148,
      100: 193
    },
    data.details.straordinaryStrenght
  );
};

//Massima capacità di carico (ingombro), in base alla For
if (data.details.straordinaryStrenght === 0) {
  data.scores.str.mod3 = CrucesignatiActor._valueFromTable(
    {
      1: 9,
      6: 23,
      8: 38,
      10: 45,
      12: 57,
      14: 70,
      16: 77,
      17: 95,
      18: 111
    },
    data.scores.str.value
  );
}  else {
  data.scores.str.mod3 = CrucesignatiActor._valueFromTable(
    {
      1: 122,
      51: 133,
      76: 145,
      91: 165,
      100: 213
    },
    data.details.straordinaryStrenght
  );
};
//Massimo livello di incantesimi
    data.scores.int.mod = CrucesignatiActor._valueFromTable(
      {
        9: 4,
        10: 5,
        12: 6,
        14: 7,
        16: 8,
        18: 9
      },
      data.scores.int.value
    );
//percentuale di apprendimento incantesimi
    data.scores.int.mod2 = CrucesignatiActor._valueFromTable(
      {
        9: 35,
        10: 40,
        11: 45,
        12: 50,
        13: 55,
        14: 60,
        15: 65,
        16: 70,
        17: 75,
        18: 85
      },
      data.scores.int.value
    );
//Massimo numero di incantesimi per livello
data.scores.int.mod3 = CrucesignatiActor._valueFromTable(
  {
    9: 6,
    10: 7,
    13: 9,
    15: 11,
    17: 14,
    18: 18
  },
  data.scores.int.value
);
//Modificatore al colpire a distanza
    data.scores.dex.mod = CrucesignatiActor._valueFromTable(
      {
        1: -6,
        2: -4,
        3: -3,
        4: -2,
        5: -1,
        6: 0,
        16: 1,
        17: 2,
        18: 2
      },
      data.scores.dex.value
    );
//Modificatore alla CA
data.scores.dex.mod2 = CrucesignatiActor._valueFromTable(
  {
    1: 5,
    3: 4,
    4: 3,
    5: 2,
    6: 1,
    7: 0,
    15: -1,
    16: -2,
    17: -3,
    18: -4
  },
  data.scores.dex.value
);
//Moifica al morale e ai tiri reazione
    data.scores.cha.mod = CrucesignatiActor._valueFromTable(
      {
        1: -5,
        5: -4,
        7: -2,
        9: -1,
        13: 1,
        16: 2,
        18: 3
      },
      data.scores.cha.value
    );
//Massimo numero di seguaci    
    data.scores.cha.mod2 = CrucesignatiActor._valueFromTable(
      {
        1: 1,
        5: 2,
        7: 3,
        9: 4,
        13: 5,
        16: 6,
        18: 7
      },
      data.scores.cha.value
    );
//Modificatori ai TS contro magia
    data.scores.wis.mod = CrucesignatiActor._valueFromTable(
      {
        1: -6,
        2: -4,
        3: -3,
        4: -2,
        5: -1,
        8: 0,
        15: 1,
        16: 2,
        17: 3,
        18: 4
      },
      data.scores.wis.value
    );

// 5% Bonus ai PX per la Saggezza
data.scores.wis.mod3 = CrucesignatiActor._valueFromTable(
  {
    13: 5
  },
  data.scores.wis.value
);
//Percentuale di fallimento incantesimi divini
data.scores.wis.mod2 = CrucesignatiActor._valueFromTable(
  {
    1: 80,
    2: 70,
    3: 60,
    4: 50,
    5: 40,
    6: 35,
    7: 30,
    8: 25,
    9: 20,
    10: 15,
    11: 10,
    12: 5
  },
  data.scores.wis.value
);
//Modifica ai PF
if (data.details.class === "guerriero") {
	data.scores.con.mod = CrucesignatiActor._valueFromTable(
      {
        1: -3,
        2: -2,
        4: -1,
        7: 0,
        15: 1,
        16: 2,
		    17: 2,
		    18: +4
      },
      data.scores.con.value
    );
	} else {
	data.scores.con.mod = CrucesignatiActor._valueFromTable(
      {
        1: -3,
        2: -2,
        4: -1,
        7: 0,
        15: 1,
        16: 2
      },
      data.scores.con.value
    );
};
//Bonus ai TS contro veleni
data.scores.con.mod2 = CrucesignatiActor._valueFromTable(
  {
    1: -2,
    2: -1,
    4: 0
  },
  data.scores.con.value
);
    const capped = {
      0: -2,
      3: -2,
      4: -1,
      6: -1,
      9: 0,
      13: 1,
      16: 1,
      18: 2,
    };
//Modifiche all'iniziativa in base alla Destrezza
    data.scores.dex.init = CrucesignatiActor._valueFromTable(
      {
        1: 5,
        3: 4,
        4: 3,
        5: 2,
        6: 1,
        7: 0,
        15: -1,
        16: -2,
        17: -3,
        18: -4
      },
      data.scores.dex.value
    );
    data.scores.cha.npc = CrucesignatiActor._valueFromTable(
      capped,
      data.scores.cha.value
    );
    data.scores.cha.retain = data.scores.cha.mod2;
    data.scores.cha.loyalty = data.scores.cha.mod + 7;

    const od = {
      0: 0,
      1: 1,
      8: 2,
      16: 3,
      17: 4,
      18: 5
    };
    //Tiro per sfondare porte
    data.exploration.odMod = CrucesignatiActor._valueFromTable(
      od,
      data.scores.str.value
    );

    const literacy = {
      0: "",
      3: "CRUCESIGNATI.Illiterate",
      6: "CRUCESIGNATI.LiteracyBasic",
      9: "CRUCESIGNATI.Literate",
    };
    data.languages.literacy = CrucesignatiActor._valueFromTable(
      literacy,
      data.scores.int.value
    );

    const spoken = {
      0: "CRUCESIGNATI.NativeBroken",
      3: "CRUCESIGNATI.Native",
      13: "CRUCESIGNATI.NativePlus1",
      16: "CRUCESIGNATI.NativePlus2",
      18: "CRUCESIGNATI.NativePlus3",
    };
    data.languages.spoken = CrucesignatiActor._valueFromTable(
      spoken,
      data.scores.int.value
    );
  }
}
