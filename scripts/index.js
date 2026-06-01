import * as mc from "@minecraft/server";
import * as ui from "@minecraft/server-ui";

// ─────────────────────────────────────────────────────────────
// Variabel Global
// ─────────────────────────────────────────────────────────────
const waypoints = new Map();
function getWaypoints(playerName) {
  try {
    var data = mc.world.getDynamicProperty("wp_global");
    if (typeof data === "string") return JSON.parse(data);
  } catch(e) {}
  return waypoints.get("global") || [];
}
function saveWaypoints(playerName, list) {
  try {
    mc.world.setDynamicProperty("wp_global", JSON.stringify(list));
  } catch(e) {}
  waypoints.set("global", list);
}

// ─────────────────────────────────────────────────────────────
// Auto-Rename System (Saat Item Dipegang)
// ─────────────────────────────────────────────────────────────
mc.system.runInterval(() => {
  for (const player of mc.world.getAllPlayers()) {
    try {
      const eq = player.getComponent("equippable");
      if (eq) {
        const mainhand = eq.getEquipment("Mainhand");
        if (mainhand) {
          let expectedName = null;
          if (mainhand.typeId === "minecraft:clock") expectedName = "§aWorld Control";
          else if (mainhand.typeId === "minecraft:compass") expectedName = "§bWaypoint";
          else if (mainhand.typeId === "minecraft:recovery_compass") expectedName = "§cTitik Mati";
          else if (mainhand.typeId === "minecraft:book") expectedName = "§eAdmin Menu";

          if (expectedName && mainhand.nameTag !== expectedName) {
            // HARUS DICLONE KARENA ITEMSTACK BISA BERSIFAT READ-ONLY
            const newHand = mainhand.clone();
            newHand.nameTag = expectedName;
            eq.setEquipment("Mainhand", newHand);
          }
        }
      }
    } catch (e) {}
  }
}, 10);

// ─────────────────────────────────────────────────────────────
// Rekam Titik Kematian (Death Point)
// ─────────────────────────────────────────────────────────────
mc.world.afterEvents.entityDie.subscribe((event) => {
  if (event.deadEntity.typeId === "minecraft:player") {
    const player = event.deadEntity;
    const loc = player.location;
    player.setDynamicProperty("last_death_x", loc.x);
    player.setDynamicProperty("last_death_y", loc.y);
    player.setDynamicProperty("last_death_z", loc.z);
  }
});

// ─────────────────────────────────────────────────────────────
// Event Listener Utama (Penggunaan Item)
// ─────────────────────────────────────────────────────────────
function processToolUse(player, item) {
  if (!item) return false;
  
  if (item.typeId === "minecraft:clock") {
    mc.system.runTimeout(() => { showWorldControlForm(player); }, 5);
    return true;
  }
  else if (item.typeId === "minecraft:compass") {
    mc.system.runTimeout(() => { showWaypointForm(player); }, 5);
    return true;
  }
  else if (item.typeId === "minecraft:recovery_compass") {
    mc.system.runTimeout(() => { showDeathPointForm(player); }, 5);
    return true;
  }
  else if (item.typeId === "minecraft:book") {
    mc.system.runTimeout(() => { showAdminMenuForm(player); }, 5);
    return true;
  }
  return false;
}

// 1. Saat Klik Kanan (Use / Tahan Layar)
mc.world.beforeEvents.itemUse.subscribe((event) => {
  if (processToolUse(event.source, event.itemStack)) {
    event.cancel = true;
  }
});

// 2. Saat Klik Kanan ke Block
if (mc.world.beforeEvents.itemUseOn) {
  mc.world.beforeEvents.itemUseOn.subscribe((event) => {
    if (processToolUse(event.source, event.itemStack)) {
      event.cancel = true;
    }
  });
}

// 3. Saat Klik Kiri (Pukul Angin/Block) - Agar item seperti Recovery Compass yang tidak punya "Use" tetap bisa dibuka
mc.world.afterEvents.entityHitBlock.subscribe((event) => {
  if (event.damagingEntity.typeId === "minecraft:player") {
    const player = event.damagingEntity;
    try {
      const eq = player.getComponent("equippable");
      if (eq) {
        const item = eq.getEquipment("Mainhand");
        processToolUse(player, item);
      }
    } catch(e) {}
  }
});
mc.world.afterEvents.entityHitEntity.subscribe((event) => {
  if (event.damagingEntity.typeId === "minecraft:player") {
    const player = event.damagingEntity;
    try {
      const eq = player.getComponent("equippable");
      if (eq) {
        const item = eq.getEquipment("Mainhand");
        processToolUse(player, item);
      }
    } catch(e) {}
  }
});


