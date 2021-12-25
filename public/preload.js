const fs = require('fs');
const { ipcRenderer } = require('electron');
const iconv = require('iconv-lite');
const jschardet = require("jschardet");
const EPub = require("epub");
const mobi = require("js-mobi/Mobi");
window.services = {
  /***  从本地txt文件读取小说内容  ***/
  readBook: (dt,callback) => {
    if(!dt || !dt.path){
      return;
    }
    let str = '';
    let buffer ;
    if (dt.type && (dt.type === 'epub' || dt.type === 'mobi') ){
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
      console.log(buffer)
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
    } else {
      str = iconv.decode(buffer , 'utf-8');
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
  /***  获取epub书籍的内容封面等信息  ***/
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
          str = null;
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
  /***  获取mobi书籍的内容封面等信息  ***/
  getMobiInfo : (path,callback) => {
    let result = {error_no : 0};
    console.log(new Date().getTime())
    fs.readFile(path, (err,buffer) => {
      if(err){
        console.log(err);
        result.error_no = 98;
        result.error_info = '读取文件出错，错误信息：' + err;
      } else {
        let uint8 = Uint8Array.from(buffer);
        buffer = null;
        let book = mobi.default.read(uint8);
        uint8 = null;
        console.log(new Date().getTime())
        let list = book.getTextContent().split("<mbp:pagebreak/>")
        //去头去尾去章节列表
        list.splice(0, 1);
        let allStr = '';
        list.forEach(function (ele,idx) {
          let reg1 = /(第)([零〇一二三四五六七八九十百千万a-zA-Z0-9]{1,7})[章节卷集部篇回]/g;
          let result = ele.match(reg1);
          if (!result || result.length < 10) {
            let str = '';
            let reg = /(第)([零〇一二三四五六七八九十百千万a-zA-Z0-9]{1,7})[章节卷集部篇回]((?!<).){0,30}/g;
            let title = ele.match(reg)
            if(title && title.length > 0){
              ele = ele.replace(reg,'');
              str = str + title[0] + '\n'
            }
            str = str + ele.replace(/<\/?.+?>/g,"") + "\n";
            if(idx === list.length -1 && str.length < 100){
              //最后一个长度不符合章节标准则移除
            } else {
              allStr += str;
            }
          }
        });
        if(allStr && allStr.length > 100){
          let bufferSave = Buffer.from(allStr);
          allStr = null;
          let content = [];
          if(bufferSave){
            //utools数据库附件大小限制10m，若过大则拆分成多个
            for (let i = 0; i < Math.ceil(bufferSave.length/9500000); i++){
              if( i === Math.ceil(bufferSave.length/9500000) -1){
                //最后一次循环
                let tmpBuffer = new Buffer(bufferSave.length - (Math.ceil(bufferSave.length/9500000) - 1) * 9500000 );
                bufferSave.copy(tmpBuffer,0,i * 9500000 ,bufferSave.length );
                content.push(tmpBuffer);
              } else {
                let tmpBuffer = new Buffer(9500000);
                bufferSave.copy(tmpBuffer,0,i * 9500000 ,(i+1)*9500000 );
                content.push(tmpBuffer);
              }
            }
          }
          bufferSave = null;
          result.content = content;
          result.error_info = '解析成功';
        } else {
          result.error_no = 99;
          result.error_info = '解析失败';
        }
      }
      callback(result);
    });
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
  },
  /***  获取系统支持的字体列表  ***/
  getFonts : () => {
    return new Promise((resolve) => {
      let fonts = [{"ch":"站酷快乐体","en":"HappyZcool-2016"},{"ch":"站酷酷黑体","en":"ZCOOL_KuHei"},{"ch":"站酷高端黑体","en":"zcool-gdh"},{"ch":"站酷文艺体","en":"zcoolwenyiti"},{"ch":"站酷庆科黄油体","en":"zcoolqingkehuangyouti"},
        {"ch":"思源黑体","en":"Source Han Sans CN"},{"ch":"思源宋体","en":"Source Han Serif SC"},{"ch":"文泉驿微米黑","en":"WenQuanYi Micro Hei"},
        {"ch":"宋体","en":"SimSun"},{"ch":"黑体","en":"SimHei"},{"ch":"微软雅黑","en":"Microsoft Yahei"},{"ch":"微软正黑体","en":"Microsoft JhengHei"},{"ch":"楷体","en":"KaiTi"},{"ch":"新宋体","en":"NSimSun"},{"ch":"仿宋","en":"FangSong"},{"ch":"细明体","en":"MingLiU"},{"ch":"新细明体","en":"PMingLiU"},
        {"ch":"苹方","en":"PingFang SC"},{"ch":"华文黑体","en":"STHeiti"},{"ch":"华文楷体","en":"STKaiti"},{"ch":"华文宋体","en":"STSong"},{"ch":"华文仿宋","en":"STFangsong"},{"ch":"华文中宋","en":"STZhongsong"},{"ch":"华文隶书","en":"STLiti"},{"ch":"华文行楷","en":"STXingkai"},{"ch":"华康翩翩体-简","en":"HanziPen SC"},{"ch":"冬青黑体-简","en":"Hiragino Sans GB"},{"ch":"兰亭黑-简","en":"Lantinghei SC"},{"ch":"翩翩体-简","en":"Hanzipen SC"},{"ch":"手札体-简","en":"Hannotate SC"},{"ch":"宋体-简","en":"Songti SC"},{"ch":"娃娃体-简","en":"Wawati SC"},{"ch":"魏碑-简","en":"Weibei SC"},{"ch":"行楷-简","en":"Xingkai SC"},{"ch":"雅痞-简","en":"Yuppy SC"},{"ch":"圆体-简","en":"Yuanti SC"}]
      let result = [{"ch":"系统默认","en":"default"}];
      let e = "a";
      let d = 100;
      let a = 100,
          i = 100;
      let h = "Arial";
      let c = document.createElement("canvas");
      let b = c.getContext("2d");
      c.width = a;
      c.height = i;
      b.textAlign = "center";
      b.fillStyle = "black";
      b.textBaseline = "middle";
      let g = function(j) {
        b.clearRect(0, 0, a, i);
        b.font = d + "px '" + j + "', " + h;
        b.fillText(e, a / 2, i / 2);
        let k = b.getImageData(0, 0, a, i).data;
        return [].slice.call(k).filter(function(l) {
          return l != 0
        });
      };
      let bz = g(h).join("");
      fonts.forEach((one) => {
        if(bz !== g(one.en).join("")){
          result.push(one);
        }
      })
      resolve(result);
    });
  }
}

