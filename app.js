var modelUid = "c8881e07da5a4f01a08b185f90a028ac";
var canvas = document.querySelector("#canvas");
var video = document.querySelector("#video");
var viewer = document.querySelector("#viewer");
var ctx = canvas.getContext("2d");
var canvasImage = ctx.getImageData(0, 0, 256, 240);
var nes = new NES.Console();
var nesMaterial;
var nesTextureUid;
var listener;

document.querySelector("#romSelect").onchange = e => {
  var reader = new FileReader();
  var f = e.target.files[0];

  // Closure to capture the file information.
  reader.onload = (function(theFile) {
    return function(i) {
      nes.loadROMData(i.target.result);
      nes.start();
    };
  })(f);

  // Read in the image file as a data URL.
  reader.readAsArrayBuffer(f);
};

var client = new Sketchfab(viewer);
client.init(modelUid, {
  success: function onSuccess(api) {
    window.viewerApi = api;
    api.start();
    api.addEventListener("viewerready", function() {
      listener = new NesListener();
      nes.addObserver(listener);
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
    if (!nesMaterial) {
      api.getMaterialList(function(err, materials) {
        if (err) {
          reject();
        }
        nesMaterial = materials[2];
        resolve(nesMaterial);
      });
    } else {
      resolve(nesMaterial);
    }
  });
}

/**
 * This replaces the texture used by our material with the new
 * one we created, which contains the NES data
 */
function updateMaterial(api, material, textureUid) {
  return new Promise((resolve, reject) => {
    material.channels.AlbedoPBR.texture.uid = textureUid;
    api.setMaterial(material, resolve);
  });
}

/**
 * Registers or updates a new texture
 */
function registerTexture(api, url) {
  return new Promise((resolve, reject) => {
    if (!nesTextureUid) {
      api.addTexture(url, function(err, textureUid) {
        if (err) {
          reject();
        }
        //console.log("add", textureUid);
        nesTextureUid = textureUid;
        resolve(textureUid);
      });
    } else {
      api.updateTexture(url, nesTextureUid, function(err, textureUid) {
        if (err) {
          reject();
        } else {
          //console.log("update", textureUid);
          resolve(textureUid);
        }
      });
    }
  });
}

/**
 * Main API function
 * Called every frame, to get the material, its texture
 * and update it with new data
 */
function updateTexture(api, url) {
  var material, textureUid;
  getMaterial(api)
    .then(m => {
      material = m;
      return registerTexture(api, url);
    })
    .then(t => {
      textureUid = t;
      return updateMaterial(api, material, textureUid);
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
      if (window.viewerApi) {
        // Surprisingly the perfs are quite good
        // Sketchfab Viewer API does not support raw data for texture assignment
        // So we use base64 data url
        updateTexture(window.viewerApi, canvas.toDataURL());
      }
      break;
    }
    default: {
      break;
    }
  }
};
