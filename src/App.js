import React from 'react'
import { createMuiTheme, ThemeProvider } from '@material-ui/core/styles'
import {
  Grid, Paper, MenuList, MenuItem, List, ListItem, ListItemText, ClickAwayListener, Card, Input, Slider, Divider,
  Snackbar, AppBar, Toolbar, Typography, Dialog, DialogContent, DialogTitle, DialogActions, Button, CardContent,
  Backdrop, CircularProgress, Switch, Select
} from '@material-ui/core';
import {AddCircle, Search, Settings, HelpTwoTone} from '@material-ui/icons';

window.platform = {
  isMacOs: window.utools.isMacOs(),
  isWindows: window.utools.isWindows(),
  isLinux: window.utools.isLinux()
}

const themeDic = {
  light: createMuiTheme({
    palette: {
      type: 'light'
    },
    props: {
      MuiButtonBase: {
        disableRipple: true
      }
    }
  }),
  dark: createMuiTheme({
    palette: {
      type: 'dark',
      primary: {
        main: '#90caf9'
      },
      secondary: {
        main: '#f48fb1'
      }
    },
    props: {
      MuiButtonBase: {
        disableRipple: true
      }
    }
  })
}

let ubWindow = null;

let curContent = '';

let curId = null;

let focusId = '';

export default class App extends React.Component {

  state = {
    theme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
    deviceId: '',
    list: {
      _id : '',
      data : [],
      _rev : ''
    },
    chapter: {
      list: [],
      bookId: null,
      showChapterList : false
    },
    search: {
      list: [],
      bookId: null,
      show: false,
      keywords: '',
      hasMore: false
    },
    msg: {
      show: false,
      text: ''
    },
    user: {
      _id : '',
      data : {
        bgColor: 'rgb(59, 62, 64, 0.8)',
        fontColor: 'rgb(187, 187, 187)',
        opacity: 0.8,
        fontSize: 14,
        numOfPage: 100,
        winWidth: 800,
        winHeight: 55,
        x: 300,
        y: 300,
        autoPage: 0,
        prev: window.platform.isMacOs ? 'Command+ArrowLeft' : 'Control+[',
        next: window.platform.isMacOs ? 'Command+ArrowRight' : 'Control+]',
        isMove: true,
        mouseType: 0
      },
      _rev : ''
    },
    showSetting: false,
    showHelp: false,
    loading: {
      show: false,
      msg: ''
    }
  }