// ─────────────────────────────────────────────────────────────
// 1. Waypoint System (Compass)
// ─────────────────────────────────────────────────────────────
var emojiIcons = ["\uE108","\uE109","\uE10A","\uE10B","\uE101","\uE017","\uE100","\uE10C","\uE102","\uE105","\uE0A0","\uE0A1","\uE060","\uE061","\uE062","\uE063","\uE070","\uE071","\uE072","\uE073","\uE080","\uE081","\uE082","\uE083","\uE084","\uE085","\uE089","\uE08A","\uE08B","\uE064","\uE014","\uE015","\uE016","\uE08C","\uE08D","\uE08E","\uE08F","\uE018","\uE019","\uE01A","\uE01B","\uE01C","\uE01D","\uE086","\uE087","\uE088","\uE05A","\uE059","\uE05B","\uE05C"];
var emojiNames = ["\uE108 Wooden Pickaxe","\uE109 Wooden Sword","\uE10A Crafting Table","\uE10B Furnace","\uE101 Armor","\uE017 Crosshair","\uE100 Food","\uE10C Heart","\uE102 Minecoin","\uE105 Token","\uE0A0 Craftable Toggle On","\uE0A1 Craftable Toggle Off","\uE060 Mouse Left Button","\uE061 Mouse Right Button","\uE062 Mouse Middle Button","\uE063 Mouse Button","\uE070 Light Mouse Left Button","\uE071 Light Mouse Right Button","\uE072 Light Mouse Middle Button","\uE073 Light Mouse Button","\uE080 Forward","\uE081 Left","\uE082 Back","\uE083 Right","\uE084 Jump","\uE085 Sneak","\uE089 Emote","\uE08A Chat","\uE08B Pause","\uE064 Sprint","\uE014 Jump","\uE015 Attack","\uE016 Joystick","\uE08C Joystick Forward","\uE08D Joystick Left","\uE08E Joystick Back","\uE08F Joystick Right","\uE018 Place","\uE019 Sneak","\uE01A Sprint","\uE01B Fly Up","\uE01C Fly Down","\uE01D Dismount","\uE086 Fly Up","\uE087 Fly Down","\uE088 Stop Flying","\uE05A Small Sneak","\uE059 Small Jump","\uE05B Small Inventory","\uE05C Small Fly Up"];

function showWaypointForm(player) {
  var userWaypoints = getWaypoints(player.name);
  var form = new ui.ActionFormData()
    .title("§d§l\uE10A Menu Waypoint")
    .body("Pilih aksi untuk lokasi teleportasi:")
    .button("§a\uE10B Buat Waypoint Baru")
    .button("§d\uE109 Daftar Waypoint (" + userWaypoints.length + ")")
    .button("§c\uE015 Kelola Waypoint");

  form.show(player).then(function(res) {
    if (res.canceled) return;
    if (res.selection === 0) showCreateWaypointForm(player);
    else if (res.selection === 1) showWaypointListForm(player);
    else if (res.selection === 2) showManageWaypointForm(player);
  });
}

function showCreateWaypointForm(player) {
  var form = new ui.ModalFormData()
    .title("§a§lBuat Waypoint Baru")
    .textField("§bNama Lokasi:", "Misal: Rumah, Tambang, dll")
    .dropdown("§ePilih Ikon UI Bedrock:", Array.from(emojiNames));

  form.show(player).then(function(res) {
    if (res.canceled) return;
    var name = res.formValues[0] || "Lokasi Rahasia";
    var iconIdx = res.formValues[1];
    var loc = player.location;
    var list = getWaypoints(player.name);
    var rot = { x: 0, y: 0 };
    try {
      if (typeof player.getRotation === 'function') rot = player.getRotation();
      else if (player.rotation) rot = player.rotation;
    } catch(e) {}

    list.push({
      name: name,
      icon: emojiIcons[iconIdx],
      x: loc.x, y: loc.y, z: loc.z,
      rotX: rot.x, rotY: rot.y
    });
    saveWaypoints(player.name, list);
    player.sendMessage("§a[Waypoint] Berhasil menyimpan: §e" + name);
  });
}

