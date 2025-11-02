# Iceweasel
Iceweasel支持一键启用userchrome环境, 以下是我修改过后的版本, 更适合Iceweasel浏览器使用

# userChrome.js
userChrome.js scripts for Iceweasel

## DownloadUpcheck.uc.js

修改版downloadPlus
* 修改下载器为Iceweasel默认支持的Upcheck
* Upcheck支持Aria2 Rpc, Aria2 Cmd, thunder以及Upcheck本身多线程下载
* 支持完全接管Iceweasel浏览器下载静默下载

## MouseGestures.uc.js

修改版鼠标手势
* 支持luajit脚本
* 当前手势及图形显示
* 高dpi支持