  /****  选择文件  ****/
  checkFile = () => {
    let file = window.utools.showOpenDialog({
      filters: [{ 'name': 'Txt', extensions: ['txt'] }],
      properties: ['openFile']
    })
    if(file && file.length > 0){
      this.addBook(file[0]);
    } else {
      this.showTip("请选择有效的txt文件");
    }
  }
  /****  添加书籍  *****/
  addBook = (path) => {
    console.log('add book');
    if(!window.services.checkFile(path)){
      this.showTip("该路径下文件已不存在或不可读");
      return;
    }
    const bookId = new Date().getTime().toString();
    let tmpList = this.state.list;
    let name = '';
    if(window.platform.isWindows){
      name = path.replace('.txt','').substring(path.lastIndexOf("\u005C") + 1);
    } else {
      name = path.replace('.txt','').substring(path.lastIndexOf("/") + 1);
    }
    if(name.length > 20){
      name = name.substring(0,20) + "...";
    }
    let isAdded = false;
    tmpList.data.forEach(function (dt) {
      if(dt && dt.name === name){
        isAdded = true;
      }
    })
    if(isAdded){
      this.showTip("书架中已有该书籍！");
      return;
    }
    tmpList.data.push({
      id : bookId,
      name : name,
      path : path,
      showRight: false,
      progress : 0
    })
    let res1 = window.utools.db.put(tmpList);
    if(res1 && res1.ok) {
      this.setState({list:JSON.parse(JSON.stringify(window.utools.db.get(this.state.deviceId+"/list")))});
    }
  }
  /****  删除书籍  *****/
  removeBook = (e,id) => {
    let self = this;
    this.state.list.data.forEach((dt, index) => {
      if (dt && dt.id === id) {
        delete self.state.list.data[index];
        self.state.list.data = self.state.list.data.filter(function (val) {
          return val;
        })
        let res = window.utools.db.put(self.state.list);
        if(res && res.ok) {
          this.setState({list:JSON.parse(JSON.stringify(window.utools.db.get(this.state.deviceId+"/list")))});
        }
      }
    })
  }
  /****  展示章节列表  *****/
  chaptersList = (e, id) => {
    console.log('show chapters list')
    e.stopPropagation();
    this.closeRightMenu();
    let self = this;
    this.showLoading('', function () {
      self.state.list.data.forEach(function(dt){
        if(dt && dt.id === id){
          let str = window.services.readBook(dt.path)
          if(str){
            let chapters = self.getChapters(str);
            if(chapters && chapters.length > 0){
              self.state.chapter = { list : chapters, bookId: id, showChapterList : true};
              self.setState({chapter: JSON.parse(JSON.stringify(self.state.chapter))},() => {
                if(document.body.clientHeight && document.getElementById('chapterList') && document.getElementById('chapterList').clientHeight){
                  const top = (document.body.clientHeight - document.getElementById('chapterList').clientHeight)/2 + 'px';
                  const left = (document.body.clientWidth - document.getElementById('chapterList').clientWidth)/2 + 'px';
                  document.getElementById('chapterList').style.top = top;
                  document.getElementById('chapterList').style.left = left;
                }
              });
            } else {
              self.showTip('未检索到章节列表，请检查文本内容格式！');
            }
            str = null;
          } else {
            self.showTip('获取文件内容失败，请检查!');
          }
        }
      })
      self.closeLoading();
    })
  }
  /****  关闭章节列表  ****/
  closeChapterMenu = (e) => {
    console.log('close chapter list')
    if(document.getElementById('chapterList')){
      let self = this;
      self.state.chapter.showChapterList = false;
      self.state.chapter.list = [];
      self.state.chapter.bookId = null;
      this.setState({chapter : JSON.parse(JSON.stringify(self.state.chapter))});
    }
  }
  /****  打开搜索界面  ****/
  showSearch = (e,id) => {
    console.log('show search list')
    e.stopPropagation();
    this.closeRightMenu();
    let self = this;
    self.state.search.show = true;
    self.state.search.bookId = id;
    this.setState({search : JSON.parse(JSON.stringify(self.state.search))}, ()=>{
      let index = 0;
      let timerS = setInterval(function (){
        index ++;
        if(document.body.clientHeight && document.getElementById("searchMain") && document.getElementById("searchMain").clientHeight){
          let height = document.getElementById("searchMain").clientHeight - document.getElementById("searchHeader").clientHeight - 20 - 15;
          document.getElementById("searchList").style.height = height + 'px';
          clearInterval(timerS);
        }
        if(index > 10){
          clearInterval(timerS);
        }
      },50);

    });
  }
  /****  关闭搜索列表  ****/
  closeSearch = (e) => {
    console.log('close search list')
    if(document.getElementById('searchMain')){
      let self = this;
      self.state.search.show = false;
      self.state.search.list = [];
      self.state.search.bookId = null;
      self.state.search.keywords = '';
      self.state.search.hasMore = false;
      this.setState({search : JSON.parse(JSON.stringify(self.state.search))});
    }
  }
  /****  显示右键菜单  ****/
  showRightMenu = (e, bookId) => {
    console.log('show right')
    let self = this;
    this.state.list.data.forEach(function(dt){
      if(dt && dt.id === bookId){
        dt.showRight = true;
        document.getElementById(bookId).style.left = e.clientX + 'px';
        document.getElementById(bookId).style.top = e.clientY + 'px';
      } else {
        dt.showRight = false;
      }
      self.setState({list: self.state.list});
    })
  }
  /****  关闭右键菜单  ****/
  closeRightMenu = (e) => {
    console.log('close right')
    this.state.list.data.forEach(function(dt){
      dt.showRight = false;
    });
    this.setState({list: this.state.list});
  }
  /****  章节跳转开始阅读  ****/
  chapterToBook = (e,keywords,index) => {
    console.log('chapter to read book')
    e.stopPropagation();
    let self = this;
    if(this.state.chapter && this.state.chapter.list){
      this.state.list.data.forEach(function(dt) {
        if (dt && dt.id === self.state.chapter.bookId) {
          let str = window.services.readBook(dt.path)
          if (str) {
            let count = 0;
            self.state.chapter.list.forEach(function (vlu,idx){
              if(vlu === keywords){
                  count ++;
              }
              if(idx === index){
                keywords = keywords.replace(/\n/g , '');
                let x = self.findStr(str,keywords,count);
                if(x && x > 0){
                    dt.progress = Number(x);
                    let res = window.utools.db.put(self.state.list);
                    if(res && res.ok) {
                      const book_id = self.state.chapter.bookId;
                      self.setState({ list: JSON.parse(JSON.stringify(window.utools.db.get(self.state.deviceId+"/list")))},()=>{
                        self.readBook(null, book_id);
                      });
                    }
                } else {
                  self.showTip("跳转失败");
                }
                self.closeChapterMenu();
              }
            })
            str = null;
          }
        }
      });
    }
  }
  /****  搜索关键字  ****/
  searchContent = (flag) => {
    //flag 是否为加载更多模式
    console.log('search keywords')
    if(this.state.search && this.state.search.show && this.state.search.keywords){
      if(this.state.search.keywords.length < 2){
        this.showTip("关键字长度不能少于2位！")
        return;
      }
      let self = this;
      let str = '';
      this.state.list.data.forEach(function(dt) {
        if (dt && dt.id === self.state.search.bookId) {
          str = window.services.readBook(dt.path)
        }
      });
      if (str) {
        let index = 0;
        let tmp = this.state.search;
        if(!flag){
          tmp.list = [];
        }
        if(tmp.list && tmp.list.length > 0){
          let last = tmp.list[tmp.list.length - 1];
          if(last && last.index){
            index = last.index;
          }
        }
        let res = this.findStrList(str, tmp.keywords, 11, index);
        if(res && res.length > 0){
          if(res.length === 11){
            res = res.filter(function(v, i, ar) {
              return i !== ar.length - 1
            })
            tmp.hasMore = true;
          } else {
            tmp.hasMore = false;
          }
          tmp.list.push(...res);
          this.setState({search : JSON.parse(JSON.stringify(tmp))});
        }
        str = null;
      }
    }
  }
  /****  搜索跳转开始阅读  ****/
  searchToBook = (e,index) => {
    console.log('search to read book')
    e.stopPropagation();
    let self = this;
    this.state.list.data.forEach(function(dt) {
      if (dt && dt.id === self.state.search.bookId) {
        dt.progress = Number(index);
        let res = window.utools.db.put(self.state.list);
        if(res && res.ok) {
          const book_id = self.state.search.bookId;
          self.setState({ list: JSON.parse(JSON.stringify(window.utools.db.get(self.state.deviceId+"/list")))},()=>{
            self.readBook(null, book_id);
          });
        }
        self.closeSearch();
      }
    })

  }
  /****  查找字符串出现的位置  ****/
  findStr = (str,keywords,num) => {
    let x = null;
    for(let i=0; i<num; i++){
      x = str.indexOf(keywords,x+1);
    }
    return x;
  }
  findStrList = (str,keywords,num,index) => {
    let result = [];
    if(!num){
      num = 10;
    }
    if(!index){
      index = 0;
    }
    for(let i=0; i<num; i++){
      index = str.indexOf(keywords,index+1);
      if(index !== -1){
        let begin = index - 17 >= 0 ? index - 17 : 0;
        let end = index + keywords.length + 17 < str.length ? index + keywords.length + 17 : str.length;
        let cont = str.substring(begin,end);
        if(cont){
          cont = cont.replace(/\s/g,"").replace(keywords,'<b style="color: #cb6161">'+keywords+'</b>');
          result.push({
            index : index,
            content : cont
          });
        }
      } else {
        break;
      }
    }
    return result;
  }
  /****  开始阅读  ****/
  readBook = (e,id,reload) => {
    console.log('start read book')
    if(id === curId && ubWindow) {
      return;
    }
    let self = this;
    this.showLoading('文件编码格式检查中，请稍后...',function () {
      if(!reload){
        let flag = true;
        self.state.list.data.forEach(function(dt) {
          if (dt && dt.id === id) {
            if(!window.services.checkFile(dt.path)){
              self.showTip("该路径下文件已不存在或不可读");
              flag = false;
            } else {
              let str = window.services.readBook(dt.path)
              if (str) {
                curContent = str;
                str = null;
              } else {
                self.showTip("解析文件失败，文件编码不支持");
                flag = false;
              }
            }
          }
        });
        if(!flag){
          self.closeLoading();
          return;
        }
        if(id !== curId) {
          curId = id;
        }
      }
      if(!ubWindow){
        ubWindow = window.utools.createBrowserWindow('book.html', {
          useContentSize : true,
          skipTaskbar : true,
          width : self.state.user.data.winWidth ,
          height : self.state.user.data.winHeight,
          x: self.state.user.data.x,
          y: self.state.user.data.y,
          alwaysOnTop : true,
          frame : false,
          transparent : true,
          backgroundColor : '#00000000',
          hasShadow : false,
          webPreferences : {
            // devTools: true,
            preload: 'bookPreload.js'
          }
        }, () => {
          document.getElementById('closeBtn').style.color = '#000000DD';
          //初始化阅读器
          // ubWindow.webContents.openDevTools();
          const msg = {
            type: 1,
            data: self.state.user.data
          }
          window.services.sendMsg(ubWindow.webContents.id, msg);
          self.nextPage(true);
        })
      } else {
        self.nextPage(true);
      }
      self.closeLoading();
    });
  }
  /****  关闭阅读器  ****/
  closeBook = () => {
    console.log('close book');
    if(ubWindow){
      if (!ubWindow.isDestroyed()) {
        ubWindow.close();
      }
      ubWindow = null;
      curContent = '';
      curId = null;
      document.getElementById('closeBtn').style.color = '#ada9a9';
    }
  }
  /****  下一页  ****/
  nextPage = (reader) => {
    console.log('next page');
    if(ubWindow && curId && curContent){
      let self = this;
      this.state.list.data.forEach(function(dt) {
        if (dt && dt.id === curId) {
          if(dt.progress === curContent.length){
            return;
          }
          if(!reader){
            dt.progress = (Number(dt.progress) + Number(self.state.user.data.numOfPage)) > curContent.length ? curContent.length : (Number(dt.progress) + Number(self.state.user.data.numOfPage));
          }
          let res = window.utools.db.put(self.state.list);
          if(res && res.ok) {
            self.setState({ list: JSON.parse(JSON.stringify(window.utools.db.get(self.state.deviceId+"/list")))},()=>{
              const str = curContent.substring(dt.progress , dt.progress + Number(self.state.user.data.numOfPage));
              let ps = (Math.round(((dt.progress + Number(self.state.user.data.numOfPage))/curContent.length)*10000))/100 > 100 ? 100 : (Math.round(((dt.progress + Number(self.state.user.data.numOfPage))/curContent.length)*10000))/100;
              const msg = {
                type: 2,
                data: str.replace(/\s{2,}/g," "),
                progress: ps
              }
              window.services.sendMsg(ubWindow.webContents.id, msg);
            });
          }
        }
      });
    }
  }
  /****  上一页  ****/
  prevPage = () => {
    console.log('prev page');
    if(ubWindow && curId && curContent){
      let self = this;
      this.state.list.data.forEach(function(dt) {
        if (dt && dt.id === curId) {
          if(dt.progress === 0){
            return;
          }
          dt.progress = (Number(dt.progress) - Number(self.state.user.data.numOfPage)) < 0 ? 0 : (Number(dt.progress) - Number(self.state.user.data.numOfPage));
          let res = window.utools.db.put(self.state.list);
          if(res && res.ok) {
            self.setState({ list: JSON.parse(JSON.stringify(window.utools.db.get(self.state.deviceId+"/list")))},()=>{
              const str = curContent.substring(dt.progress , dt.progress + Number(self.state.user.data.numOfPage));
              let ps = (Math.round(((dt.progress + Number(self.state.user.data.numOfPage))/curContent.length)*10000))/100 > 100 ? 100 : (Math.round(((dt.progress + Number(self.state.user.data.numOfPage))/curContent.length)*10000))/100;
              const msg = {
                type: 2,
                data: str.replace(/\s{2,}/g," "),
                progress: ps
              }
              window.services.sendMsg(ubWindow.webContents.id, msg);
            });
          }
        }
      });
    }
  }
  /****  打开提示气泡  ****/
  showTip = (str) => {
    console.log('show tip')
    let self = this;
    self.state.msg = {show : true, text: str};
    this.setState({msg: JSON.parse(JSON.stringify(self.state.msg))});
  }
  /****  关闭提示气泡  ****/
  hideTip = (e) => {
    console.log('hide tip')
    let self = this;
    self.state.msg = {show : false, text: ''};
    this.setState({msg: JSON.parse(JSON.stringify(self.state.msg))});
  }
  /****  章节划分  ****/
  getChapters = (str) => {
    let reg = /(正文){0,1}(第)([零〇一二三四五六七八九十百千万a-zA-Z0-9]{1,7})[章节卷集部篇回]((?! {4}).)((?!\t{1,4}).){0,30}\r?\n/g;
    let list = [];
    let result = str.match(reg);
    result && list.push(...result);
    return list;
  }
  /****   取色  ****/
  pickColor = (e) => {
    let self = this;
    window.utools.screenColorPick(({hex, rgb})=>{
      if(e.target.getAttribute('colorType') === 'bgColor'){
        let arr = rgb.split(',');
        if(arr.length === 3){
          arr[2] = arr[2].replace(')',', '+ this.state.user.data.opacity +')');
          rgb = arr.join(",");
        } else if(arr.length === 4){
          arr[3] = this.state.user.data.opacity + ')';
          rgb = arr.join(",");
        }
      }
      self.state.user.data[e.target.getAttribute('colorType')] = rgb;
      self.setState({user : JSON.parse(JSON.stringify(self.state.user))});
      e.target.style.background = rgb;
    })
  }
  /****  获取各系统按键的表现形式  ****/
  getCommandStr = () => {
    let btn = "Meta+"
    if(window.platform.isMacOs){
      btn = 'Command+'
    } else if (window.platform.isWindows){
      btn = 'Win+'
    }
    return btn;
  }
  getOptionStr = () => {
    let btn = "Alt+"
    if(window.platform.isMacOs){
      btn = 'Option+'
    }
    return btn;
  }
  /****   打开关闭等待层  ****/
  showLoading = (str,callback) => {
    console.log('show loading')
    let tmp = this.state.loading;
    tmp.show = true;
    tmp.msg = str;
    this.setState({loading : JSON.parse(JSON.stringify(tmp))},() => {
      setTimeout(function () {
        callback();
      },180)
    });
  }
  closeLoading = () => {
    console.log('close loading')
    let tmp = this.state.loading;
    tmp.show = false;
    tmp.msg = '';
    this.setState({loading : JSON.parse(JSON.stringify(tmp))});
  }
  /****   打开关闭设置  ****/
  openSetting = (e) => {
    console.log('show setting')
    this.setState({showSetting : true});
  }
  closeSetting = (e) => {
    console.log('close setting')
    this.setState({showSetting : false});
  }
  /****   打开关闭使用说明  ****/
  showHelp = (e) => {
    console.log('show help')
    this.setState({showHelp : true});
  }
  closeHelp = (e) => {
    console.log('close help')
    this.setState({showHelp : false});
  }
  /****   修改设置  ****/
  saveConfig = (e) => {
    let config = this.state.user;
    if(!/^[rR][gG][Bb][Aa]?[\(]([\s]*(2[0-4][0-9]|25[0-5]|[01]?[0-9][0-9]?),){2}[\s]*(2[0-4][0-9]|25[0-5]|[01]?[0-9][0-9]?),?[\s]*(0\.\d{1,2}|1|0)?[\)]{1}$/g.test(config.data.bgColor)
      || !/^[rR][gG][Bb][Aa]?[\(]([\s]*(2[0-4][0-9]|25[0-5]|[01]?[0-9][0-9]?),){2}[\s]*(2[0-4][0-9]|25[0-5]|[01]?[0-9][0-9]?),?[\s]*(0\.\d{1,2}|1|0)?[\)]{1}$/g.test(config.data.fontColor)){
      this.showTip('只支持rgb颜色值，请修改')
      return;
    }
    if(!config.data.numOfPage || !config.data.fontSize || !config.data.prev || !config.data.next){
      this.showTip('设置内容请不要留空')
      return;
    }
    if(config._rev){
      config._rev = window.utools.db.get(this.state.deviceId+"/config")._rev;
    }
    config.data.numOfPage = Number(config.data.numOfPage);
    config.data.autoPage = Number(config.data.autoPage) || 0;
    if(config.data.fontSize < 5 || config.data.fontSize > 22){
      this.showTip('字体大小范围为5-22');
      return;
    }
    if(config.data.prev.endsWith('+') || config.data.next.endsWith('+')){
      this.showTip('不能使用纯功能键作为快捷键！');
      return;
    }
    if(config.data.prev === config.data.next){
      this.showTip('上一页与下一页不能使用相同的快捷键！');
      return;
    }
    if(config.autoPage < 0 || config.autoPage > 100){
      this.showTip('自动翻页时间范围为0秒-100秒');
      return;
    }
    if(!config._rev){
      delete config._rev;
    }
    let res = window.utools.db.put(config);
    if(res && res.ok) {
      this.setState({user : JSON.parse(JSON.stringify(window.utools.db.get(this.state.deviceId+"/config")))}, () => {
        if(ubWindow && !ubWindow.isDestroyed()){
          ubWindow.close();
          ubWindow = null;
          let self = this;
          setTimeout(function () {
            self.readBook(null,curId,true);
          },150);
        }
      });
    }
    this.closeSetting();
  }
  /****  输入框修改  ****/
  inputChange = (e) => {
    let config = this.state.user;
    let val = e.target.value.toString().replace('-','').replace('+','').replace('e','')
    config.data[e.target.getAttribute('id')] = Number(val);
    this.setState({user : JSON.parse(JSON.stringify(config))});
  }
  inputChange2 = (e) => {
    let sc = this.state.search;
    sc[e.target.getAttribute('id')] = e.target.value;
    this.setState({search : JSON.parse(JSON.stringify(sc))});
  }
  inputChange3 = (e) => {
    document.removeEventListener('keydown', this.keyFunc);
    focusId = e.target.getAttribute('id');
    document.addEventListener('keydown', this.keyFunc);
  }
  inputChange4 = (e) => {
    if(e.keyCode === 13){
      this.searchContent(false);
    }
  }
  inputChange5 = (e) => {
    let config = this.state.user;
    config.data[e.target.getAttribute('id')] = e.target.value;
    this.setState({user : JSON.parse(JSON.stringify(config))});
  }
  inputChange6 = (e) => {
    let config = this.state.user;
    config.data.isMove = !config.data.isMove;
    this.setState({user : JSON.parse(JSON.stringify(config))});
  }
  inputChange7 = (e) => {
    let config = this.state.user;
    config.data.mouseType =  e.target.value;
    this.setState({user : JSON.parse(JSON.stringify(config))});
  }
  inputBlur = (e) => {
    document.removeEventListener('keydown', this.keyFunc);
  }
  keyFunc = (e) => {
    let ctrl = e.ctrlKey,shift = e.shiftKey,alt = e.altKey,meta = e.metaKey;
    let connect = (meta ? this.getCommandStr() : "" ) +  (ctrl ? "Control+" : "" ) + (alt ? this.getOptionStr() : "" ) + (shift ? "Shift+" : "" );
    if(e.key !== 'Meta' && e.key !== 'Control' && e.key !== 'Alt' && e.key !== 'Shift'){
      connect = connect + e.key;
    }
    let config = this.state.user;
    config.data[focusId] = connect;
    this.setState({user : JSON.parse(JSON.stringify(config))});
  }
  /****  slide修改  ****/
  slideChange = (e,value) => {
    //自动调节背景颜色
    let rgbBg = this.state.user.data.bgColor;
    if(/^[rR][gG][Bb][Aa]?[\(]([\s]*(2[0-4][0-9]|25[0-5]|[01]?[0-9][0-9]?),){2}[\s]*(2[0-4][0-9]|25[0-5]|[01]?[0-9][0-9]?),?[\s]*(0\.\d{1,2}|1|0)?[\)]{1}$/g.test(rgbBg)){
      let arr = rgbBg.split(',');
      if(arr.length === 3){
        arr[2] = arr[2].replace(')',','+ value +')');
        rgbBg = arr.join(",");
      } else if(arr.length === 4){
        arr[3] = value + ')';
        rgbBg = arr.join(",");
      }
    }
    //设置透明度value
    let config = this.state.user;
    config.data.opacity = value;
    config.data.bgColor = rgbBg;
    this.setState({user : JSON.parse(JSON.stringify(config))});
  }


