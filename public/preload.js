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
    let encodingCheck = jschardet.detect(buffer);
    console.log(encodingCheck);
    if(encodingCheck.confidence > 0.5){
      str = iconv.decode(buffer , encodingCheck.encoding);
    }
    str = str.replace(/\t/g, "")
        .replace(/[，]\n/g, "，")
        .replace(/[。]\n/g, "。").replace(/[？]\n/g, "？")
        .replace(/[！]\n/g, "！").replace(/[,]\n/g, ",")
        .replace(/[.]\n/g, ".").replace(/[?]\n/g, "?")
        .replace(/[!]\n/g, "!").replace(/["]\n/g,'"')
        .replace(/[”]\n/g,'”');
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
