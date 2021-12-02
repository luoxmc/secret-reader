const fs = require('fs')
const { ipcRenderer } = require('electron')
const iconv = require('iconv-lite');
const jschardet = require("jschardet")

window.services = {
  readBook: (path) => {
    let str = '';
    let buffer = fs.readFileSync(path);
    if(!buffer || buffer.length <= 0){
      return str;
    }
    let encodingCheck = {};
    if(buffer.byteLength > 2500){
      let tmpBuffer = new Buffer(2500);
      buffer.copy(tmpBuffer,0,0,2500);
      encodingCheck = jschardet.detect(tmpBuffer);
    } else {
      encodingCheck = jschardet.detect(buffer);
    }
    if(encodingCheck.confidence > 0.45){
      str = iconv.decode(buffer , encodingCheck.encoding);
    }
    str = str.replace(/\t/g, "").replace(/[，]\s{2,}(?!第)/g, "，")
        .replace(/[。]\s{2,}(?!第)/g, "。").replace(/[？]\s{2,}(?!第)/g, "？")
        .replace(/[！]\s{2,}(?!第)/g, "！").replace(/[,]\s{2,}(?!第)/g, ",")
        .replace(/[.]\s{2,}(?!第)/g, ".").replace(/[?]\s{2,}(?!第)/g, "?")
        .replace(/[!]\s{2,}(?!第)/g, "!").replace(/["]\s{2,}(?!第)/g,'"')
        .replace(/[”]\s{2,}(?!第)/g,'”').replace(/[……]\s{2,}(?!第)/g,'……')
        .replace(/\n\n/g,"");
    return str;
  },
  sendMsg : (id,msg) => {
    ipcRenderer.sendTo(id, 'ping',msg)
  },
  receiveMsg: (callback) => {
    ipcRenderer.on('ping', (event, res) => {
      if(callback){
        callback(res);
      }
    })
  },
  checkFile : (path) => {
    try {
      fs.accessSync(path);
    } catch (e) {
      return false;
    }
    try {
      fs.accessSync(path,fs.constants.R_OK);
    } catch (e) {
      return false;
    }
    return true;
  }
}