function showWaypointListForm(player) {
  var list = getWaypoints(player.name);
  if (list.length === 0) {
    player.sendMessage("§c[Waypoint] Kamu belum menyimpan lokasi apapun!");
    return;
  }
  var form = new ui.ActionFormData().title("§d§lDaftar Waypoint").body("Pilih lokasi tujuanmu:");
  for (var i = 0; i < list.length; i++) {
    var wp = list[i];
    form.button(wp.icon + " §l" + wp.name + "\n§r§8(X:" + Math.floor(wp.x) + " Y:" + Math.floor(wp.y) + " Z:" + Math.floor(wp.z) + ")");
  }
  form.show(player).then(function(res) {
    if (res.canceled) return;
    var wp = list[res.selection];
    if (wp) {
      var teleportOptions = { dimension: player.dimension };
      if (wp.rotX !== undefined && wp.rotY !== undefined) {
        teleportOptions.rotation = { x: wp.rotX, y: wp.rotY };
      }
      player.teleport({ x: wp.x, y: wp.y, z: wp.z }, teleportOptions);
      player.sendMessage("§a[Waypoint] Woosh! Teleport ke §e" + wp.name);
    }
  });
}

function showManageWaypointForm(player) {
  var list = getWaypoints(player.name);
  if (list.length === 0) return;
  var form = new ui.ActionFormData().title("§c§lKelola Waypoint").body("Pilih waypoint yang ingin diedit atau dihapus:");
  for (var i = 0; i < list.length; i++) {
    var wp = list[i];
    form.button(wp.icon + " §l" + wp.name + "\n§r§8(X:" + Math.floor(wp.x) + " Y:" + Math.floor(wp.y) + " Z:" + Math.floor(wp.z) + ")");
  }
  form.show(player).then(function(res) {
    if (res.canceled) return;
    showWaypointActionForm(player, res.selection);
  });
}

function showWaypointActionForm(player, index) {
  var list = getWaypoints(player.name);
  var wp = list[index];
  if (!wp) return;
  var form = new ui.ActionFormData()
    .title("§e§l" + wp.name)
    .body("Pilih aksi untuk waypoint ini:")
    .button("§bEdit Nama & Ikon")
    .button("§aPerbarui Lokasi (Saat Ini)")
    .button("§cHapus Waypoint")
    .button("§7Kembali");
  form.show(player).then(function(res) {
    if (res.canceled) return;
    var sel = res.selection;
    if (sel === 0) {
      showEditWaypointDetailsForm(player, index);
    } else if (sel === 1) {
      var loc = player.location;
      var rot = { x: 0, y: 0 };
      try {
        if (typeof player.getRotation === 'function') rot = player.getRotation();
        else if (player.rotation) rot = player.rotation;
      } catch(e) {}
      list[index].x = loc.x; list[index].y = loc.y; list[index].z = loc.z;
      list[index].rotX = rot.x; list[index].rotY = rot.y;
      saveWaypoints(player.name, list);
      player.sendMessage("§a[Waypoint] Lokasi " + wp.name + " berhasil diperbarui!");
    } else if (sel === 2) {
      list.splice(index, 1);
      saveWaypoints(player.name, list);
      player.sendMessage("§a[Waypoint] Waypoint berhasil dihapus!");
    } else if (sel === 3) {
      showManageWaypointForm(player);
    }
  });
}

function showEditWaypointDetailsForm(player, index) {
  var list = getWaypoints(player.name);
  var wp = list[index];
  if (!wp) return;
  var form = new ui.ModalFormData()
    .title("§b§lEdit Waypoint")
    .textField("§bNama Lokasi (Skrg: " + wp.name + "):", "Ketik nama baru atau biarkan kosong")
    .dropdown("§ePilih Ikon UI Bedrock:", Array.from(emojiNames));
  form.show(player).then(function(res) {
    if (res.canceled) return;
    var newName = res.formValues[0] || wp.name;
    var iconIdx = res.formValues[1];
    list[index].name = newName;
    list[index].icon = emojiIcons[iconIdx];
    saveWaypoints(player.name, list);
    player.sendMessage("§a[Waypoint] Berhasil memperbarui waypoint: §e" + newName);
  });
}

