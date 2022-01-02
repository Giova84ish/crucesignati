export const registerSettings = function () {

  game.settings.register("crucesignati", "initiative", {
    name: game.i18n.localize("CRUCESIGNATI.Setting.Initiative"),
    hint: game.i18n.localize("CRUCESIGNATI.Setting.InitiativeHint"),
    default: "individual",
    scope: "world",
    type: String,
    config: false,
    choices: {
      individual: "CRUCESIGNATI.Setting.InitiativeIndividual"
    },
    onChange: _ => window.location.reload()
  });

  game.settings.register("crucesignati", "rerollInitiative", {
    name: game.i18n.localize("CRUCESIGNATI.Setting.RerollInitiative"),
    hint: game.i18n.localize("CRUCESIGNATI.Setting.RerollInitiativeHint"),
    default: "reset",
    scope: "world",
    type: String,
    config: true,
    choices: {
      keep: "CRUCESIGNATI.Setting.InitiativeKeep",
      reset: "CRUCESIGNATI.Setting.InitiativeReset",
      reroll: "CRUCESIGNATI.Setting.InitiativeReroll",
    }
  });

  game.settings.register("crucesignati", "ascendingAC", {
    name: game.i18n.localize("CRUCESIGNATI.Setting.AscendingAC"),
    hint: game.i18n.localize("CRUCESIGNATI.Setting.AscendingACHint"),
    default: false,
    scope: "world",
    type: Boolean,
    config: false,
    onChange: _ => window.location.reload()
  });

  game.settings.register("crucesignati", "morale", {
    name: game.i18n.localize("CRUCESIGNATI.Setting.Morale"),
    hint: game.i18n.localize("CRUCESIGNATI.Setting.MoraleHint"),
    default: false,
    scope: "world",
    type: Boolean,
    config: true,
  });

  game.settings.register("crucesignati", "encumbranceOption", {
    name: game.i18n.localize("CRUCESIGNATI.Setting.Encumbrance"),
    hint: game.i18n.localize("CRUCESIGNATI.Setting.EncumbranceHint"),
    default: "complete",
    scope: "world",
    type: String,
    config: false,
    choices: {
      disabled: "CRUCESIGNATI.Setting.EncumbranceDisabled",
      basic: "CRUCESIGNATI.Setting.EncumbranceBasic",
      detailed: "CRUCESIGNATI.Setting.EncumbranceDetailed",
      complete: "CRUCESIGNATI.Setting.EncumbranceComplete",
    },
    onChange: _ => window.location.reload()
  });

  game.settings.register("crucesignati", "significantTreasure", {
    name: game.i18n.localize("CRUCESIGNATI.Setting.SignificantTreasure"),
    hint: game.i18n.localize("CRUCESIGNATI.Setting.SignificantTreasureHint"),
    default: 800,
    scope: "world",
    type: Number,
    config: true,
    onChange: _ => window.location.reload()
  });

  game.settings.register("crucesignati", "languages", {
    name: game.i18n.localize("CRUCESIGNATI.Setting.Languages"),
    hint: game.i18n.localize("CRUCESIGNATI.Setting.LanguagesHint"),
    default: "",
    scope: "world",
    type: String,
    config: true,
    onChange: _ => window.location.reload()
  });
};