  componentDidMount () {
    window.utools.onPluginEnter(enter => {
      if(enter && enter.type === 'files' && enter.payload[0] && enter.payload[0].isFile){
        this.addBook(enter.payload[0].path);
      }
      if(enter && enter.code === 'close-reader'){
        this.closeBook();
        window.utools.hideMainWindow();
      }
    })
    window.utools.onPluginReady(() => {
      document.getElementById('closeBtn').style.color = '#ada9a9';
      //查询用户书籍信息
      const list = window.utools.db.get(window.utools.getNativeId() + "/list");
      if(list){
        let state = this.state;
        state.deviceId = window.utools.getNativeId();
        state.list = list;
        this.setState(JSON.parse(JSON.stringify(state)));
      } else {
        let state = this.state;
        state.deviceId = window.utools.getNativeId();
        state.list._id = window.utools.getNativeId()+"/list";
        this.setState(state,() => {
          if(!state.list._rev){
            delete state.list._rev;
          }
          let res = window.utools.db.put(state.list);
          if(res && res.ok){
            state.list._rev = res.rev;
            this.setState(JSON.parse(JSON.stringify(state)));
          } else {
            this.showTip("查询用户配置出错，请在[utools-账号与数据]栏目删除本程序数据后重试!")
          }
        } )
      }
      //查询用户设置
      let config = window.utools.db.get(this.state.deviceId+"/config");
      if(!config){
        //暂无设置，使用默认配置并存库
        config = this.state.user;
        config.data.x = window.screenLeft + 90;
        config.data.y = window.screenTop + 180;
        if(!config._rev){
          delete config._rev;
        }
        config._id = window.utools.getNativeId()+"/config";
        let res = window.utools.db.put(config);
        if(res && res.ok){
          config._rev = res.rev;
        } else {
          this.showTip("查询用户配置出错，请在[utools-账号与数据]栏目删除本程序数据后重试!")
        }
      }
      for (let dataKey in this.state.user.data) {
        if(!config.data.hasOwnProperty(dataKey)){
          config.data[dataKey] = this.state.user.data[dataKey];
        }
      }
      if(config.data.x <= 10 || config.data.x > 8000 || config.data.y <= 10 || config.data.y > 8000){
        config.data.x = window.screenLeft + 90;
        config.data.y = window.screenTop + 180;
      }
      this.setState({user : JSON.parse(JSON.stringify(config))}, () => {
        let self = this;
        //接受子窗口消息
        window.services.receiveMsg(function (res){
          if(res && res.type === 3){
            //修改阅读器窗口大小和位置
            let conf = window.utools.db.get(self.state.deviceId+"/config");
            conf.data.winWidth = res.data.width;
            conf.data.winHeight = res.data.height;
            conf.data.x = res.data.left;
            conf.data.y = res.data.top;
            let result = window.utools.db.put(conf);
            if(result && result.ok) {
              self.setState({user : JSON.parse(JSON.stringify(conf))});
            } else {
              console.log(result.message);
            }
          } else if(res && res.type === 4){
            //翻页
            if(res.data === 'next'){
              self.nextPage();
            } else if(res.data === 'prev') {
              self.prevPage();
            }
          } else if(res && res.type === 5){
            //百分比跳转
            self.state.list.data.forEach(function(dt) {
              if (dt && dt.id === curId) {
                dt.progress = parseInt((curContent.length * (res.data/100)).toString());
                let result = window.utools.db.put(self.state.list);
                if(result && result.ok) {
                  self.setState({ list: JSON.parse(JSON.stringify(window.utools.db.get(self.state.deviceId+"/list")))},()=>{
                    self.nextPage();
                  });
                }
              }
            })
          } else if (res && res.type === 6){
            //阅读器窗口被关闭
            setTimeout(function (){
              if(ubWindow){
                self.closeBook();
              }
            },150);
          }
        })
      });
    })
    window.utools.onPluginOut(() => {

    })
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      this.setState({ theme: e.matches ? 'dark' : 'light' })
    })
  }

  render () {
    return (
      <ThemeProvider theme={themeDic[this.state.theme]}>
        <div className='app-page'>
            <Backdrop open={this.state.loading.show}  className="app-loading" onClick={this.closeLoading}>
              <Typography hidden={!this.state.loading.msg} style={{marginRight:'0.8rem'}}>{this.state.loading.msg}</Typography>
              <CircularProgress color="inherit" style={{width:'30px',height:'30px'}}/>
            </Backdrop>
            <AppBar position="static" className='app-bar'>
              <Toolbar style={{minHeight: '3rem'}}>
                <Typography variant="h7" className='bar-title'>
                  我的书架
                </Typography>
                <Button className='bar-close' id='closeBtn' variant="contained" onClick={this.closeBook}>关闭阅读器</Button>
                <Settings className='bar-setting' onClick={this.openSetting}/>
              </Toolbar>
            </AppBar>
            <Grid container className='grid-root' spacing={2} justifyContent="flex-start" alignItems="flex-start">
              <Grid item xs={12}>
                <Grid container spacing={2}>
                  {this.state.list.data.map((value) => (
                      <Grid key={value.id} item>
                        <Paper variant='outlined' className='grid-paper' bookId={value.id}
                               onContextMenu={(e)=>this.showRightMenu(e,value.id)}
                               onClick={(e)=>this.readBook(e,value.id)}
                        >{value.name}</Paper>
                        <Paper hidden={!value.showRight} className='grid-right-menu' id={value.id}>
                          <ClickAwayListener onClickAway={this.closeRightMenu}>
                            <MenuList  >
                              <MenuItem onClick={(e)=>this.showSearch(e,value.id)}>搜索跳转</MenuItem>
                              <MenuItem onClick={(e)=>this.chaptersList(e,value.id)}>章节跳转</MenuItem>
                              <MenuItem onClick={(e)=>this.removeBook(e,value.id)}>删除小说</MenuItem>
                            </MenuList>
                          </ClickAwayListener>
                        </Paper>
                      </Grid>
                  ))}
                  <Grid key='add' item >
                    <AddCircle style={{ fontSize: 40 }} onClick={this.checkFile} className='grid-add' />
                  </Grid>
                </Grid>
              </Grid>
            </Grid>
            <HelpTwoTone className='help-icon' onClick={this.showHelp}/>
            <Dialog onClose={this.closeHelp} aria-labelledby="customized-dialog-title" open={this.state.showHelp}>
              <DialogTitle id="customized-dialog-title">
                使用说明
              </DialogTitle>
              <DialogContent dividers>
                <Typography gutterBottom>
                  <b style={{color:'#d25353'}}>格式支持</b>  <br/> 目前只支持txt格式文件，支持各种常见的编码格式，如utf-8、utf-16、gbk、gb2312、gb18030等。
                </Typography>
                <Typography gutterBottom>
                  <b style={{color:'#d25353'}}>如何设置老板键</b> <br/> 老板键用于快速关闭阅读窗口，使用方法：在"utools-偏好设置-全局快捷键"栏目添加快捷键，关键字填入close-fish-book即可
                </Typography>
                <Typography gutterBottom>
                  <b style={{color:'#d25353'}}>设置-颜色</b> <br/> 只支持输入保存rgb和rgba色值，也可以使用取色工具取色。
                </Typography>
                <Typography gutterBottom>
                  <b style={{color:'#d25353'}}>设置-窗口移动</b> <br/> 此设置可以切换窗口移动模式和固定模式。ps：windows机器下开启窗口移动会导致鼠标翻页失效。
                </Typography>
                <Typography gutterBottom>
                  <b style={{color:'#d25353'}}>设置-快捷键</b> <br/> 快捷键只能在阅读窗口激活（focus）的情况下有效，该插件快捷键优先级很低，请避免与系统中其他快捷键冲突。
                </Typography>
                <Typography gutterBottom>
                  <b style={{color:'#d25353'}}>设置-自动翻页</b> <br/> 单位：秒，设置为0即为关闭自动翻页。
                </Typography>
              </DialogContent>
            </Dialog>
            <Card hidden={!this.state.chapter.showChapterList} className='chapter-list' id='chapterList' variant="outlined">
              <ClickAwayListener onClickAway={this.closeChapterMenu}>
                <List component="nav" aria-label="secondary mailbox folders">
                  {this.state.chapter.list.map((value,index) => (
                      <ListItem button>
                        <ListItemText onClick={(e)=>this.chapterToBook(e,value,index)}>{value}</ListItemText>
                      </ListItem>
                  ))}
                </List>
              </ClickAwayListener>
            </Card>
            <Card hidden={!this.state.search.show} className='search-main' id='searchMain' variant="outlined">
              <ClickAwayListener onClickAway={this.closeSearch}>
                <CardContent style={{padding:0}}>
                  <Typography variant="overline" display="block" className='title' id='searchHeader'>
                    <span className='label'>关键字:</span>
                    <Input size="small" value={this.state.search.keywords} id='keywords' style={{width:'17rem',marginLeft: '1.5rem'}} inputProps={{ 'aria-label': 'description' }}
                           onChange={(e) => this.inputChange2(e)}
                           onKeyDown={(e) => this.inputChange4(e)}/>
                    <Search className='search-icon' onClick={(e)=>this.searchContent(false)}/>
                  </Typography>
                  <Divider />
                  <List component="nav" hidden={!this.state.search.list || this.state.search.list.length <= 0} aria-label="secondary mailbox folders" id='searchList' className='result'>
                    {this.state.search.list.map((data) => (
                        <ListItem button>
                          <ListItemText onClick={(e) => this.searchToBook(e, data.index)} >
                            <div dangerouslySetInnerHTML={{__html: data.content}}/>
                          </ListItemText>
                        </ListItem>
                    ))}
                    <div className='load-more' hidden={!this.state.search.hasMore}>
                      <Button variant="contained" onClick={(e)=>this.searchContent(true)}>加载更多</Button>
                    </div>
                  </List>
                  <div hidden={this.state.search.list && this.state.search.list.length > 0} className='no-result'>暂无匹配结果</div>
                </CardContent>
              </ClickAwayListener>
            </Card>
            <Snackbar
                anchorOrigin={{vertical: 'top',horizontal: 'center',}} open={this.state.msg.show}
                autoHideDuration={2000} onClose={this.hideTip} message={this.state.msg.text}/>
            <Dialog aria-labelledby="customized-dialog-title" open={this.state.showSetting} onClose={this.closeSetting}>
              <DialogTitle id="customized-dialog-title" >阅读器设置</DialogTitle>
              <DialogContent dividers>
                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="overline" display="block" >
                      <span className='setting-label'>字体颜色</span>
                      <span className='setting-color' colorType='fontColor' style={{ background: this.state.user.data.fontColor }} onClick={this.pickColor} />
                      <Input value={this.state.user.data.fontColor} className='color-input'  size="small" id='fontColor' inputProps={{ 'aria-label': 'description' }}
                             placeholder='只支持rgb颜色值' onChange={(e) => this.inputChange5(e)}/>
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="overline" display="block" >
                      <span className='setting-label'>背景颜色</span>
                      <span className='setting-color' colorType='bgColor' style={{ background: this.state.user.data.bgColor }} onClick={this.pickColor} />
                      <Input value={this.state.user.data.bgColor} className='color-input' size="small" id='bgColor' inputProps={{ 'aria-label': 'description' }}
                             placeholder='只支持rgb颜色值' onChange={(e) => this.inputChange5(e)}/>
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="overline" display="block" >
                      <span className='setting-label'>透明度</span>
                      <Slider id='opacity' className='setting-slide' value={this.state.user.data.opacity} onChange={this.slideChange} aria-labelledby="discrete-slider" valueLabelDisplay="auto" step={0.1} marks min={0} max={1}/>
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="overline" display="block" >
                      <span className='setting-label'>窗口移动</span>
                      <Switch
                          checked={this.state.user.data.isMove}
                          onChange={this.inputChange6}
                          color="primary"
                          name="is-move"
                          inputProps={{ 'aria-label': 'primary checkbox' }}
                      />
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="overline" display="block" >
                      <span className='setting-label'>字体大小</span>
                      <Input value={this.state.user.data.fontSize} size="small" id='fontSize' inputProps={{ 'aria-label': 'description' }}
                             type='number' onChange={(e) => this.inputChange(e)}/>
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="overline" display="block" >
                      <span className='setting-label'>每页字数</span>
                      <Input value={this.state.user.data.numOfPage} size="small" id='numOfPage' inputProps={{ 'aria-label': 'description' }}
                             type='number' onChange={(e) => this.inputChange(e)}/>
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="overline" display="block" >
                      <span className='setting-label'>上一页</span>
                      <Input value={this.state.user.data.prev}  readOnly size="small" id='prev' inputProps={{ 'aria-label': 'description' }}
                             onFocus={(e) => this.inputChange3(e)}
                             onBlur={(e) => this.inputBlur(e)}/>
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="overline" display="block" >
                      <span className='setting-label'>下一页</span>
                      <Input value={this.state.user.data.next} readOnly size="small" id='next' inputProps={{ 'aria-label': 'description' }}
                             onFocus={(e) => this.inputChange3(e)}
                             onBlur={(e) => this.inputBlur(e)} />
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="overline" display="block" >
                      <span className='setting-label'>鼠标翻页</span>
                      <Select value={this.state.user.data.mouseType} onChange={this.inputChange7} style={{maxWidth:'11.5rem',fontSize:'0.9rem'}}>
                        <MenuItem value={0}>无需鼠标翻页</MenuItem>
                        <MenuItem value={1}>上一页:左键;下一页:右键;</MenuItem>
                        <MenuItem value={2}>上一页:右键;下一页:左键;</MenuItem>
                      </Select>
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="overline" display="block" >
                      <span className='setting-label'>自动翻页</span>
                      <Input value={this.state.user.data.autoPage} size="small" id='autoPage' inputProps={{ 'aria-label': 'description' }}
                             placeholder='单位:秒,0为不自动翻页' type='number'
                             onChange={(e) => this.inputChange(e)}/>
                    </Typography>
                  </Grid>
                </Grid>
              </DialogContent>
              <DialogActions>
                <Button autoFocus color="primary" onClick={this.saveConfig}>保存</Button>
              </DialogActions>
            </Dialog>
        </div>
      </ThemeProvider>
    )
  }
}
