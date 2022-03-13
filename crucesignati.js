// Import Modules
import { CrucesignatiItemSheet } from "./module/item/item-sheet.js";
import { CrucesignatiActorSheetCharacter } from "./module/actor/character-sheet.js";
import { CrucesignatiActorSheetMonster } from "./module/actor/monster-sheet.js";
import { preloadHandlebarsTemplates } from "./module/preloadTemplates.js";
import { CrucesignatiActor } from "./module/actor/entity.js";
import { CrucesignatiItem } from "./module/item/entity.js";
import { CRUCESIGNATI } from "./module/config.js";
import { registerSettings } from "./module/settings.js";
import { registerHelpers } from "./module/helpers.js";
import * as chat from "./module/chat.js";
import * as treasure from "./module/treasure.js";
import * as macros from "./module/macros.js";
import * as party from "./module/party.js";
import { CrucesignatiCombat } from "./module/combat.js";
import * as renderList from "./module/renderList.js";

/* -------------------------------------------- */
/*  Foundry VTT Initialization                  */
/* -------------------------------------------- */

Hooks.once("init", async function () {
  /**
   * Set an initiative formula for the system
   * @type {String}
   */
  CONFIG.Combat.initiative = {
    formula: "1d10 + @initiative.value + @speed",
    decimals: 2,
  };

  CONFIG.CRUCESIGNATI = CRUCESIGNATI;

  game.crucesignati = {
    rollItemMacro: macros.rollItemMacro,
  };

  // Custom Handlebars helpers
  registerHelpers();

  // Register custom system settings
  registerSettings();

  CONFIG.Actor.documentClass = CrucesignatiActor;
  CONFIG.Item.documentClass = CrucesignatiItem;

  // Register sheet application classes
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("crucesignati", CrucesignatiActorSheetCharacter, {
    types: ["character"],
    makeDefault: true,
    label: "CRUCESIGNATI.SheetClassCharacter"
  });
  Actors.registerSheet("crucesignati", CrucesignatiActorSheetMonster, {
    types: ["monster"],
    makeDefault: true,
    label: "CRUCESIGNATI.SheetClassMonster"
  });

  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("crucesignati", CrucesignatiItemSheet, {
    makeDefault: true,
    label: "CRUCESIGNATI.SheetClassItem"
  });

  await preloadHandlebarsTemplates();
});

/**
 * This function runs after game data has been requested and loaded from the servers, so entities exist
 */
Hooks.once("setup", function () {
  // Localize CONFIG objects once up-front
  const toLocalize = ["saves_short", "saves_long", "scores", "armor", "colors", "tags"];
  for (let o of toLocalize) {
    CONFIG.CRUCESIGNATI[o] = Object.entries(CONFIG.CRUCESIGNATI[o]).reduce((obj, e) => {
      obj[e[0]] = game.i18n.localize(e[1]);
      return obj;
    }, {});
  }

  // Custom languages
  const languages = game.settings.get("crucesignati", "languages");
  if (languages != "") {
    const langArray = languages.split(',');
    langArray.forEach((l, i) => langArray[i] = l.trim())
    CONFIG.CRUCESIGNATI.languages = langArray;
  }
});

Hooks.once("ready", async () => {
  Hooks.on("hotbarDrop", (bar, data, slot) =>
    macros.createCrucesignatiMacro(data, slot)
  );
});

// License and KOFI infos
Hooks.on("renderSidebarTab", async (object, html) => {
  if (object instanceof ActorDirectory) {
    party.addControl(object, html);
  }
  if (object instanceof Settings) {
    let gamesystem = html.find("#game-details");
    // SRD Link
    let crucesignati = gamesystem.find('h4').last();
    crucesignati.append(` <sub><a href="https://www.crucesignati.eu">SRD<a></sub>`);

    // License text
    const template = "systems/crucesignati/templates/chat/license.html";
    const rendered = await renderTemplate(template);
    gamesystem.find(".system").append(rendered);

    // User guide
    let docs = html.find("button[data-action='docs']");
    const styling = "border:none;margin-right:2px;vertical-align:middle;margin-bottom:5px";
    $(`<button data-action="userguide"><img src='/systems/crucesignati/assets/dragon.png' width='16' height='16' style='${styling}'/>Old School Guide</button>`).insertAfter(docs);
    html.find('button[data-action="userguide"]').click(ev => {
      new FrameViewer('https://www.crucesignati.eu', { resizable: true }).render(true);
    });
  }
});

Hooks.on("preCreateCombatant", (combat, data, options, id) => {
  let init = game.settings.get("crucesignati", "initiative");
  if (init == "group") {
    CrucesignatiCombat.addCombatant(combat, data, options, id);
  }
});

Hooks.on("updateCombatant", CrucesignatiCombat.updateCombatant);
Hooks.on("renderCombatTracker", CrucesignatiCombat.format);
Hooks.on("preUpdateCombat", CrucesignatiCombat.preUpdateCombat);
Hooks.on("getCombatTrackerEntryContext", CrucesignatiCombat.addContextEntry);

Hooks.on("renderChatLog", (app, html, data) => CrucesignatiItem.chatListeners(html));
Hooks.on("getChatLogEntryContext", chat.addChatMessageContextOptions);
Hooks.on("renderChatMessage", chat.addChatMessageButtons);
Hooks.on("renderRollTableConfig", treasure.augmentTable);
Hooks.on("updateActor", party.update);

Hooks.on("renderCompendium", renderList.RenderCompendium);
Hooks.on("renderSidebarDirectory", renderList.RenderDirectory);