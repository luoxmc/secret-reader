const { ipcRenderer } = require('electron')
let parentId = null;

window.bookServices = {
  receiveMsg: (callback) => {
    ipcRenderer.on('ping', (event, res) => {
      console.log(res)
      parentId = event.senderId;
      if(res){
        callback(res);
      }
    })
  },
  sendMsg : (msg) => {
    if(parentId){
      console.log(msg)
      ipcRenderer.sendTo(parentId,'ping',msg);
    }
  }
}
