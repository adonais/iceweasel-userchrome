# Iceweasel
Iceweasel支持一键启用userchrome环境, 以下是我修改过后的版本, 更适合Iceweasel浏览器使用

# userChrome.js
userChrome loader scripts for Iceweasel

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

## MultiRowTabLiteforFx.uc.js

修改版多行标签
* 兼容ESR115
* 额外功能, hideNewTabBtn(是否隐藏新建标签按钮)
* 额外功能, hideAllTabs(是否隐藏所有标签页下拉框)
* 额外功能, showCloseButtonOnlyOnActiveTab(是否仅在激活标签显示关闭按钮)
* 额外功能, hideWindowControlsInHorizontalMode(是否隐藏标签栏 最小/最大/关闭 三个按钮)