// ─────────────────────────────────────────────────────────────
// 2. World Control Form (Clock)
// ─────────────────────────────────────────────────────────────
function showWorldControlForm(player) {
  var form = new ui.ModalFormData()
    .title("§2§l\uE0A0 Kontrol Dunia")
    .dropdown("§ePilih Waktu:", ["Jangan Ubah", "Pagi (Sunrise)", "Siang (Day)", "Sore (Sunset)", "Malam (Night)"])
    .dropdown("§bPilih Cuaca:", ["Jangan Ubah", "Cerah (Clear)", "Hujan (Rain)", "Badai (Thunder)"]);

  form.show(player).then(function(response) {
    if (response.canceled) return;
    var waktu = response.formValues[0];
    var cuaca = response.formValues[1];
    var dim = player.dimension;

    if (waktu === 1) dim.runCommand("time set sunrise");
    else if (waktu === 2) dim.runCommand("time set day");
    else if (waktu === 3) dim.runCommand("time set sunset");
    else if (waktu === 4) dim.runCommand("time set night");

    if (cuaca === 1) dim.runCommand("weather clear");
    else if (cuaca === 2) dim.runCommand("weather rain");
    else if (cuaca === 3) dim.runCommand("weather thunder");

    if (waktu !== 0 || cuaca !== 0) {
      player.sendMessage("§a[System] Berhasil mengatur dunia!");
    }
  });
}

// ─────────────────────────────────────────────────────────────
// 3. Titik Terakhir Mati (Recovery Compass)
// ─────────────────────────────────────────────────────────────
function showDeathPointForm(player) {
  var dx = player.getDynamicProperty("last_death_x");
  var dy = player.getDynamicProperty("last_death_y");
  var dz = player.getDynamicProperty("last_death_z");
  
  if (dx === undefined || dy === undefined || dz === undefined) {
    var errForm = new ui.MessageFormData()
      .title("§c§lTitik Mati Tidak Ditemukan")
      .body("Kamu belum pernah mati sejak mengaktifkan fitur ini, atau data kematianmu tidak tercatat.")
      .button1("Tutup");
    errForm.show(player).catch(()=>{});
    return;
  }

  var dxF = Math.floor(dx);
  var dyF = Math.floor(dy);
  var dzF = Math.floor(dz);

  var form = new ui.MessageFormData()
    .title("§c§lKembali ke Titik Mati")
    .body("Titik kematian terakhirmu berada di koordinat:\n\n§eX: " + dxF + "  Y: " + dyF + "  Z: " + dzF + "§r\n\nApakah kamu ingin teleportasi kembali ke sana untuk mengambil barang-barangmu?")
    .button1("§aYa, Teleport!")
    .button2("§cBatal");

  form.show(player).then((res) => {
    if (res.canceled) return;
    if (res.selection === 1) { // 1 karena Bedrock API menggunakan indeks dari button yang ditekan, button1 adalah indeks 1
      try {
        player.teleport({ x: dx, y: dy, z: dz });
        player.sendMessage("§a[Teleport] Berhasil kembali ke lokasi kematian terakhir!");
      } catch (e) {
        player.sendMessage("§c[Error] Gagal teleportasi. Pastikan kamu berada di dimensi yang sama.");
      }
    }
  }).catch(()=>{});
}

// ─────────────────────────────────────────────────────────────
// 4. Admin Menu (Book)
// ─────────────────────────────────────────────────────────────
function showAdminMenuForm(player) {
  var allPlayers = Array.from(mc.world.getAllPlayers());
  var playerNames = allPlayers.map(p => p.name);

  if (playerNames.length === 0) {
    player.sendMessage("§c[Admin] Tidak ada pemain yang ditemukan!");
    return;
  }

  var form = new ui.ModalFormData()
    .title("§c§lAdmin Menu")
    .dropdown("§bPilih Pemain Target:", playerNames)
    .dropdown("§eUbah Gamemode:", ["Survival", "Creative", "Adventure", "Spectator"]);

  form.show(player).then((res) => {
    if (res.canceled) return;
    
    var targetIdx = res.formValues[0];
    var modeIdx = res.formValues[1];
    
    var targetPlayer = allPlayers[targetIdx];
    var gamemodes = ["survival", "creative", "adventure", "spectator"];
    var modeStr = gamemodes[modeIdx];

    if (targetPlayer) {
      targetPlayer.runCommand("gamemode " + modeStr);
      player.sendMessage("§a[Admin] Berhasil mengubah gamemode " + targetPlayer.name + " menjadi " + modeStr);
    }
  });
}