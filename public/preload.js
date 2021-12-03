const fs = require('fs')
const { ipcRenderer } = require('electron')
const iconv = require('iconv-lite');
const jschardet = require("jschardet")

window.services = {
  /***  从本地txt文件读取小说内容  ***/
  readBook: (path) => {
    let str = '';
    let buffer = fs.readFileSync(path);
    if(!buffer || buffer.length <= 0){
      return str;
    }
    //使用jschardet检查文件编码
    let encodingCheck = {};
    if(buffer.byteLength > 2500){
      let tmpBuffer = new Buffer(2500);
      buffer.copy(tmpBuffer,0,0,2500);
      encodingCheck = jschardet.detect(tmpBuffer);
    } else {
      encodingCheck = jschardet.detect(buffer);
    }
    //用检查出来的编码将buffer转成字符串
    if(encodingCheck.confidence > 0.45){
      str = iconv.decode(buffer , encodingCheck.encoding);
    }
    //去除字符串中多余的空格、换行、制表符等
    str = str.replace(/\t/g, "").replace(/[，]\s{2,}(?!第)/g, "，")
        .replace(/[。]\s{2,}(?!第)/g, "。").replace(/[？]\s{2,}(?!第)/g, "？")
        .replace(/[！]\s{2,}(?!第)/g, "！").replace(/[,]\s{2,}(?!第)/g, ",")
        .replace(/[.]\s{2,}(?!第)/g, ".").replace(/[?]\s{2,}(?!第)/g, "?")
        .replace(/[!]\s{2,}(?!第)/g, "!").replace(/["]\s{2,}(?!第)/g,'"')
        .replace(/[”]\s{2,}(?!第)/g,'”').replace(/[……]\s{2,}(?!第)/g,'……')
        .replace(/\n\n/g,"");
    return str;
  },
  /***  向阅读窗口发送消息  ***/
  sendMsg : (id,msg) => {
    ipcRenderer.sendTo(id, 'ping',msg)
  },
  /***  接收阅读窗口发送过来的消息  ***/
  receiveMsg: (callback) => {
    ipcRenderer.on('ping', (event, res) => {
      if(callback){
        callback(res);
      }
    })
  },
  /***  检查文件是否存在并可读  ***/
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
