const MODEL = "ce08c054e06c453db0f8f99626380b49";
const DEFAULT_ROM = 0;
const PLAYABLE_GAMES = [
  "super-mario-bros.nes",
  "zelda-eur.nes",
  "castlevania.nes"
];

var warning = document.querySelector("#warning");
var canvas = document.querySelector("#canvas");
var viewer = document.querySelector("#viewer");
var ctx = canvas.getContext("2d");
var canvasImage = ctx.getImageData(0, 0, 256, 240);
var nes = new NES.Console();
var nesMaterial, nesTextureUid, listener;

/**
 * Iframe blocks input for the emulator, need to display
 * a message to warn
 */
window.addEventListener("focus", function(event) {
  warning.style = "display: none";
});

window.addEventListener("blur", function(event) {
  if (document.activeElement === viewer) {
    warning.style = "";
  }
});

function getRom(i) {
  return new Promise((resolve, reject) => {
    var request = new XMLHttpRequest();

    request.responseType = "arraybuffer";
    request.open("GET", "http://grun7.com/roms/" + PLAYABLE_GAMES[i]);
    request.onload = function() {
      resolve(request.response);
    };
    request.send();
  });
}

var client = new Sketchfab(viewer);
client.init(MODEL, {
  success: function onSuccess(api) {
    listener = new NesListener();
    nes.addObserver(listener);

    window.viewerApi = api;
    api.start();
    api.addEventListener("viewerready", function() {
      getMaterial(api)
        .then(m => {
          nesMaterial = m;
          return registerTexture(api, canvas.toDataURL());
        })
        .then(t => {
          nesTextureUid = t;
          return getRom(DEFAULT_ROM);
        })
        .then(d => {
          nes.loadROM(d);
          nes.start();
        })
        .catch(err => {
          console.error(err);
        });
    });

    /*
     * Listens for anotation focus and switch the active rom
     * by using the inndex of the annotation
     */
    api.addEventListener("annotationFocus", function(index) {
      console.log("Reached annotation " + index);

      getRom(index).then(d => {
        nes.loadROM(d);
        nes.start();
      });
    });
  },
  error: function onError() {
    console.log("Viewer error");
  }
});

/**
 * Retrieve the material I want to modify
 * For the model I'm using, it's the 3rd one.
 */
function getMaterial(api) {
  return new Promise((resolve, reject) => {
    api.getMaterialList(function(err, materials) {
      if (err) {
        reject();
      }
      nesMaterial = materials.find(o => o.name === "tv-screen");
      resolve(nesMaterial);
    });
  });
}

/**
 * This replaces the texture used by our material with the new
 * one we created, which contains the NES data
 */
function updateMaterial(api, material, textureUid) {
  return new Promise((resolve, reject) => {
    material.channels.EmitColor.texture.uid = textureUid;
    api.setMaterial(material, resolve);
  });
}

function updateTexture(api, url, textureUid) {
  return new Promise((resolve, reject) => {
    api.updateTexture(url, textureUid, function(err, textureUid) {
      if (err) {
        reject();
      } else {
        resolve();
      }
    });
  });
}

/**
 * Registers or updates a new texture
 */
function registerTexture(api, url) {
  return new Promise((resolve, reject) => {
    api.addTexture(url, function(err, textureUid) {
      if (err) {
        reject();
      }
      resolve(textureUid);
    });
  });
}

/**
 * Main API function
 * Called every frame, to get the material, its texture
 * and update it with new data
 */
function frame(api, url) {
  updateTexture(api, url, nesTextureUid)
    .then(() => {
      return updateMaterial(api, nesMaterial, nesTextureUid);
    })
    .catch(err => {
      console.error(err);
    });
}

function NesListener() {}

/**
 * This method will be called by the NES every frame
 */
NesListener.prototype.notify = function(t, e) {
  switch (t) {
    case "frame-ready": {
      canvasImage.data.set(e[0]);
      ctx.putImageData(canvasImage, 0, 0);
      //scaleCtx.drawImage(canvas, 0, 0);

      if (window.viewerApi) {
        // Surprisingly the perfs are quite good
        // Sketchfab Viewer API does not support raw data for texture assignment
        // So we use base64 data url
        frame(window.viewerApi, canvas.toDataURL());
      }
      break;
    }
    default: {
      break;
    }
  }
};
