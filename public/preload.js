const fs = require('fs')
const { ipcRenderer } = require('electron')
const iconv = require('iconv-lite')

window.services = {
  readBook: (path) => {
    let str = '';
    let buffer = fs.readFileSync(path);
    if(!buffer || buffer.length <= 0){
      return str;
    }
    str = iconv.decode(buffer ,'utf8');
    if(str.indexOf("�") !== -1){
      str = iconv.decode(buffer ,'gbk');
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
