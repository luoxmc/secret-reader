const fs = require('fs');
const { ipcRenderer } = require('electron');
const iconv = require('iconv-lite');
const jschardet = require("jschardet");
const EPub = require("epub");

window.services = {
  /***  从本地txt文件读取小说内容  ***/
  readBook: (dt,callback) => {
    if(!dt || !dt.path){
      return;
    }
    let str = '';
    let buffer ;
    if (dt.type && dt.type === 'epub'){
      let paths = dt.path.split(',');
      if(paths && paths.length > 0){
        let tmp = [];
        let totalLength = 0;
        for (let i = 0; i < paths.length; i++) {
          let part = window.utools.db.getAttachment(paths[i]);
          tmp.push(part);
          totalLength += part.length;
        }
        buffer = Buffer.concat(tmp,totalLength);
        tmp = null;
      } else {
        return;
      }
    } else {
      buffer = fs.readFileSync(dt.path);
    }
    if(!buffer || buffer.length <= 0){
      callback(null);
    }
    //使用jschardet检查文件编码
    let encodingCheck = {};
    if(buffer.byteLength > 2500){
      let tmpBuffer = new Buffer(2500);
      buffer.copy(tmpBuffer,0,0,2500);
      encodingCheck = jschardet.detect(tmpBuffer);
      tmpBuffer = null;
    } else {
      encodingCheck = jschardet.detect(buffer);
    }
    //用检查出来的编码将buffer转成字符串
    if(encodingCheck.confidence > 0.45){
      str = iconv.decode(buffer , encodingCheck.encoding);
    }
    if(str){
      //去除字符串中多余的空格、换行、制表符等
      str = str.replace(/\t/g, "").replace(/[，]\s{2,}(?!第)/g, "，")
          .replace(/[。]\s{2,}(?!第)/g, "。").replace(/[？]\s{2,}(?!第)/g, "？")
          .replace(/[！]\s{2,}(?!第)/g, "！").replace(/[,]\s{2,}(?!第)/g, ",")
          .replace(/[.]\s{2,}(?!第)/g, ".").replace(/[?]\s{2,}(?!第)/g, "?")
          .replace(/[!]\s{2,}(?!第)/g, "!").replace(/["]\s{2,}(?!第)/g,'"')
          .replace(/[”]\s{2,}(?!第)/g,'”').replace(/[……]\s{2,}(?!第)/g,'……')
          .replace(/\n\n/g,"");
    }
    callback(str);
  },
  //获取epub书籍的内容封面等信息
  getEpubInfo : (path,callback) => {
    let result = {error_no : 0};
    let epub = new EPub(path);
    epub.on("error", async function(error) {
      console.log(error)
    });
    epub.on("end", async function() {
      function findChapter (chapterId){
        return new Promise((resolve) => {
          epub.getChapter(chapterId, (error, text) => {
            if (error) {
              throw error;
            }
            resolve(text);
          })
        });
      }
      function findCover (coverId){
        return new Promise((resolve) => {
          epub.getImage(coverId, (error, buf) => {
            if (error) {
              throw error;
            }
            resolve(buf);
          })
        });
      }
      try {
        if (epub.flow && epub.flow.length > 0){
          let str = '';
          for (let i= 0; i < epub.flow.length; i++) {
            let chapter = epub.flow[i];
            if(chapter.id.indexOf("cover") !== -1 || chapter.title === '封面' || chapter.title === '目录'
                || chapter.title === 'cover' || chapter.title === 'menu'){
              continue;
            }
            let cont = await findChapter(chapter.id);
            cont += '\n';
            str += cont.replace(/<\/?.+?>/g,"");
          }
          let buffer = Buffer.from(str);
          let content = [];
          if(buffer){
            //utools数据库附件大小限制10m，若过大则拆分成多个
            for (let i = 0; i < Math.ceil(buffer.length/9500000); i++){
              if( i === Math.ceil(buffer.length/9500000) -1){
                //最后一次循环
                let tmpBuffer = new Buffer(buffer.length - (Math.ceil(buffer.length/9500000) - 1) * 9500000 );
                buffer.copy(tmpBuffer,0,i * 9500000 ,buffer.length );
                content.push(tmpBuffer);
              } else {
                let tmpBuffer = new Buffer(9500000);
                buffer.copy(tmpBuffer,0,i * 9500000 ,(i+1)*9500000 );
                content.push(tmpBuffer);
              }
            }
          }
          buffer = null;
          result.content = content;
          str = null;
          if(epub.metadata && epub.metadata.cover){
            let image = await findCover(epub.metadata.cover)
            result.cover = image;
          }
          result.error_info = '解析成功';
        } else {
          result.error_no = 1;
          result.error_info = '解析epub内容失败';
        }
      } catch (err) {
        console.log(err);
        result.error_no = 999;
        result.error_info = err;
      }
      callback(result);
    });
    epub.parse();
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

