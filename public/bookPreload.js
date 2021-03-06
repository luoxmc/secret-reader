const { ipcRenderer } = require('electron')
let parentId = null;

window.bookServices = {
  /***  接收主窗口发送过来的消息  ***/
  receiveMsg: (callback) => {
    ipcRenderer.on('ping', (event, res) => {
      parentId = event.senderId;
      if(res){
        callback(res);
      }
    })
  },
  /***  向插件主窗口发送消息  ***/
  sendMsg : (msg) => {
    if(parentId){
      ipcRenderer.sendTo(parentId,'ping',msg);
    }
  }
}
