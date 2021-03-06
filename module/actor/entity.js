import { CrucesignatiDice } from "../dice.js";
import { CrucesignatiItem } from "../item/entity.js";

export class CrucesignatiActor extends Actor {
  /**
   * Extends data from base Actor class
   */

  prepareData() {
    super.prepareData();
    const data = this.data.data;

    // Compute modifiers from actor scores
    this.computeModifiers();
    this._isSlow();
    this.computeAC();
    this.computeEncumbrance();
    this.computeTreasure();

    // Determine Initiative
    if (this.data.type == "character") {
      data.initiative.value += data.scores.dex.mod2;
    } else {
      data.initiative.value = 0;
    }
    
    
    data.movement.encounter = data.movement.base;
  }

  static async update(data, options = {}) {
    // Compute AAC from AC
    if (data.data?.ac?.value) {
      data.data.aac = { value: 19 - data.data.ac.value };
    } else if (data.data?.aac?.value) {
      data.data.ac = { value: 19 - data.data.aac.value };
    }

    // Compute Attacco from BBA
    if (data.data?.thac0?.value) {
      data.data.thac0.bba = 19 - data.data.thac0.value;
    } else if (data.data?.thac0?.bba) {
      data.data.thac0.value = 19 - data.data.thac0.bba;
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
    if (this.data.type != "character") {
      return;
    }
    let modified = Math.floor(
      value + (this.data.data.details.xp.bonus * value) / 100
    );
    return this.update({
      "data.details.xp.value": modified + this.data.data.details.xp.value,
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
    const data = this.data.data;
    if (this.data.type == "character") {
      let ct = 0;
      Object.values(data.scores).forEach((el) => {
        ct += el.value;
      });
      return ct == 0 ? true : false;
    } else if (this.data.type == "monster") {
      let ct = 0;
      Object.values(data.saves).forEach((el) => {
        ct += el.value;
      });
      return ct == 0 ? true : false;
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
    let roll = new Roll(this.data.data.hp.hd).roll({ async: false });
    return this.update({
      data: {
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
      actor: this.data,
      roll: {
        type: "above",
        target: this.data.data.saves[save].value,
        magic:
          this.data.type === "character" ? this.data.data.scores.wis.mod : 0,
      },
      details: game.i18n.format("CRUCESIGNATI.roll.details.save", { save: label }),
    };

    let skip = options?.event?.ctrlKey || options.fastForward;

    const rollMethod =
      this.data.type == "character" ? CrucesignatiDice.RollSave : CrucesignatiDice.Roll;

    // Roll and return
    return rollMethod({
      event: options.event,
      parts: rollParts,
      data: data,
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
      actor: this.data,
      roll: {
        type: "below",
        target: this.data.data.details.morale,
      },
    };

    // Roll and return
    return CrucesignatiDice.Roll({
      event: options.event,
      parts: rollParts,
      data: data,
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
      actor: this.data,
      roll: {
        type: "below",
        target: this.data.data.retainer.loyalty,
      },
    };

    // Roll and return
    return CrucesignatiDice.Roll({
      event: options.event,
      parts: rollParts,
      data: data,
      skipDialog: true,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: label,
      title: label,
    });
  }

  rollReaction(options = {}) {
    const rollParts = ["2d6"];

    const data = {
      actor: this.data,
      roll: {
        type: "table",
        table: {
          2: game.i18n.format("CRUCESIGNATI.reaction.Hostile", {
            name: this.data.name,
          }),
          3: game.i18n.format("CRUCESIGNATI.reaction.Unfriendly", {
            name: this.data.name,
          }),
          6: game.i18n.format("CRUCESIGNATI.reaction.Neutral", {
            name: this.data.name,
          }),
          9: game.i18n.format("CRUCESIGNATI.reaction.Indifferent", {
            name: this.data.name,
          }),
          12: game.i18n.format("CRUCESIGNATI.reaction.Friendly", {
            name: this.data.name,
          }),
        },
      },
    };

    let skip = options.event && options.event.ctrlKey;

    // Roll and return
    return CrucesignatiDice.Roll({
      event: options.event,
      parts: rollParts,
      data: data,
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
      actor: this.data,
      roll: {
        type: "check",
        target: this.data.data.scores[score].value,
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
      data: data,
      skipDialog: skip,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.format("CRUCESIGNATI.roll.attribute", { attribute: label }),
      title: game.i18n.format("CRUCESIGNATI.roll.attribute", { attribute: label }),
      chatMessage: options.chatMessage,
    });
  }

  rollHitDice(options = {}) {
    const label = game.i18n.localize(`CRUCESIGNATI.roll.hd`);
    const rollParts = [this.data.data.hp.hd];
    if (this.data.type == "character") {
      rollParts.push(this.data.data.scores.con.mod);
    }

    const data = {
      actor: this.data,
      roll: {
        type: "hitdice",
      },
    };

    // Roll and return
    return CrucesignatiDice.Roll({
      event: options.event,
      parts: rollParts,
      data: data,
      skipDialog: true,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: label,
      title: label,
    });
  }

  rollAppearing(options = {}) {
    const rollParts = [];
    let label = "";
    if (options.check == "wilderness") {
      rollParts.push(this.data.data.details.appearing.w);
      label = "(2)";
    } else {
      rollParts.push(this.data.data.details.appearing.d);
      label = "(1)";
    }
    const data = {
      actor: this.data,
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
      data: data,
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
      actor: this.data,
      roll: {
        type: "below",
        target: this.data.data.exploration[expl],
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
      data: data,
      skipDialog: skip,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.format("CRUCESIGNATI.roll.exploration", { exploration: label }),
      title: game.i18n.format("CRUCESIGNATI.roll.exploration", { exploration: label }),
    });
  }

  rollDamage(attData, options = {}) {
    const data = this.data.data;

    const rollData = {
      actor: this.data,
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
      data: rollData,
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
    const data = this.data.data;
    const rollParts = ["1d20"];
    const dmgParts = [];
    let label = game.i18n.format("CRUCESIGNATI.roll.attacks", {
      name: this.data.name,
    });
    if (!attData.item) {
      dmgParts.push("1d3");
    } else {
      label = game.i18n.format("CRUCESIGNATI.roll.attacksWith", {
        name: attData.item.name,
      });
      dmgParts.push(attData.item.data.damage);
    }

    let ascending = game.settings.get("crucesignati", "ascendingAC");
    if (ascending) {
      rollParts.push(data.thac0.bba.toString());
    }
    if (options.type == "missile") {
      rollParts.push(
        data.scores.dex.mod.toString(),
        data.thac0.mod.missile.toString()
      );
    } else if (options.type == "melee") {
      rollParts.push(
        data.scores.str.mod.toString(),
        data.thac0.mod.melee.toString()
      );
    }
    if (attData.item && attData.item.data.bonus) {
      rollParts.push(attData.item.data.bonus);
    }
    // aggiungi il modificatore forza al danno
    let thac0 = data.thac0.value;
    if (options.type == "melee") {
      dmgParts.push(data.scores.str.mod2);
    }
    const rollData = {
      actor: this.data,
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
      data: rollData,
      skipDialog: options.skipDialog,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: label,
      title: label,
    });
  }

  async applyDamage(amount = 0, multiplier = 1) {
    amount = Math.floor(parseInt(amount) * multiplier);
    const hp = this.data.data.hp;

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

  _isSlow() {
    this.data.data.isSlow = ![...this.data.items.values()].every((item) => {
      if (
        item.type !== "weapon" ||
        !item.data.data.slow ||
        !item.data.data.equipped
      ) {
        return true;
      }
      return false;
    });
  }

  computeEncumbrance() {
    if (this.data.type != "character") {
      return;
    }
    const data = this.data.data;
    let option = game.settings.get("crucesignati", "encumbranceOption");
    const items = [...this.data.items.values()];
    // Compute encumbrance
    const hasItems = items.every((item) => {
      return item.type != "item" && !item.data.treasure;
    });

    let totalWeight = items.reduce((acc, item) => {
      if (
        item.type === "item" &&
        (["complete", "disabled"].includes(option) || item.data.data.treasure)
      ) {
        return acc + item.data.data.quantity.value * item.data.data.weight;
      }
      if (["weapon", "armor", "container"].includes(item.type) && option !== "basic") {
        return acc + item.data.data.weight;
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
    const data = this.data.data;
    let weight = data.encumbrance.value;
    if (weight > data.scores.str.mod3) {
        if (data.details.race == "hobbit" || data.details.race == "nano") {
          data.movement.base = 4.5;    
        } else {
          data.movement.base = 6;
        }    
      } else {
        if (data.details.race == "hobbit" || data.details.race == "nano"){
          data.movement.base = 9;
        } else{
          data.movement.base = 12;
        }        
      } 
  }

  computeTreasure() {
    if (this.data.type != "character") {
      return;
    }
    const data = this.data.data;
    // Compute treasure
    let total = 0;
    let treasure = this.data.items.filter(
      (i) => i.type == "item" && i.data.data.treasure
    );
    treasure.forEach((item) => {
      total += item.data.data.quantity.value * item.data.data.cost;
    });
    data.treasure = Math.round(total * 100) / 100.0;
  }

  computeAC() {
    if (this.data.type != "character") {
      return;
    }
    const data = this.data.data;

// Compute AC
let baseAc = 10;
let baseAac = 10;
let AcShield = 0;
let AacShield = 0;

data.aac.naked = baseAac + data.scores.dex.mod;
data.ac.naked = baseAc + data.scores.dex.mod2;
const armors = this.data.items.filter((i) => i.type == "armor");
armors.forEach((a) => {
  const armorData = a.data.data;
  if (!armorData.equipped) return;
  if (armorData.type == "shield") {
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
    if (this.data.type != "character") {
      return;
    }
    const data = this.data.data;

    //Non la uso perch?? ho modificato manualmente
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
if (data.details.straordinaryStrenght == 0) {
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
if (data.details.straordinaryStrenght == 0) {
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


//Massima capacit?? di carico (ingombro), in base alla For
if (data.details.straordinaryStrenght == 0) {
  data.scores.str.mod3 = CrucesignatiActor._valueFromTable(
    {
      1: 1,
      3: 2.5,
      4: 5,
      6: 9,
      8: 18,
      11: 20,
      13: 25,
      16: 30,
      17: 40,
      18: 50
    },
    data.scores.str.value
  );
}  else {
  data.scores.str.mod3 = CrucesignatiActor._valueFromTable(
    {
      1: 60,
      51: 70,
      76: 80,
      91: 100,
      100: 150
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
